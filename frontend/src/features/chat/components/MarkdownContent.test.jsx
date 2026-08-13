import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import MarkdownContent, { isRenderableMarkdownImageUrl } from './MarkdownContent'

describe('MarkdownContent images', () => {
  it('renders valid http images with responsive-safe attributes', () => {
    const html = renderMarkdown('![Diagram](https://example.com/diagram.png "Architecture")')

    expect(html).toContain('<img')
    expect(html).toContain('src="https://example.com/diagram.png"')
    expect(html).toContain('alt="Diagram"')
    expect(html).toContain('title="Architecture"')
    expect(html).not.toContain('markdown-image-fallback')
  })

  it('renders an unavailable image fallback for invalid image URLs', () => {
    const html = renderMarkdown('![Broken diagram](not-a-url)')

    expect(html).toContain('markdown-image-fallback')
    expect(html).toContain('Image indisponible')
    expect(html).toContain('Broken diagram')
    expect(html).not.toContain('<img')
  })

  it('renders an unavailable image fallback for non-http URLs', () => {
    const html = renderMarkdown('![Local file](file:///secret.png)')

    expect(html).toContain('markdown-image-fallback')
    expect(html).toContain('Local file')
    expect(html).not.toContain('<img')
  })

  it('keeps image URL validation limited to valid http and https URLs', () => {
    expect(isRenderableMarkdownImageUrl('/assets/test.png')).toBe(true)
    expect(isRenderableMarkdownImageUrl('https://example.com/image.png')).toBe(true)
    expect(isRenderableMarkdownImageUrl('http://example.com/image.png')).toBe(true)
    expect(isRenderableMarkdownImageUrl('javascript:alert(1)')).toBe(false)
    expect(isRenderableMarkdownImageUrl('data:image/png;base64,abc')).toBe(false)
    expect(isRenderableMarkdownImageUrl('')).toBe(false)
    expect(isRenderableMarkdownImageUrl('ftp://example.com/image.png')).toBe(false)
    expect(isRenderableMarkdownImageUrl('not a url')).toBe(false)
  })
})

function renderMarkdown(content) {
  return renderToStaticMarkup(
    <MarkdownContent
      content={content}
      copiedKey=""
      direction="ltr"
      onCopy={vi.fn()}
      setCopiedKey={vi.fn()}
    />,
  )
}
