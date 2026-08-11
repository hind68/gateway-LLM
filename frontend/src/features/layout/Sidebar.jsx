import { useContext } from 'react'
import { getInitials } from '../../utils/authUtils'
import { AuthContext } from '../../AuthProvider'
import ArchiveTabs from '../conversations/components/ArchiveTabs'
import ConversationList from '../conversations/components/ConversationList'

export default function Sidebar({
  activeConversation,
  admin,
  archiveConversation,
  closeSidebarPanels,
  closeTransientMenus,
  collapsedPanel,
  conversations,
  deleteConversation,
  editingConversationId,
  editingTitle,
  historyError,
  isAccountMenuOpen,
  isModelsView,
  isSearchModalOpen,
  isSidebarOpen,
  isLoadingHistory,
  loadConversations,
  newConversation,
  openConversation,
  openMenuId,
  renameConversation,
  restoreConversation,
  saveInlineRename,
  setActiveView,
  setCollapsedPanel,
  setEditingConversationId,
  setEditingTitle,
  setIsAccountMenuOpen,
  setIsSearchModalOpen,
  setIsSidebarOpen,
  setModelFilter,
  setOpenMenuId,
  setSearch,
  setShowArchived,
  setShowTabs,
  showArchived,
  showTabs,
  toggleCollapsedPanel,
  toggleSidebar,
}) {
  const keycloak = useContext(AuthContext)
  const displayName =
    keycloak?.tokenParsed?.name ||
    keycloak?.tokenParsed?.preferred_username ||
    'Utilisateur'
  const initials = getInitials(displayName)

  const historyListProps = {
    activeConversation,
    archiveConversation,
    conversations,
    deleteConversation,
    editingConversationId,
    editingTitle,
    historyError,
    isLoadingHistory,
    loadConversations,
    openMenuId,
    renameConversation,
    restoreConversation,
    saveInlineRename,
    setEditingConversationId,
    setEditingTitle,
    setIsAccountMenuOpen,
    setOpenMenuId,
    showArchived,
  }

  const handleAdminClick = () => {
    setIsAccountMenuOpen(false)
    admin?.setShowAdminDashboard(true)
  }

  return (
    <>
      {isSidebarOpen && <button className="mobile-overlay" type="button" aria-label="Fermer" onClick={toggleSidebar} />}

      <aside className="sidebar" aria-label="Navigation Synapse" data-menu-root>
        <div className="sidebar-header">
          <button
            className="sidebar-brand"
            type="button"
            aria-label={isSidebarOpen ? 'Synapse' : 'Ouvrir la sidebar'}
            onClick={() => {
              if (!isSidebarOpen) {
                closeSidebarPanels()
                setIsSidebarOpen(true)
              }
            }}
          >
            <span className="sidebar-logo" aria-hidden="true">
              <img className="sidebar-logo-default" src="/assets/synapse-logo.png" alt="" />
              <img className="sidebar-logo-hover" src="/assets/synapse-hover.png" alt="" />
            </span>
            <span>Synapse</span>
          </button>
          <button
            className="sidebar-toggle"
            type="button"
            title={isSidebarOpen ? 'Réduire la sidebar' : 'Ouvrir la sidebar'}
            aria-label={isSidebarOpen ? 'Réduire la sidebar' : 'Ouvrir la sidebar'}
            aria-expanded={isSidebarOpen}
            onClick={toggleSidebar}
          >
            <img src="/assets/sidebar.png" alt="" />
          </button>
        </div>

        <nav className="sidebar-navigation" aria-label="Actions principales">
          <div className="sidebar-primary-nav">
            <button type="button" title="Nouvelle conversation" aria-label="Nouvelle conversation" onClick={() => { closeSidebarPanels(); newConversation() }}>
              <span className="sidebar-icon" aria-hidden="true">
                <img src="/assets/new-tab.png" alt="" />
              </span>
              <span>Nouvelle conversation</span>
            </button>
            <button
              className={isSearchModalOpen ? 'active' : ''}
              type="button"
              title="Rechercher"
              aria-label="Rechercher"
              onClick={() => {
                setIsSearchModalOpen(true)
                if (isSidebarOpen) {
                  setIsAccountMenuOpen(false)
                  setActiveView('chat')
                  setCollapsedPanel(null)
                } else {
                  setCollapsedPanel(null)
                }
              }}
            >
              <span className="sidebar-icon" aria-hidden="true">
                <img src="/assets/search.png" alt="" />
              </span>
              <span>Rechercher</span>
            </button>
            <button
              className={isModelsView ? 'active' : ''}
              type="button"
              title="Explorer les modèles"
              aria-label="Explorer les modèles"
              onClick={() => {
                closeTransientMenus()
                setIsAccountMenuOpen(false)
                setActiveView((current) => (current === 'models' ? 'chat' : 'models'))
              }}
            >
              <span className="sidebar-icon" aria-hidden="true">
                <img src="/assets/compass.png" alt="" />
              </span>
              <span>Explorer les modèles</span>
            </button>
          </div>
          <button
            className={`recent-nav-button ${collapsedPanel === 'history' ? 'active' : ''}`}
            type="button"
            title="Discussions récentes"
            aria-label="Discussions récentes"
            onClick={() => {
              setShowArchived(false)
              if (isSidebarOpen) {
                setIsAccountMenuOpen(false)
                setActiveView('chat')
                setCollapsedPanel(null)
                setModelFilter('')
                setSearch('')
                setOpenMenuId(null)
              } else {
                toggleCollapsedPanel('history')
              }
            }}
          >
            <span className="sidebar-icon" aria-hidden="true">
              <img src="/assets/message.png" alt="" />
            </span>
            <span>Discussions récentes</span>
          </button>
        </nav>

        <section className="recent-section">
          <div className="history-heading">
            <span>Récents</span>
            <button
              type="button"
              className="archive-toggle"
              title={showTabs ? 'Masquer les filtres archivés' : 'Afficher les filtres archivés'}
              aria-label={showTabs ? 'Masquer les filtres archivés' : 'Afficher les filtres archivés'}
              aria-expanded={showTabs}
              onClick={() => setShowTabs(!showTabs)}
            >
              <img src="/assets/archive.png" alt="" aria-hidden="true" />
            </button>
          </div>

          {showTabs && <ArchiveTabs showArchived={showArchived} setShowArchived={setShowArchived} />}

          <ConversationList
            {...historyListProps}
            openConversation={openConversation}
          />
        </section>

        <div className="sidebar-user" data-menu-root>
          <button
            type="button"
            title="Compte"
            aria-label="Compte"
            onClick={() => {
              closeTransientMenus()
              setIsAccountMenuOpen((current) => !current)
            }}
          >
            <span className="user-avatar-wrapper">
              <span className="user-avatar">{initials}</span>
            </span>
            <span className="user-copy">
              <strong>{displayName}</strong>
            </span>
          </button>
          {isSidebarOpen && isAccountMenuOpen && (
            <AccountPopover admin={admin} onAdminClick={handleAdminClick} />
          )}
        </div>
      </aside>

      {!isSidebarOpen && isAccountMenuOpen && (
        <AccountPopover className="account-popover-collapsed" admin={admin} onAdminClick={handleAdminClick} />
      )}

      {!isSidebarOpen && collapsedPanel && (
        <div className="collapsed-panel" data-menu-root>
          <div className="collapsed-panel-header">
            <strong>{collapsedPanel === 'history' ? 'Discussions récentes' : 'Rechercher'}</strong>
          </div>

          {(collapsedPanel === 'search' || collapsedPanel === 'history') && (
            <ArchiveTabs showArchived={showArchived} setShowArchived={setShowArchived} />
          )}
          <ConversationList
            {...historyListProps}
            openConversation={async (conversation) => {
              await openConversation(conversation)
              setCollapsedPanel(null)
            }}
          />
        </div>
      )}
    </>
  )
}

function AccountPopover({ className = 'account-popover-open', admin, onAdminClick }) {
  const keycloak = useContext(AuthContext)

  return (
    <div className={`account-popover ${className}`} role="menu" data-menu-root>
      {admin?.isAdmin && (
        <button type="button" role="menuitem" onClick={onAdminClick}>
          Administration
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        onClick={() => keycloak?.logout({ redirectUri: window.location.origin })}
      >
        Se deconnecter
      </button>
    </div>
  )
}
