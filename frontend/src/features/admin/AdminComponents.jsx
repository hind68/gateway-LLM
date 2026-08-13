import { useEffect, useId, useRef } from 'react'

import { ADMIN_NAV_ITEMS } from './AdminUtils'

export function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.3 8.6-8 10-4.7-1.4-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.3 2.3 4.8-5" /></>,
    spark: <><path d="m12 3-1.3 5.7L5 10l5.7 1.3L12 17l1.3-5.7L19 10l-5.7-1.3L12 3Z" /><path d="m19 16-.6 2.4L16 19l2.4.6L19 22l.6-2.4L22 19l-2.4-.6L19 16Z" /></>,
    users: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" /><circle cx="9.5" cy="7" r="3.5" /><path d="M17 4.5a3.5 3.5 0 0 1 0 6.8M21 20v-1.5a4 4 0 0 0-2.5-3.7" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8m-2 2 2 2m-5 1 2 2" /></>,
    activity: <><path d="M3 12h4l2-7 4 14 2-7h6" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
    edit: <><path d="m4 16-.8 4.8L8 20l10.8-10.8a2.8 2.8 0 0 0-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M21 19V5a2 2 0 0 0-2-2h-5" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  }
  return <svg {...common}>{paths[name] || paths.grid}</svg>
}

export function AdminShell({ activeSection, onSectionChange, onBackToChat, keycloak, children }) {
  return (
    <div className="admin-shell">
      <AdminSidebar activeSection={activeSection} onSectionChange={onSectionChange} onBackToChat={onBackToChat} keycloak={keycloak} />
      <main className="admin-main-panel">{children}</main>
    </div>
  )
}

export function AdminSidebar({ activeSection, onSectionChange, onBackToChat, keycloak }) {
  const account = keycloak?.tokenParsed?.name || keycloak?.tokenParsed?.preferred_username || 'Utilisateur'
  const initials = account.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  return (
    <aside className="admin-sidebar" aria-label="Navigation administration">
      <div className="admin-sidebar-brand">
        <img src="/assets/synapse-logo.png" alt="" />
        <span>Synapse</span>
        <span className="admin-brand-tag">ADMIN</span>
      </div>
      <div className="admin-sidebar-label">Espace de travail</div>
      <nav className="admin-sidebar-nav" aria-label="Sections d'administration">
        {ADMIN_NAV_ITEMS.map((item) => (
          <button key={item.id} type="button" className={activeSection === item.id ? 'active' : ''} aria-current={activeSection === item.id ? 'page' : undefined} onClick={() => onSectionChange(item.id)}>
            <Icon name={item.icon} size={17} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="admin-sidebar-bottom">
        <button type="button" className="admin-back-chat" onClick={onBackToChat}><Icon name="arrow" size={16} /><span>Retour au chat</span></button>
        <div className="admin-account">
          <span className="admin-account-avatar" aria-hidden="true">{initials || '?'}</span>
          <span className="admin-account-copy"><strong>{account}</strong><small>Administrateur</small></span>
          <button type="button" className="admin-icon-button" title="Se déconnecter" aria-label="Se déconnecter" onClick={() => keycloak?.logout?.({ redirectUri: window.location.origin })}><Icon name="logout" size={16} /></button>
        </div>
      </div>
    </aside>
  )
}

export function AdminPageHeader({ eyebrow, title, description, actions }) {
  return <header className="admin-page-header"><div><div className="admin-eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="admin-page-actions">{actions}</div>}</header>
}

export function AdminToolbar({ children }) { return <div className="admin-toolbar">{children}</div> }

export function StatCard({ icon, label, value, context, tone = 'blue', onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return <Tag type={onClick ? 'button' : undefined} className={`admin-stat-card ${tone}`} onClick={onClick}><span className="admin-stat-icon"><Icon name={icon} size={17} /></span><span className="admin-stat-copy"><span>{label}</span><strong>{value}</strong><small>{context}</small></span></Tag>
}

export function StatusBadge({ status, label }) {
  const normalized = String(status || '').toLowerCase()
  const tone = normalized.includes('inact') || normalized.includes('error') || normalized.includes('block') || normalized.includes('delete') ? 'danger' : normalized.includes('warn') || normalized.includes('mask') || normalized.includes('update') ? 'warning' : normalized.includes('available') ? 'info' : 'success'
  return <span className={`status-badge ${tone}`}><span className="status-dot" aria-hidden="true" />{label || status || 'Inconnu'}</span>
}

export function EmptyState({ icon = 'grid', title, description, action }) { return <div className="admin-state"><span className="admin-state-icon"><Icon name={icon} size={22} /></span><strong>{title}</strong>{description && <p>{description}</p>}{action}</div> }

export function ErrorState({ message, onRetry }) { return <div className="admin-state admin-state-error"><span className="admin-state-icon">!</span><strong>Impossible de charger ces données</strong><p>{message || 'Un problème est survenu.'}</p>{onRetry && <button type="button" className="admin-button secondary" onClick={onRetry}>Réessayer</button>}</div> }

export function Skeleton({ rows = 3 }) { return <div className="admin-skeleton-list" aria-label="Chargement"><span className="sr-only">Chargement en cours</span>{Array.from({ length: rows }, (_, index) => <div key={index} className="admin-skeleton-row"><i /><span /><b /></div>)}</div> }

export function Modal({ title, description, children, onClose, size = 'medium' }) {
  const titleId = useId()
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className={`admin-modal ${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}><div className="admin-modal-header"><div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div><button ref={closeRef} type="button" className="admin-icon-button" onClick={onClose} aria-label="Fermer"><Icon name="close" size={18} /></button></div>{children}</section></div>
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirmer', onCancel, onConfirm, busy = false }) {
  return <Modal title={title} onClose={onCancel} size="small"><p className="admin-confirm-copy">{message}</p><div className="admin-modal-actions"><button type="button" className="admin-button secondary" onClick={onCancel} disabled={busy}>Annuler</button><button type="button" className="admin-button danger" onClick={onConfirm} disabled={busy}>{busy ? 'En cours…' : confirmLabel}</button></div></Modal>
}

export function Toast({ message, tone = 'success', onClose }) {
  if (!message) return null
  return <div className={`admin-toast ${tone}`} role={tone === 'error' ? 'alert' : 'status'}><span>{tone === 'error' ? '!' : '✓'}</span><p>{message}</p><button type="button" onClick={onClose} aria-label="Fermer"><Icon name="close" size={15} /></button></div>
}

export function CopyButton({ value, label = 'Copier' }) {
  return <button type="button" className="admin-copy-button" title={label} aria-label={label} onClick={() => navigator.clipboard?.writeText(String(value || ''))}><Icon name="copy" size={14} /></button>
}

export function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return <div className="admin-pagination"><button type="button" disabled={page === 0} onClick={() => onChange(page - 1)}>Précédente</button><span>Page {page + 1} sur {totalPages}</span><button type="button" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>Suivante</button></div>
}
