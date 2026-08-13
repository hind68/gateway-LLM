export function hasAdminRole(token) {
  if (!token) return false
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(atob(base64).split('').map((character) => (
      `%${(`00${character.charCodeAt(0).toString(16)}`).slice(-2)}`
    )).join(''))
    const roles = JSON.parse(jsonPayload)?.realm_access?.roles
    return Array.isArray(roles) && roles.some((role) => String(role).toUpperCase() === 'ADMIN')
  } catch {
    return false
  }
}
export function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || '?'
}
