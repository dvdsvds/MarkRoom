import { createContext, runInContext } from 'vm'

const SETUP = String.raw`
var __logs = [];
var __files = {};
var __fileErrors = {};
function __fmt(v) {
  if (typeof v === 'string') return v;
  if (typeof v === 'undefined') return 'undefined';
  if (typeof v === 'function') return '[Function]';
  if (typeof v === 'bigint') return v + 'n';
  try {
    var s = JSON.stringify(v, null, 2);
    return s === undefined ? String(v) : s;
  } catch (e) {
    return String(v);
  }
}
function __fmtResult(v) {
  return typeof v === 'string' ? JSON.stringify(v) : __fmt(v);
}
var console = {
  log: function () { __logs.push(Array.prototype.map.call(arguments, __fmt).join(' ')); }
};
console.warn = console.log;
console.error = console.log;

function readFile(name) {
  if (Object.prototype.hasOwnProperty.call(__fileErrors, name)) throw new Error(__fileErrors[name]);
  if (!Object.prototype.hasOwnProperty.call(__files, name)) {
    throw new Error("파일 이름은 따옴표 안에 직접 적어야 읽을 수 있어요: " + name);
  }
  return __files[name];
}
function readJSON(name) {
  return JSON.parse(readFile(name));
}
function parseCSV(text, delimiter) {
  var d = delimiter || ',';
  var rows = [], row = [], cell = '', inQ = false;
  text = String(text).replace(/^\uFEFF/, '');
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else { inQ = false; }
      } else { cell += c; }
    } else if (c === '"') {
      inQ = true;
    } else if (c === d) {
      row.push(cell); cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = ''; rows.push(row); row = [];
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  rows = rows.filter(function (r) { return !(r.length === 1 && r[0] === ''); });
  if (rows.length === 0) return [];
  var header = rows[0].map(function (h) { return h.trim(); });
  return rows.slice(1).map(function (r) {
    var o = {};
    header.forEach(function (h, idx) {
      var v = r[idx] === undefined ? '' : r[idx];
      o[h] = /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v;
    });
    return o;
  });
}
function readCSV(name) {
  return parseCSV(readFile(name), /\.tsv$/i.test(name) ? '\t' : ',');
}
var __blocks = [];
var __values = {};
function setValue(name, v) {
  if (typeof name !== 'string' || name.trim() === '') throw new Error('setValue(): 이름은 글자로 적어 주세요. 예: setValue("합계", 100)');
  if (!/^[\p{L}\p{N}_][\p{L}\p{N}_.-]*$/u.test(name)) throw new Error('setValue(): 이름에 쓸 수 없는 글자가 있어요: ' + name);
  var s;
  if (typeof v === 'number') {
    if (!isFinite(v)) throw new Error('setValue(): 숫자가 올바르지 않아요: ' + String(v));
    s = String(v);
  } else if (typeof v === 'string') {
    s = v;
  } else {
    throw new Error('setValue(): 값은 숫자나 글자만 돼요: ' + name);
  }
  if (s.indexOf('\n') !== -1 || s.length > 200) throw new Error('setValue(): 값은 한 줄, 200자 이하예요: ' + name);
  if (Object.keys(__values).length >= 100 && !Object.prototype.hasOwnProperty.call(__values, name)) throw new Error('setValue()는 100개까지예요.');
  __values[name] = s;
}
function __cell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return isFinite(v) ? v : String(v);
  if (typeof v === 'string') return v;
  if (typeof v === 'function') return '[Function]';
  if (typeof v === 'bigint') return v + 'n';
  try {
    var s = JSON.stringify(v);
    return s === undefined ? String(v) : s;
  } catch (e) {
    return String(v);
  }
}
function __tcell(v) {
  var c = __cell(v);
  return (typeof c === 'string' && c.length > 500) ? c.slice(0, 500) + '…' : c;
}
function __pushBlock(b) {
  if (__blocks.length >= 50) throw new Error('표/차트는 한 번에 50개까지 그릴 수 있어요.');
  __blocks.push(b);
}
function __alignOf(a) {
  if (a === 'left' || a === 'center' || a === 'right') return a;
  throw new Error('table(): align은 "left", "center", "right" 중 하나예요: ' + String(a));
}
function table(rows, options) {
  if (!Array.isArray(rows)) throw new Error('table()에는 배열을 넘겨 주세요. 예: table([{ aaa: 1, bbb: 2 }])');
  if (rows.length === 0) throw new Error('table()에 넘긴 배열이 비어 있어요.');
  var opts = options || {};
  var columns = [];
  var body = [];
  var i, j;
  if (Array.isArray(rows[0])) {
    columns = rows[0].map(function (c) { return String(__cell(c)); });
    if (columns.length > 50) throw new Error('table()은 50칸(열)까지 그릴 수 있어요.');
    for (i = 1; i < rows.length; i++) {
      if (!Array.isArray(rows[i])) throw new Error('table(): ' + (i + 1) + '번째 줄이 배열이 아니에요.');
      var arr = [];
      for (j = 0; j < columns.length; j++) arr.push(__tcell(rows[i][j]));
      body.push(arr);
    }
  } else {
    if (Array.isArray(opts.columns)) {
      columns = opts.columns.map(String);
    } else {
      var seen = {};
      for (i = 0; i < rows.length && i < 100; i++) {
        var r0 = rows[i];
        if (r0 === null || typeof r0 !== 'object' || Array.isArray(r0)) {
          throw new Error('table(): ' + (i + 1) + '번째 줄이 객체가 아니에요.');
        }
        Object.keys(r0).forEach(function (k) {
          if (!Object.prototype.hasOwnProperty.call(seen, k)) { seen[k] = true; columns.push(k); }
        });
      }
    }
    if (columns.length === 0) throw new Error('table(): 열이 하나도 없어요.');
    if (columns.length > 50) throw new Error('table()은 50칸(열)까지 그릴 수 있어요.');
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r === null || typeof r !== 'object' || Array.isArray(r)) {
        throw new Error('table(): ' + (i + 1) + '번째 줄이 객체가 아니에요.');
      }
      body.push(columns.map(function (c) { return __tcell(r[c]); }));
    }
  }
  if (body.length > 1000) throw new Error('table()은 데이터 1000줄까지 그릴 수 있어요.');
  var align = columns.map(function () { return 'left'; });
  var given = opts.align;
  if (typeof given === 'string') {
    var all = __alignOf(given);
    align = columns.map(function () { return all; });
  } else if (Array.isArray(given)) {
    given.forEach(function (a, idx) { if (idx < align.length) align[idx] = __alignOf(a); });
  } else if (given && typeof given === 'object') {
    Object.keys(given).forEach(function (k) {
      var idx = columns.indexOf(k);
      if (idx === -1) throw new Error('table(): align에 없는 열이에요: ' + k);
      align[idx] = __alignOf(given[k]);
    });
  }
  __pushBlock({ kind: 'table', title: opts.title ? String(opts.title) : '', columns: columns, align: align, rows: body });
}
function chart(spec) {
  if (!spec || typeof spec !== 'object') {
    throw new Error('chart()에는 객체를 넘겨 주세요. 예: chart({ type: "bar", labels: ["aaa", "bbb"], values: [1, 2] })');
  }
  var type = spec.type;
  if (type !== 'bar' && type !== 'line' && type !== 'pie') {
    throw new Error('chart(): type은 "bar", "line", "pie" 중 하나예요: ' + String(type));
  }
  if (!Array.isArray(spec.labels) || spec.labels.length === 0) {
    throw new Error('chart(): labels는 비어 있지 않은 배열이어야 해요.');
  }
  if (spec.labels.length > 200) throw new Error('chart(): labels는 200개까지예요.');
  var labels = spec.labels.map(function (l) { return String(__cell(l)); });
  var raw;
  if (Array.isArray(spec.series)) {
    raw = spec.series.map(function (s, k) {
      return { name: s && s.name ? String(s.name) : '계열 ' + (k + 1), values: s && s.values };
    });
  } else if (Array.isArray(spec.values)) {
    raw = [{ name: spec.name ? String(spec.name) : '', values: spec.values }];
  } else {
    throw new Error('chart(): values 배열(또는 series)이 필요해요.');
  }
  if (raw.length === 0) throw new Error('chart(): series가 비어 있어요.');
  if (raw.length > 8) throw new Error('chart(): series는 8개까지예요.');
  var series = raw.map(function (s) {
    if (!Array.isArray(s.values)) throw new Error('chart(): "' + s.name + '" values가 배열이 아니에요.');
    if (s.values.length !== labels.length) {
      throw new Error('chart(): labels는 ' + labels.length + '개인데 ' + (s.name ? '"' + s.name + '" ' : '') + 'values는 ' + s.values.length + '개예요.');
    }
    return {
      name: s.name,
      values: s.values.map(function (v, idx) {
        if (v === null || v === undefined || v === '' || typeof v === 'boolean' || !isFinite(Number(v))) {
          throw new Error('chart(): ' + (idx + 1) + '번째 값이 숫자가 아니에요: ' + String(v));
        }
        return Number(v);
      })
    };
  });
  if (type === 'pie') {
    if (series.length !== 1) throw new Error('chart(): pie는 values 하나만 받아요.');
    if (labels.length > 12) throw new Error('chart(): pie는 항목 12개까지예요.');
    var sum = 0;
    series[0].values.forEach(function (v) {
      if (v < 0) throw new Error('chart(): pie에는 음수를 쓸 수 없어요.');
      sum += v;
    });
    if (sum <= 0) throw new Error('chart(): pie 값의 합이 0이에요.');
  }
  __pushBlock({ kind: 'chart', type: type, title: spec.title ? String(spec.title) : '', labels: labels, series: series });
}
`

