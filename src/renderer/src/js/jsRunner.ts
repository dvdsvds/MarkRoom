import type { RunResult } from '@renderer/utils/outputBlocks'
import { failure, normalize } from '@renderer/python/pyRunner'

const RUN_TIMEOUT_MS = 5000
const MAX_CODE_LENGTH = 100_000

export async function runJs(code: string, baseDir: string): Promise<RunResult> {
  if (code.length > MAX_CODE_LENGTH) return failure('코드가 너무 길어요.')
  let files: Record<string, string> = {}
  let fileErrors: Record<string, string> = {}
  try {
    ;({ files, fileErrors } = await window.api.code.readFiles(code, baseDir, 'js'))
  } catch {
    return failure('파일을 미리 읽지 못했어요.')
  }

  const worker = new Worker(new URL('js-worker.js', document.baseURI))
  return new Promise<RunResult>((resolve) => {
    const finish = (r: RunResult): void => {
      clearTimeout(timer)
      worker.terminate()
      resolve(r)
    }
    const timer = setTimeout(
      () => finish(failure(`${RUN_TIMEOUT_MS / 1000}초 안에 끝나지 않아서 중단했어요.`, true)),
      RUN_TIMEOUT_MS
    )
    worker.onmessage = (e: MessageEvent): void =>
      finish(normalize((e.data ?? {}) as Record<string, unknown>))
    worker.onerror = (): void => finish(failure('실행 중 오류가 났어요.'))
    worker.postMessage({ code, files, fileErrors })
  })
}
