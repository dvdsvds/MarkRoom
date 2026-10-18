import { ipcMain } from 'electron'
import { readFileSync, statSync } from 'fs'
import { extname, resolve } from 'path'
import { assertInsideRoot } from './workspace/paths'

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

export function registerCodeRunner(): void {
  ipcMain.handle('code:readFiles', (_event, code: unknown, baseDir: unknown, lang: unknown) => {
    if (typeof code !== 'string' || code.length > MAX_CODE_LENGTH) {
      return { files: {}, fileErrors: {} }
    }
    return collectFiles(
      code,
      typeof baseDir === 'string' ? baseDir : '',
      lang === 'js' ? FILE_CALL_RE : PY_FILE_CALL_RE
    )
  })
}
