import { describe, expect, it } from 'vitest'
import { hasAdminRole } from './authUtils'

function tokenWithRoles(roles) {
  const encode = (value) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'none' })}.${encode({ realm_access: { roles } })}.signature`
}

describe('auth utilities', () => {
  it('recognizes Keycloak ADMIN realm roles case-insensitively', () => {
    expect(hasAdminRole(tokenWithRoles(['ADMIN', 'USER']))).toBe(true)
    expect(hasAdminRole(tokenWithRoles(['admin']))).toBe(true)
  })

  it('does not grant administration to regular users or malformed tokens', () => {
    expect(hasAdminRole(tokenWithRoles(['USER']))).toBe(false)
    expect(hasAdminRole('not-a-token')).toBe(false)
  })
})
