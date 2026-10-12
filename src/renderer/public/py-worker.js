let pyodide = null
let logs = []
let logSize = 0
let blocks = []
let values = Object.create(null)

function pushLog(s) {
  if (logSize > 1000000) return
  logs.push(s)
  logSize += s.length + 1
}

function cell(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return isFinite(v) ? v : String(v)
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'True' : 'False'
  try {
    const s = JSON.stringify(v)
    return s === undefined ? String(v) : s
  } catch (_) {
    return String(v)
  }
}

function tcell(v) {
  const c = cell(v)
  return typeof c === 'string' && c.length > 500 ? c.slice(0, 500) + '…' : c
}

function pushBlock(b) {
  if (blocks.length >= 50) throw new Error('표/차트는 한 번에 50개까지 그릴 수 있어요.')
  blocks.push(b)
}

function alignOf(a) {
  if (a === 'left' || a === 'center' || a === 'right') return a
  throw new Error('table(): align은 "left", "center", "right" 중 하나예요: ' + String(a))
}

function pushTable(rows, opts) {
  if (!Array.isArray(rows))
    throw new Error('table()에는 리스트를 넘겨 주세요. 예: table([{"aaa": 1, "bbb": 2}])')
  if (rows.length === 0) throw new Error('table()에 넘긴 리스트가 비어 있어요.')
  opts = opts || {}
  let columns = []
  const body = []
  if (Array.isArray(rows[0])) {
    columns = rows[0].map((c) => String(cell(c)))
    if (columns.length > 50) throw new Error('table()은 50칸(열)까지 그릴 수 있어요.')
    for (let i = 1; i < rows.length; i++) {
      if (!Array.isArray(rows[i]))
        throw new Error('table(): ' + (i + 1) + '번째 줄이 리스트가 아니에요.')
      const arr = []
      for (let j = 0; j < columns.length; j++) arr.push(tcell(rows[i][j]))
      body.push(arr)
    }
  } else {
    if (Array.isArray(opts.columns)) {
      columns = opts.columns.map(String)
    } else {
      const seen = {}
      for (let i = 0; i < rows.length && i < 100; i++) {
        const r0 = rows[i]
        if (r0 === null || typeof r0 !== 'object' || Array.isArray(r0)) {
          throw new Error('table(): ' + (i + 1) + '번째 줄이 딕셔너리가 아니에요.')
        }
        Object.keys(r0).forEach((k) => {
          if (!Object.prototype.hasOwnProperty.call(seen, k)) {
            seen[k] = true
            columns.push(k)
          }
        })
      }
    }
    if (columns.length === 0) throw new Error('table(): 열이 하나도 없어요.')
    if (columns.length > 50) throw new Error('table()은 50칸(열)까지 그릴 수 있어요.')
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (r === null || typeof r !== 'object' || Array.isArray(r)) {
        throw new Error('table(): ' + (i + 1) + '번째 줄이 딕셔너리가 아니에요.')
      }
      body.push(columns.map((c) => tcell(r[c])))
    }
  }
  if (body.length > 1000) throw new Error('table()은 데이터 1000줄까지 그릴 수 있어요.')
  let align = columns.map(() => 'left')
  const given = opts.align
  if (typeof given === 'string') {
    const all = alignOf(given)
    align = columns.map(() => all)
  } else if (Array.isArray(given)) {
    given.forEach((a, idx) => {
      if (idx < align.length) align[idx] = alignOf(a)
    })
  } else if (given && typeof given === 'object') {
    Object.keys(given).forEach((k) => {
      const idx = columns.indexOf(k)
      if (idx === -1) throw new Error('table(): align에 없는 열이에요: ' + k)
      align[idx] = alignOf(given[k])
    })
  }
  pushBlock({
    kind: 'table',
    title: opts.title ? String(opts.title) : '',
    columns: columns,
    align: align,
    rows: body
  })
}

