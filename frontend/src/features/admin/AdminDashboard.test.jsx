import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RolesSection } from './AdminDashboard'

const baseProps = {
  errorFor: () => '',
  roles: ['EXTERN'],
  rolesLoading: false,
  rolesError: '',
  onRetryRoles: vi.fn(),
  role: 'EXTERN',
  setRole: vi.fn(),
  restrictions: [],
  bannedWords: [],
  models: [],
  selectedModel: '',
  setSelectedModel: vi.fn(),
  word: '',
  setWord: vi.fn(),
  onAddRestriction: vi.fn(),
  onRemoveRestriction: vi.fn(),
  onAddWord: vi.fn(),
  onRemoveWord: vi.fn(),
}

describe('RolesSection', () => {
  it('shows role controls after role details finish loading', () => {
    const html = renderToStaticMarkup(<RolesSection {...baseProps} loading={false} />)

    expect(html).toContain('Modèles restreints')
    expect(html).toContain('Mots bannis')
    expect(html).not.toContain('admin-skeleton-list')
  })

  it('shows a skeleton only while role details are loading', () => {
    const html = renderToStaticMarkup(<RolesSection {...baseProps} loading />)

    expect(html).toContain('admin-skeleton-list')
  })
})
