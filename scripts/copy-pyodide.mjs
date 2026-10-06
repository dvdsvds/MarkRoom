import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'pyodide')
const dest = join(root, 'src', 'renderer', 'public', 'pyodide')

if (!existsSync(src)) {
  console.warn('[copy-pyodide] node_modules/pyodide 가 없어요. npm install pyodide 를 먼저 실행해 주세요.')
  process.exit(0)
}

const skip = /\.(d\.ts|d\.mts|map|md)$|^package\.json$|^LICENSE/i
rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })
const copied = []
for (const name of readdirSync(src)) {
  if (skip.test(name)) continue
  cpSync(join(src, name), join(dest, name), { recursive: true })
  copied.push(name)
}
console.log('[copy-pyodide] 복사한 파일:', copied.join(', '))