interface RunRequest {
  code: string
  files: Record<string, string>
  fileErrors: Record<string, string>
}

process.parentPort.on('message', async (event) => {
  const { code, files, fileErrors } = event.data as RunRequest
  const ctx = createContext({})
  runInContext(SETUP, ctx)
  runInContext(
    `__files = JSON.parse(${JSON.stringify(JSON.stringify(files))});` +
      `__fileErrors = JSON.parse(${JSON.stringify(JSON.stringify(fileErrors))});`,
    ctx
  )

  let result: string | null = null
  let error: string | null = null
  try {
    let value = runInContext(code, ctx, { timeout: 3000 })
    if (value && typeof value.then === 'function') value = await value
    if (value !== undefined) {
      const fmtResult = runInContext('__fmtResult', ctx) as (v: unknown) => string
      result = fmtResult(value)
    }
  } catch (e) {
    const err = e as { name?: unknown; message?: unknown } | null
    error =
      err && err.message !== undefined
        ? `${String(err.name ?? 'Error')}: ${String(err.message)}`
        : String(e)
  }

  let output = ''
  try {
    output = String(runInContext('__logs.join("\\n")', ctx))
  } catch {
    output = ''
  }
  let blocks: unknown[] = []
  try {
    const json = String(runInContext('JSON.stringify(__blocks)', ctx))
    if (json.length > 2_000_000) {
      error = error ?? '표/차트 데이터가 너무 커요.'
    } else {
      blocks = JSON.parse(json)
    }
  } catch {
    blocks = []
  }
  let values: Record<string, string> = {}
  try {
    values = JSON.parse(String(runInContext('JSON.stringify(__values)', ctx)))
  } catch {
    values = {}
  }
  process.parentPort.postMessage({ output, result, error, timedOut: false, blocks, values })
})
