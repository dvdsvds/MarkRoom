export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

export function dirOf(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return idx >= 0 ? path.slice(0, idx) : path
}

export function sepOf(path: string): string {
  return path.includes('\\') ? '\\' : '/'
}