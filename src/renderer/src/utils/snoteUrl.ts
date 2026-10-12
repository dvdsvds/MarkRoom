export function snoteUrl(filePath: string): string {
  const norm = filePath.replace(/\\/g, '/')
  const encoded = norm.split('/').map(encodeURIComponent).join('/')
  return `snote://local${norm.startsWith('/') ? '' : '/'}${encoded}`
}