function pushChart(spec) {
  if (!spec || typeof spec !== 'object') {
    throw new Error(
      'chart()에는 딕셔너리를 넘겨 주세요. 예: chart({"type": "bar", "labels": ["aaa", "bbb"], "values": [1, 2]})'
    )
  }
  const type = spec.type
  if (type !== 'bar' && type !== 'line' && type !== 'pie') {
    throw new Error('chart(): type은 "bar", "line", "pie" 중 하나예요: ' + String(type))
  }
  if (!Array.isArray(spec.labels) || spec.labels.length === 0) {
    throw new Error('chart(): labels는 비어 있지 않은 리스트여야 해요.')
  }
  if (spec.labels.length > 200) throw new Error('chart(): labels는 200개까지예요.')
  const labels = spec.labels.map((l) => String(cell(l)))
  let raw
  if (Array.isArray(spec.series)) {
    raw = spec.series.map((s, k) => ({
      name: s && s.name ? String(s.name) : '계열 ' + (k + 1),
      values: s && s.values
    }))
  } else if (Array.isArray(spec.values)) {
    raw = [{ name: spec.name ? String(spec.name) : '', values: spec.values }]
  } else {
    throw new Error('chart(): values 리스트(또는 series)가 필요해요.')
  }
  if (raw.length === 0) throw new Error('chart(): series가 비어 있어요.')
  if (raw.length > 8) throw new Error('chart(): series는 8개까지예요.')
  const series = raw.map((s) => {
    if (!Array.isArray(s.values))
      throw new Error('chart(): "' + s.name + '" values가 리스트가 아니에요.')
    if (s.values.length !== labels.length) {
      throw new Error(
        'chart(): labels는 ' +
          labels.length +
          '개인데 ' +
          (s.name ? '"' + s.name + '" ' : '') +
          'values는 ' +
          s.values.length +
          '개예요.'
      )
    }
    return {
      name: s.name,
      values: s.values.map((v, idx) => {
        if (
          v === null ||
          v === undefined ||
          v === '' ||
          typeof v === 'boolean' ||
          !isFinite(Number(v))
        ) {
          throw new Error('chart(): ' + (idx + 1) + '번째 값이 숫자가 아니에요: ' + String(v))
        }
        return Number(v)
      })
    }
  })
  if (type === 'pie') {
    if (series.length !== 1) throw new Error('chart(): pie는 values 하나만 받아요.')
    if (labels.length > 12) throw new Error('chart(): pie는 항목 12개까지예요.')
    let sum = 0
    series[0].values.forEach((v) => {
      if (v < 0) throw new Error('chart(): pie에는 음수를 쓸 수 없어요.')
      sum += v
    })
    if (sum <= 0) throw new Error('chart(): pie 값의 합이 0이에요.')
  }
  pushBlock({
    kind: 'chart',
    type: type,
    title: spec.title ? String(spec.title) : '',
    labels: labels,
    series: series
  })
}

function snoteBlock(kind, aJson, bJson) {
  try {
    const a = JSON.parse(aJson)
    const b = JSON.parse(bJson)
    if (kind === 'table') pushTable(a, b || {})
    else pushChart(a)
    return ''
  } catch (err) {
    return String(err && err.message ? err.message : err)
  }
}

function snoteValue(nameJson, valueJson) {
  try {
    const name = JSON.parse(nameJson)
    const v = JSON.parse(valueJson)
    if (typeof name !== 'string' || !/^[\p{L}\p{N}_][\p{L}\p{N}_.-]*$/u.test(name)) {
      throw new Error(
        'set_value(): 이름은 글자·숫자·_·.·- 만 쓸 수 있고 공백은 안 돼요: ' + String(name)
      )
    }
    let s
    if (typeof v === 'number') {
      if (!isFinite(v)) throw new Error('set_value(): 숫자가 올바르지 않아요.')
      s = String(v)
    } else if (typeof v === 'string') {
      s = v
    } else {
      throw new Error('set_value(): 값은 숫자나 문자열이어야 해요.')
    }
    if (s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
      throw new Error('set_value(): 값에는 줄바꿈을 쓸 수 없어요.')
    }
    if (s.length > 200) throw new Error('set_value(): 값은 200자까지예요.')
    if (!(name in values) && Object.keys(values).length >= 100) {
      throw new Error('set_value()는 100개까지 쓸 수 있어요.')
    }
    values[name] = s
    return ''
  } catch (err) {
    return String(err && err.message ? err.message : err)
  }
}

