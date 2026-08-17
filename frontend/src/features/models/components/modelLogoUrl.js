export function normalizeModelLogoUrl(value) {
  const source = String(value || '').trim()
  if (!source) return ''
  try {
    const url = new URL(source)
    const marker = '/wiki/File:'
    if (url.hostname === 'commons.wikimedia.org' && url.pathname.startsWith(marker)) {
      const filename = url.pathname.slice(marker.length)
      return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${filename}`
    }
  } catch {
    return source
  }
  return source
}
