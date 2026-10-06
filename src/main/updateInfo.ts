import { app } from 'electron'
import { readFileSync } from 'fs'
import { join } from 'path'

function changelogPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'changelog.json')
    : join(__dirname, '../../resources/changelog.json')
}

export function readChangelogFor(version: string): string | null {
  try {
    const raw = readFileSync(changelogPath(), 'utf-8')
    const map = JSON.parse(raw) as Record<string, string>
    return map[version] ?? null
  } catch {
    return null
  }
}
