import { ipcMain, utilityProcess } from 'electron'
import { readFileSync, statSync } from 'fs'
import { extname, resolve } from 'path'
import runnerPath from './runner?modulePath'
import { assertInsideRoot } from './workspace/paths'

export type OutputBlock =
  | {
      kind: 'table'
      title: string
      columns: string[]
      align: ('left' | 'center' | 'right')[]
      rows: (string | number)[][]
    }
  | {
      kind: 'chart'
      type: 'bar' | 'line' | 'pie'
      title: string
      labels: string[]
      series: { name: string; values: number[] }[]
    }

export interface RunResult {
  output: string
  result: string | null
  error: string | null
  timedOut: boolean
  blocks: OutputBlock[]
  values: Record<string, string>
}

const TIMEOUT_MS = 5000
const MAX_CODE_LENGTH = 100_000
const MAX_FILE_BYTES = 2 * 1024 * 1024
const ALLOWED_EXT = new Set(['.csv', '.tsv', '.json', '.txt', '.md'])
const FILE_CALL_RE = /\b(?:readFile|readJSON|readCSV)\(\s*(['"`])([^'"`\\\n]+)\1\s*\)/g
const PY_FILE_CALL_RE = /\b(?:read_file|read_json|read_csv)\(\s*(['"])([^'"\\\n]+)\1\s*[,)]/g

function collectFiles(
  code: string,
  baseDir: string,
  re: RegExp = FILE_CALL_RE
): { files: Record<string, string>; fileErrors: Record<string, string> } {
  const files: Record<string, string> = {}
  const fileErrors: Record<string, string> = {}
  for (const m of code.matchAll(re)) {
    const name = m[2]
    if (name in files || name in fileErrors) continue
    try {
      if (!baseDir) throw new Error('이 파일이 있는 폴더를 알 수 없어요. 먼저 저장해 주세요.')
      const full = assertInsideRoot(resolve(baseDir, name))
      if (!ALLOWED_EXT.has(extname(full).toLowerCase())) {
        throw new Error('csv, tsv, json, txt, md 파일만 읽을 수 있어요.')
      }
      if (statSync(full).size > MAX_FILE_BYTES)
        throw new Error('파일이 너무 커요 (2MB 이하만 읽어요).')
      files[name] = readFileSync(full, 'utf-8')
    } catch (e) {
      fileErrors[name] =
        e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code === 'ENOENT'
          ? `파일을 찾을 수 없어요: ${name}`
          : e instanceof Error
            ? e.message
            : String(e)
    }
  }
  return { files, fileErrors }
}

function runCode(code: string, baseDir: string): Promise<RunResult> {
  const { files, fileErrors } = collectFiles(code, baseDir)
  return new Promise((resolvePromise) => {
    const child = utilityProcess.fork(runnerPath)
    let done = false
    const finish = (r: RunResult): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      child.kill()
      resolvePromise(r)
    }
    const timer = setTimeout(
      () =>
        finish({
          output: '',
          result: null,
          error: `${TIMEOUT_MS / 1000}초 안에 끝나지 않아서 중단했어요.`,
          timedOut: true,
          blocks: [],
          values: {}
        }),
      TIMEOUT_MS
    )
    child.on('message', (msg: RunResult) =>
      finish({
        ...msg,
        blocks: Array.isArray(msg.blocks) ? msg.blocks : [],
        values: msg.values && typeof msg.values === 'object' ? msg.values : {}
      })
    )
    child.on('exit', () =>
      finish({
        output: '',
        result: null,
        error: '실행이 예기치 않게 종료됐어요.',
        timedOut: false,
        blocks: [],
        values: {}
      })
    )
    child.postMessage({ code, files, fileErrors })
  })
}

export function registerCodeRunner(): void {
  ipcMain.handle('code:readFiles', (_event, code: unknown, baseDir: unknown) => {
    if (typeof code !== 'string' || code.length > MAX_CODE_LENGTH) {
      return { files: {}, fileErrors: {} }
    }
    return collectFiles(code, typeof baseDir === 'string' ? baseDir : '', PY_FILE_CALL_RE)
  })
  ipcMain.handle(
    'code:run',
    (_event, code: unknown, baseDir: unknown): Promise<RunResult> | RunResult => {
      if (typeof code !== 'string' || code.length > MAX_CODE_LENGTH) {
        return {
          output: '',
          result: null,
          error: '코드가 너무 길어요.',
          timedOut: false,
          blocks: [],
          values: {}
        }
      }
      return runCode(code, typeof baseDir === 'string' ? baseDir : '')
    }
  )
}
