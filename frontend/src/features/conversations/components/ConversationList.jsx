import ConversationItem from './ConversationItem'

export default function ConversationList({
  activeConversation,
  conversations,
  historyError,
  isLoadingHistory,
  loadConversations,
  openConversation,
  openMenuId,
  setIsAccountMenuOpen,
  setOpenMenuId,
  archiveConversation,
  deleteConversation,
  renameConversation,
  restoreConversation,
  showArchived,
  editingConversationId,
  editingTitle,
  saveInlineRename,
  setEditingConversationId,
  setEditingTitle,
}) {
  return (
    <>
      {historyError && (
        <div className="history-error">
          <span className="history-error-icon" aria-hidden="true">↻</span>
          <span>{historyError}</span>
          <button type="button" onClick={loadConversations}>Réessayer</button>
        </div>
      )}

      <div className="history">
        {isLoadingHistory && <div className="history-empty">Chargement...</div>}
        {!isLoadingHistory && !historyError && conversations.length === 0 && (
          <div className="history-empty">
            {showArchived ? 'Aucune conversation archivée' : 'Aucune conversation'}
          </div>
        )}
        {conversations.map((conversation) => (
          <ConversationItem
            activeConversation={activeConversation}
            archiveConversation={archiveConversation}
            conversation={conversation}
            deleteConversation={deleteConversation}
            editingConversationId={editingConversationId}
            editingTitle={editingTitle}
            key={conversation.id}
            openConversation={openConversation}
            openMenuId={openMenuId}
            renameConversation={renameConversation}
            restoreConversation={restoreConversation}
            saveInlineRename={saveInlineRename}
            setEditingConversationId={setEditingConversationId}
            setEditingTitle={setEditingTitle}
            setIsAccountMenuOpen={setIsAccountMenuOpen}
            setOpenMenuId={setOpenMenuId}
            showArchived={showArchived}
          />
        ))}
      </div>
    </>
  )
}
