import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve, sep } from 'path'

interface Config {
  rootDir: string
  lastSeenVersion?: string
  historyDir?: string
}

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function defaultRootDir(): string {
  return join(app.getPath('userData'), 'SyntaxNote')
}

function readConfig(): Partial<Config> | null {
  try {
    const raw = readFileSync(configPath(), 'utf-8')
    return JSON.parse(raw) as Partial<Config>
  } catch {
    return null
  }
}

function writeConfig(patch: Partial<Config>): void {
  const merged = { ...(readConfig() ?? {}), ...patch }
  writeFileSync(configPath(), JSON.stringify(merged, null, 2), 'utf-8')
}

let cachedRootDir: string | null = null

export function getRootDir(): string {
  if (cachedRootDir) return cachedRootDir

  const config = readConfig()
  const rootDir = config?.rootDir ?? defaultRootDir()

  if (!existsSync(rootDir)) {
    mkdirSync(rootDir, { recursive: true })
  }
  if (!config?.rootDir) {
    writeConfig({ rootDir })
  }

  cachedRootDir = rootDir
  return rootDir
}

export function setRootDir(newRootDir: string): string {
  const resolved = resolve(newRootDir)
  if (!existsSync(resolved)) {
    mkdirSync(resolved, { recursive: true })
  }
  writeConfig({ rootDir: resolved })
  cachedRootDir = resolved
  return resolved
}

export function getLastSeenVersion(): string | null {
  return readConfig()?.lastSeenVersion ?? null
}

export function setLastSeenVersion(version: string): void {
  writeConfig({ lastSeenVersion: version })
}

export function defaultHistoryDir(): string {
  return join(app.getPath('userData'), 'history')
}

export function getHistoryDir(): string {
  return readConfig()?.historyDir ?? defaultHistoryDir()
}

export function setHistoryDirConfig(dir: string | null): void {
  writeConfig({ historyDir: dir ?? undefined })
}

export function assertInsideRoot(target: string): string {
  const root = getRootDir()
  const resolvedTarget = resolve(target)
  const resolvedRoot = resolve(root)
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + sep)) {
    throw new Error(`허용되지 않은 경로입니다: ${target}`)
  }
  return resolvedTarget
}
