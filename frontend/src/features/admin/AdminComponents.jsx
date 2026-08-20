import { useEffect, useId, useRef, useState } from 'react'

import { CheckIcon, CopyIcon } from '../../components/common/icons'
import { ADMIN_NAV_ITEMS, formatKicker } from './AdminUtils'
import { createPortal } from 'react-dom'

const ADMIN_ICON_PNG = {
  users: '/assets/admin-users.png',
  spark: '/assets/admin-models.png',
  shield: '/assets/admin-security.png',
  key: '/assets/admin-roles.png',
  activity: '/assets/admin-audit-log-cropped.png',
}

export function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  const png = ADMIN_ICON_PNG[name]
  if (png) return <img className="admin-png-icon" src={png} alt="" width={size} height={size} aria-hidden="true" />

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

export function AdminShell({ children }) {
  return (
    <div className="admin-shell admin-shell-embedded">
      <main className="admin-main-panel">{children}</main>
    </div>
  )
}

export function AdminSidebar({ activeSection, onSectionChange, onBackToChat, keycloak, isSidebarOpen, setIsSidebarOpen }) {
  const account = keycloak?.tokenParsed?.name || keycloak?.tokenParsed?.preferred_username || 'Utilisateur'
  const initials = account.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef(null)

  useEffect(() => {
    if (!isAccountMenuOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setIsAccountMenuOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsAccountMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isAccountMenuOpen])

  return (
    <aside className="admin-sidebar" aria-label="Navigation administration">
      <div className="admin-sidebar-header">
        <button className="admin-sidebar-brand" type="button" aria-label={isSidebarOpen ? 'Synapse' : 'Ouvrir la sidebar'} onClick={() => { if (!isSidebarOpen) setIsSidebarOpen(true) }}>
          <span className="admin-sidebar-logo" aria-hidden="true">
            <img className="admin-sidebar-logo-default" src="/assets/synapse-logo.png" alt="" />
            <img className="admin-sidebar-logo-hover" src="/assets/synapse-hover.png" alt="" />
          </span>
          <span>Synapse</span>
        </button>
        <button className="admin-sidebar-toggle" type="button" title={isSidebarOpen ? 'Réduire la sidebar' : 'Ouvrir la sidebar'} aria-label={isSidebarOpen ? 'Réduire la sidebar' : 'Ouvrir la sidebar'} aria-expanded={isSidebarOpen} onClick={() => setIsSidebarOpen((current) => !current)}>
          <img src="/assets/sidebar.png" alt="" />
        </button>
      </div>
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
        <div ref={accountMenuRef} className={`admin-account ${isAccountMenuOpen ? 'account-menu-open' : ''}`}>
          {isAccountMenuOpen && (
            <div className="account-popover admin-account-popover" role="menu">
              <button type="button" role="menuitem" onClick={() => keycloak?.logout?.({ redirectUri: window.location.origin })}>Se déconnecter</button>
            </div>
          )}
          <button
            type="button"
            className="admin-account-trigger"
            title="Compte"
            aria-label="Compte"
            aria-haspopup="menu"
            aria-expanded={isAccountMenuOpen}
            onClick={() => setIsAccountMenuOpen((current) => !current)}
          >
            <span className="admin-account-avatar" aria-hidden="true">{initials || '?'}</span>
            <span className="admin-account-copy"><strong>{account}</strong></span>
          </button>
        </div>
      </div>
    </aside>
  )
}

export function AdminPageHeader({ eyebrow, title, description, actions }) {
  return <header className="admin-page-header"><div><div className="admin-eyebrow">{formatKicker(eyebrow)}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="admin-page-actions">{actions}</div>}</header>
}

export function AdminToolbar({ children }) { return <div className="admin-toolbar">{children}</div> }

const STAT_ICON_PNG = {
  users: '/assets/admin-users.png',
  spark: '/assets/admin-models.png',
  shield: '/assets/admin-security.png',
  key: '/assets/admin-roles.png',
}

export function StatCard({ icon, label, value, context, tone = 'blue', onClick }) {
  const Tag = onClick ? 'button' : 'div'
  const iconPng = STAT_ICON_PNG[icon]
  return <Tag type={onClick ? 'button' : undefined} className={`admin-stat-card ${tone}`} onClick={onClick}><span className="admin-stat-icon">{iconPng ? <img src={iconPng} alt="" /> : <Icon name={icon} size={17} />}</span><span className="admin-stat-copy"><span>{label}</span><strong>{value}</strong><small>{context}</small></span></Tag>
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
  const backdropRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()

    // Lock the page behind the modal.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Because the modal is portalled directly into <body>, make every other
    // top-level app node inert while the modal is open. This prevents mouse,
    // touch and keyboard interaction with the sidebar/content behind it.
    const backdrop = backdropRef.current
    const backgroundNodes = Array.from(document.body.children).filter(
      (node) => node !== backdrop && !node.contains(backdrop),
    )

    const previousBackgroundState = backgroundNodes.map((node) => ({
      node,
      inert: node.inert,
      ariaHidden: node.getAttribute('aria-hidden'),
    }))

    backgroundNodes.forEach((node) => {
      node.inert = true
      node.setAttribute('aria-hidden', 'true')
    })

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow

      previousBackgroundState.forEach(({ node, inert, ariaHidden }) => {
        node.inert = inert

        if (ariaHidden === null) {
          node.removeAttribute('aria-hidden')
        } else {
          node.setAttribute('aria-hidden', ariaHidden)
        }
      })
    }
  }, [onClose])

  return createPortal(
    <div
      ref={backdropRef}
      className="admin-modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className={`admin-modal ${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="admin-modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>

          <button
            ref={closeRef}
            type="button"
            className="admin-icon-button"
            onClick={onClose}
            aria-label="Fermer"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {children}
      </section>
    </div>,
    document.body
  )
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirmer', onCancel, onConfirm, busy = false }) {
  return <Modal title={title} onClose={onCancel} size="small"><p className="admin-confirm-copy">{message}</p><div className="admin-modal-actions"><button type="button" className="admin-button secondary" onClick={onCancel} disabled={busy}>Annuler</button><button type="button" className="admin-button danger" onClick={onConfirm} disabled={busy}>{busy ? 'En cours…' : confirmLabel}</button></div></Modal>
}

export function CopyButton({ value, label = 'Copier', onCopied, onCopyError }) {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef(null)

  useEffect(() => () => window.clearTimeout(resetTimer.current), [])

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Le presse-papiers n’est pas disponible dans ce navigateur.')
      await navigator.clipboard.writeText(String(value || ''))
      setCopied(true)
      window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => setCopied(false), 1800)
      onCopied?.()
    } catch (error) {
      onCopyError?.(error)
    }
  }

  const accessibleLabel = copied ? 'Copié' : label
  return <button type="button" className={`admin-copy-button ${copied ? 'copied' : ''}`} title={accessibleLabel} aria-label={accessibleLabel} onClick={copy}>{copied ? <CheckIcon /> : <CopyIcon />}</button>
}

export function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return <div className="admin-pagination"><button type="button" disabled={page === 0} onClick={() => onChange(page - 1)}>Précédente</button><span>Page {page + 1} sur {totalPages}</span><button type="button" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>Suivante</button></div>
}
