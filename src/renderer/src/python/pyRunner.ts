type RunResult = Awaited<ReturnType<typeof window.api.code.run>>

const RUN_TIMEOUT_MS = 5000
const LOAD_TIMEOUT_MS = 60_000
const MAX_CODE_LENGTH = 100_000
const MAX_OUTPUT_LENGTH = 1_000_000

interface Session {
  worker: Worker
  ready: Promise<void>
}

let session: Session | null = null
let queue: Promise<unknown> = Promise.resolve()
let nextId = 1

const failure = (error: string, timedOut = false): RunResult => ({
  output: '',
  result: null,
  error,
  timedOut,
  blocks: []
})

function dropSession(s: Session): void {
  s.worker.terminate()
  if (session === s) session = null
}

function createSession(): Session {
  const worker = new Worker(new URL('py-worker.js', document.baseURI), { type: 'module' })
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('파이썬을 불러오는 데 너무 오래 걸려요.')),
      LOAD_TIMEOUT_MS
    )
    const onMessage = (e: MessageEvent): void => {
      const d = e.data as { type?: string; message?: unknown } | null
      if (d?.type === 'ready') {
        clearTimeout(timer)
        worker.removeEventListener('message', onMessage)
        resolve()
      } else if (d?.type === 'fatal') {
        clearTimeout(timer)
        worker.removeEventListener('message', onMessage)
        reject(new Error(String(d.message ?? '알 수 없는 오류')))
      }
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener(
      'error',
      (e) => {
        clearTimeout(timer)
        reject(new Error(e.message || '파이썬 워커를 시작하지 못했어요.'))
      },
      { once: true }
    )
    worker.postMessage({ type: 'init', indexURL: new URL('pyodide/', document.baseURI).href })
  })
  return { worker, ready }
}

function normalize(d: Record<string, unknown>): RunResult {
  const blocks = Array.isArray(d.blocks)
    ? (d.blocks as RunResult['blocks'])
        .filter((b) => b && (b.kind === 'table' || b.kind === 'chart'))
        .slice(0, 50)
    : []
  return {
    output: typeof d.output === 'string' ? d.output.slice(0, MAX_OUTPUT_LENGTH) : '',
    result: typeof d.result === 'string' ? d.result.slice(0, MAX_OUTPUT_LENGTH) : null,
    error: typeof d.error === 'string' ? d.error : null,
    timedOut: false,
    blocks
  }
}

async function doRun(code: string, baseDir: string): Promise<RunResult> {
  let files: Record<string, string> = {}
  let fileErrors: Record<string, string> = {}
  try {
    ;({ files, fileErrors } = await window.api.code.readFiles(code, baseDir))
  } catch {
    return failure('파일을 미리 읽지 못했어요.')
  }

  if (!session) session = createSession()
  const s = session
  try {
    await s.ready
  } catch (e) {
    dropSession(s)
    return failure(`파이썬을 시작하지 못했어요: ${e instanceof Error ? e.message : String(e)}`)
  }

  return new Promise<RunResult>((resolve) => {
    const id = nextId++
    const finish = (r: RunResult, kill: boolean): void => {
      clearTimeout(timer)
      s.worker.removeEventListener('message', onMessage)
      s.worker.removeEventListener('error', onError)
      if (kill) dropSession(s)
      resolve(r)
    }
    const timer = setTimeout(
      () => finish(failure(`${RUN_TIMEOUT_MS / 1000}초 안에 끝나지 않아서 중단했어요.`, true), true),
      RUN_TIMEOUT_MS
    )
    const onMessage = (e: MessageEvent): void => {
      const d = e.data as Record<string, unknown> | null
      if (d && d.type === 'result' && d.id === id) finish(normalize(d), false)
    }
    const onError = (): void => finish(failure('실행 중 오류가 났어요.'), true)
    s.worker.addEventListener('message', onMessage)
    s.worker.addEventListener('error', onError)
    s.worker.postMessage({ type: 'run', id, code, files, fileErrors })
  })
}

export function runPython(code: string, baseDir: string): Promise<RunResult> {
  if (code.length > MAX_CODE_LENGTH) return Promise.resolve(failure('코드가 너무 길어요.'))
  const p = queue.then(() => doRun(code, baseDir))
  queue = p.catch(() => undefined)
  return p
}