const PRELUDE = String.raw`
import json as __json
from js import _snote_block as __block
from js import _snote_value as __setv

__files = __json.loads(__files_json)
__file_errors = __json.loads(__file_errors_json)


class __SnoteError(Exception):
    pass


__SnoteError.__name__ = 'Error'


def __dump(o):
    try:
        return __json.dumps(o, default=str, allow_nan=False)
    except ValueError:
        raise __SnoteError('표/차트 데이터를 변환하지 못했어요 (NaN, inf, 순환 참조는 쓸 수 없어요).')


def __emit(kind, a, b):
    msg = __block(kind, __dump(a), __dump(b))
    if msg:
        raise __SnoteError(msg)


def table(rows=None, **options):
    __emit('table', rows, options)


def chart(spec=None, **kw):
    s = dict(spec) if spec is not None else {}
    s.update(kw)
    __emit('chart', s, None)

def set_value(name, value):
  msg = __setv(__dump(name), __dump(value))
  if msg:
      raise __SnoteError(msg)

def read_file(name):
    if name in __file_errors:
        raise __SnoteError(__file_errors[name])
    if name not in __files:
        raise __SnoteError('파일 이름은 따옴표 안에 직접 적어야 읽을 수 있어요: ' + str(name))
    return __files[name]


def read_json(name):
    return __json.loads(read_file(name))


def parse_csv(text, delimiter=','):
    import csv, io, re
    text = str(text).lstrip('\ufeff')
    rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    rows = [r for r in rows if not (len(r) == 1 and r[0] == '')]
    if not rows:
        return []
    header = [h.strip() for h in rows[0]]
    num = re.compile(r'^-?\d+(\.\d+)?$')
    out = []
    for r in rows[1:]:
        o = {}
        for i, h in enumerate(header):
            v = r[i] if i < len(r) else ''
            s = v.strip()
            if num.match(s):
                o[h] = float(s) if '.' in s else int(s)
            else:
                o[h] = v
        out.append(o)
    return out


def read_csv(name, delimiter=None):
    d = delimiter or ('\t' if str(name).lower().endswith('.tsv') else ',')
    return parse_csv(read_file(name), d)


def __describe(e):
    import traceback
    if isinstance(e, SyntaxError):
        where = ' (줄 ' + str(e.lineno) + ')' if e.lineno else ''
        return 'SyntaxError: ' + str(e.msg) + where
    line = None
    for f in traceback.extract_tb(e.__traceback__):
        if f.filename == '<memo>':
            line = f.lineno
    name = type(e).__name__
    text = name + ': ' + str(e) if str(e) else name
    return text + (' (줄 ' + str(line) + ')' if line else '')


def __snote_run(src, ns):
    import ast
    try:
        tree = ast.parse(src, '<memo>', 'exec')
        last = None
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last = ast.Expression(tree.body.pop().value)
            ast.fix_missing_locations(last)
        exec(compile(tree, '<memo>', 'exec'), ns)
        result = None
        if last is not None:
            v = eval(compile(last, '<memo>', 'eval'), ns)
            if v is not None:
                result = repr(v)
                if len(result) > 100000:
                    result = result[:100000] + '…'
        return __json.dumps({'result': result, 'error': None})
    except BaseException as e:
        return __json.dumps({'result': None, 'error': __describe(e)})
`

function lock() {
  const names = [
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'importScripts',
    'indexedDB',
    'caches',
    'Worker',
    'SharedWorker',
    'BroadcastChannel'
  ]
  for (const k of names) {
    try {
      Object.defineProperty(self, k, { value: undefined, configurable: false, writable: false })
    } catch (_) {
      try {
        self[k] = undefined
      } catch (_2) {
        /* 무시 */
      }
    }
  }
}

async function init(indexURL) {
  try {
    const mod = await import(indexURL + 'pyodide.mjs')
    pyodide = await mod.loadPyodide({ indexURL: indexURL })
    pyodide.setStdout({ batched: (s) => pushLog(s) })
    pyodide.setStderr({ batched: (s) => pushLog(s) })
    try {
      pyodide.setStdin({ error: true })
    } catch (_) {
      /* 무시 */
    }
    self._snote_block = snoteBlock
    self._snote_value = snoteValue
    lock()
    self.postMessage({ type: 'ready' })
  } catch (err) {
    self.postMessage({ type: 'fatal', message: String(err && err.message ? err.message : err) })
  }
}

function run(d) {
  logs = []
  logSize = 0
  blocks = []
  let value = Object.create(null)
  value = Object.create(null)
  const reply = (r) => self.postMessage(Object.assign({ type: 'result', id: d.id }, r))
  let ns = null
  try {
    if (typeof d.code !== 'string') throw new Error('코드가 문자열이 아니에요.')
    ns = pyodide.runPython('dict()')
    ns.set('__files_json', JSON.stringify(d.files || {}))
    ns.set('__file_errors_json', JSON.stringify(d.fileErrors || {}))
    ns.set('__src', d.code)
    pyodide.runPython(PRELUDE, { globals: ns })
    const raw = pyodide.runPython('__snote_run(__src, globals())', { globals: ns })
    const r = JSON.parse(raw)
    reply({ output: logs.join('\n'), result: r.result, error: r.error, blocks: blocks })
  } catch (err) {
    reply({
      output: logs.join('\n'),
      result: null,
      error: '실행하지 못했어요: ' + String(err && err.message ? err.message : err),
      blocks: blocks,
      values: Object.assign({}, values)
    })
  } finally {
    try {
      if (ns) ns.destroy()
    } catch (_) {
      /* 무시 */
    }
  }
}

self.onmessage = (e) => {
  const d = e.data
  if (!d) return
  if (d.type === 'init') void init(String(d.indexURL))
  else if (d.type === 'run') run(d)
}
