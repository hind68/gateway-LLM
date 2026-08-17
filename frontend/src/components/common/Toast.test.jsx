import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import Toast from './Toast'

describe('Toast', () => {
  it('renders every active notification in one vertical stack', () => {
    const html = renderToStaticMarkup(
      <Toast
        notifications={[
          { id: 1, kind: 'success', message: 'Modèle ajouté' },
          { id: 2, kind: 'error', message: 'Test indisponible' },
        ]}
        onClose={vi.fn()}
      />,
    )

    expect(html).toContain('toast-stack')
    expect(html).toContain('Modèle ajouté')
    expect(html).toContain('Test indisponible')
    expect(html.match(/inline-error/g)).toHaveLength(2)
  })
})
