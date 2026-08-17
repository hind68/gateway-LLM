import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import ModelLogo from './ModelLogo'
import { normalizeModelLogoUrl } from './modelLogoUrl'

describe('ModelLogo', () => {
  it('prefers the configured logo URL over the built-in alias logo', () => {
    const html = renderToStaticMarkup(
      <ModelLogo alias="secure-gpt" logoUrl="https://cdn.example.test/custom.png" className="logo" fallback="GP" />,
    )

    expect(html).toContain('src="https://cdn.example.test/custom.png"')
    expect(html).not.toContain('/assets/chatgpt-logo.png')
  })

  it('supports an embedded local logo', () => {
    const logo = 'data:image/png;base64,iVBORw0KGgo='
    const html = renderToStaticMarkup(<ModelLogo alias="custom" logoUrl={logo} fallback="CU" />)

    expect(html).toContain(`src="${logo}"`)
  })

  it('converts Wikimedia file pages to direct image redirects', () => {
    expect(normalizeModelLogoUrl('https://commons.wikimedia.org/wiki/File:Claude-ai-icon.svg'))
      .toBe('https://commons.wikimedia.org/wiki/Special:Redirect/file/Claude-ai-icon.svg')
  })
})
