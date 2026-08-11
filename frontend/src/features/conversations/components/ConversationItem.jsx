import { cleanModelName, displayConversationTitle } from '../../../utils/modelMetadata'
import ConversationMenu from './ConversationMenu'

export default function ConversationItem({
  activeConversation,
  archiveConversation,
  conversation,
  deleteConversation,
  editingConversationId,
  editingTitle,
  openConversation,
  openMenuId,
  renameConversation,
  restoreConversation,
  saveInlineRename,
  setEditingConversationId,
  setEditingTitle,
  setIsAccountMenuOpen,
  setOpenMenuId,
  showArchived,
}) {
  const isGeneratingConversation = conversation.uiStatus === 'generating'
  const isUnread = conversation.uiStatus === 'completed_unread'
  const isEditing = editingConversationId === conversation.id

  return (
    <div className={`history-row ${activeConversation?.id === conversation.id ? 'active' : ''} ${isUnread ? 'unread' : ''}`}>
      {isEditing ? (
        <div className="history-item editing">
          <input
            autoFocus
            className="history-title-input"
            type="text"
            value={editingTitle}
            onBlur={() => saveInlineRename(conversation)}
            onChange={(event) => setEditingTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
              if (event.key === 'Escape') {
                setEditingConversationId(null)
                setEditingTitle('')
              }
            }}
          />
          <small className="model-badge">{cleanModelName(conversation.modelDisplayName, conversation.modelAlias)}</small>
        </div>
      ) : (
        <button className="history-item" type="button" onClick={() => openConversation(conversation)}>
          <span className="history-title">
            <span>{displayConversationTitle(conversation.title)}</span>
            {isGeneratingConversation && <InlineGeneratingIndicator />}
            {isUnread && !isGeneratingConversation && <span className="notification-dot" aria-label="Réponse prête"></span>}
          </span>
          <small className="model-badge">{cleanModelName(conversation.modelDisplayName, conversation.modelAlias)}</small>
        </button>
      )}
      <ConversationMenu
        id={`conversation-${conversation.id}`}
        isOpen={openMenuId === conversation.id}
        archiveLabel={showArchived || conversation.status === 'ARCHIVEE' ? 'Désarchiver' : 'Archiver'}
        onArchive={() => (showArchived || conversation.status === 'ARCHIVEE' ? restoreConversation(conversation) : archiveConversation(conversation))}
        onDelete={() => deleteConversation(conversation)}
        onOpen={() => {
          setIsAccountMenuOpen(false)
          setOpenMenuId((current) => (current === conversation.id ? null : conversation.id))
        }}
        onRename={() => renameConversation(conversation)}
      />
    </div>
  )
}

function InlineGeneratingIndicator() {
  return (
    <span className="inline-generating" aria-label="Génération en cours">
      <span></span>
      <span></span>
      <span></span>
    </span>
  )
}
