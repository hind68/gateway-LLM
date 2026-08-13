import { useCallback, useEffect, useRef, useState } from 'react'
import ChatComposer from '../chat/components/ChatComposer'
import DocumentInspectorPanel from '../chat/components/DocumentInspectorPanel'
import ChatThread from '../chat/components/ChatThread'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import Toast from '../../components/common/Toast'
import ModelGallery from '../models/components/ModelGallery'
import ModelSelector from '../models/components/ModelSelector'
import ConversationMenu from '../conversations/components/ConversationMenu'
import SearchModal from '../conversations/components/SearchModal'
import AdminDashboard from '../admin/AdminDashboard'
import Sidebar from './Sidebar'
import { displayConversationTitle } from '../../utils/modelMetadata'

const INSPECTOR_MIN_WIDTH = 400
const INSPECTOR_MAX_WIDTH = 900
const INSPECTOR_DEFAULT_WIDTH = 560

export default function AppLayout({
  layout,
  sidebar,
  chat,
  models,
  conversations,
  feedback,
  admin, // <-- Added admin here
}) {
  const { state, filters, editing, dialogs, actions, status } = conversations
  const activeConversation = state.activeConversation
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [inspectedDocument, setInspectedDocument] = useState(null)
  const [isInspectorClosing, setIsInspectorClosing] = useState(false)
  const [inspectorWidth, setInspectorWidth] = useState(INSPECTOR_DEFAULT_WIDTH)
  const dragDepthRef = useRef(0)
  const resizeFrameRef = useRef(0)
  const closeInspectorTimerRef = useRef(0)
  const previousConversationIdRef = useRef(activeConversation?.id)

  const closeInspector = useCallback(() => {
    if (!inspectedDocument) return
    window.clearTimeout(closeInspectorTimerRef.current)
    setIsInspectorClosing(true)
    closeInspectorTimerRef.current = window.setTimeout(() => {
      setInspectedDocument(null)
      setIsInspectorClosing(false)
    }, 230)
  }, [inspectedDocument])

  const openInspector = useCallback((document) => {
    window.clearTimeout(closeInspectorTimerRef.current)
    setIsInspectorClosing(false)
    setInspectedDocument(normalizeInspectionTarget(document, activeConversation?.id))
  }, [activeConversation?.id])

  const attachSecureVersion = useCallback((file) => {
    chat.addAttachments([file])
    feedback.showNotice('Version sécurisée ajoutée aux pièces jointes')
    closeInspector()
    window.requestAnimationFrame(() => chat.textareaRef.current?.focus())
  }, [chat, closeInspector, feedback])

  useEffect(() => () => window.clearTimeout(closeInspectorTimerRef.current), [])

  useEffect(() => {
    const conversationId = activeConversation?.id
    if (previousConversationIdRef.current !== conversationId) {
      queueMicrotask(closeInspector)
      previousConversationIdRef.current = conversationId
    }
  }, [activeConversation?.id, closeInspector])

  const containsFiles = useCallback((event) => (
    Array.from(event.dataTransfer?.types || []).includes('Files')
  ), [])

  const handleDragEnter = useCallback((event) => {
    if (!containsFiles(event)) return
    event.preventDefault()
    dragDepthRef.current += 1
    setIsDraggingFiles(true)
  }, [containsFiles])

  const handleDragOver = useCallback((event) => {
    if (!containsFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [containsFiles])

  const handleDragLeave = useCallback((event) => {
    if (!containsFiles(event)) return
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDraggingFiles(false)
    }
  }, [containsFiles])

  const handleDrop = useCallback((event) => {
    if (!containsFiles(event)) return
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDraggingFiles(false)
    if (status.isGenerating) return
    chat.addAttachments(event.dataTransfer.files)
  }, [chat, containsFiles, status.isGenerating])

  const handleInspectorResizePointerDown = useCallback((event) => {
    event.preventDefault()
    const pointerId = event.pointerId
    const startX = event.clientX
    const startWidth = inspectorWidth
    const maxWidth = Math.min(INSPECTOR_MAX_WIDTH, Math.floor(window.innerWidth * 0.72))

    function handlePointerMove(moveEvent) {
      const delta = moveEvent.clientX - startX
      const nextWidth = Math.min(maxWidth, Math.max(INSPECTOR_MIN_WIDTH, startWidth - delta))
      cancelAnimationFrame(resizeFrameRef.current)
      resizeFrameRef.current = requestAnimationFrame(() => setInspectorWidth(nextWidth))
    }

    function handlePointerUp() {
      cancelAnimationFrame(resizeFrameRef.current)
      document.body.classList.remove('is-resizing-inspector')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }

    document.body.classList.add('is-resizing-inspector')
    event.currentTarget.setPointerCapture?.(pointerId)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }, [inspectorWidth])

  if (admin?.showAdminDashboard) {
    return <AdminDashboard onError={admin.onError} onNotice={admin.onNotice} onBackToChat={() => admin.setShowAdminDashboard(false)} />
  }

  return (
    <div className={`app-shell ${layout.isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <Sidebar
        activeConversation={activeConversation}
        admin={admin} // <-- Passed admin to Sidebar
        archiveConversation={actions.archiveConversation}
        closeSidebarPanels={layout.closeSidebarPanels}
        closeTransientMenus={layout.closeTransientMenus}
        collapsedPanel={layout.collapsedPanel}
        conversations={state.conversations}
        deleteConversation={actions.deleteConversation}
        editingConversationId={editing.editingConversationId}
        editingTitle={editing.editingTitle}
        historyError={state.historyError}
        isAccountMenuOpen={layout.isAccountMenuOpen}
        isLoadingHistory={state.isLoadingHistory}
        isModelsView={layout.isModelsView}
        isSearchModalOpen={layout.isSearchModalOpen}
        isSidebarOpen={layout.isSidebarOpen}
        loadConversations={actions.loadConversations}
        newConversation={actions.newConversation}
        openConversation={actions.openConversation}
        openMenuId={layout.openMenuId}
        renameConversation={actions.renameConversation}
        restoreConversation={actions.restoreConversation}
        saveInlineRename={actions.saveInlineRename}
        setActiveView={layout.setActiveView}
        setCollapsedPanel={layout.setCollapsedPanel}
        setEditingConversationId={editing.setEditingConversationId}
        setEditingTitle={editing.setEditingTitle}
        setIsAccountMenuOpen={layout.setIsAccountMenuOpen}
        setIsSearchModalOpen={layout.setIsSearchModalOpen}
        setIsSidebarOpen={layout.setIsSidebarOpen}
        setModelFilter={filters.setModelFilter}
        setOpenMenuId={layout.setOpenMenuId}
        setSearch={filters.setSearch}
        setShowArchived={filters.setShowArchived}
        setShowTabs={sidebar.setShowTabs}
        showArchived={state.showArchived}
        showTabs={sidebar.showTabs}
        toggleCollapsedPanel={layout.toggleCollapsedPanel}
        toggleSidebar={layout.toggleSidebar}
      />

      {layout.isSearchModalOpen && (
        <SearchModal
          inputRef={layout.searchInputRef}
          conversations={state.conversations}
          isLoadingHistory={state.isLoadingHistory}
          modelFilter={state.modelFilter}
          models={models.models}
          onClose={() => layout.setIsSearchModalOpen(false)}
          openConversation={actions.openConversation}
          search={state.search}
          setModelFilter={filters.setModelFilter}
          setSearch={filters.setSearch}
          setShowArchived={filters.setShowArchived}
          showArchived={state.showArchived}
        />
      )}

      <div className="chat-workspace">
      <main
        className={`chat-main ${
          admin?.showAdminDashboard
            ? 'admin-main'
            : chat.hasActiveMessages
              ? 'conversation-mode'
              : 'welcome-mode'
        } ${isDraggingFiles ? 'is-dragging-files' : ''}`}
        style={chat.goBottomTop == null ? undefined : { '--go-bottom-top': `${chat.goBottomTop}px` }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDraggingFiles && (
          <div className="drag-drop-overlay" aria-live="polite">
            <div className="drag-drop-card">
              <span className="drag-drop-icon" aria-hidden="true"></span>
              <strong>Glissez-déposez vos fichiers ici</strong>
            </div>
          </div>
        )}
        <header className="chat-header">
          {admin?.showAdminDashboard ? (
            <>
              <div className="admin-header-title">
                <span className="admin-header-eyebrow">Synapse</span>
                <h1>Administration</h1>
              </div>

              <div className="header-controls">
                <button
                  type="button"
                  className="admin-back-button"
                  onClick={() => admin.setShowAdminDashboard(false)}
                >
                  ← Retour au chat
                </button>
              </div>
            </>
          ) : (
            <div className="header-controls">
              <ModelSelector
                activeModel={models.activeModel}
                activeModelAlias={models.activeModelAlias}
                disabled={status.isGenerating || models.isLoadingModels}
                isOpen={layout.isModelMenuOpen}
                models={models.models}
                onSelect={actions.selectModel}
                onToggle={() => {
                  layout.setIsAccountMenuOpen(false)
                  layout.setIsModelMenuOpen((current) => !current)
                }}
              />

              {activeConversation && (
                <ConversationMenu
                  id="header-conversation-menu"
                  isOpen={layout.isHeaderMenuOpen}
                  archiveLabel={activeConversation.status === 'ARCHIVEE' ? 'Désarchiver' : 'Archiver'}
                  onArchive={() => (activeConversation.status === 'ARCHIVEE' ? actions.restoreConversation(activeConversation) : actions.archiveConversation(activeConversation))}
                  onDelete={() => actions.deleteConversation(activeConversation)}
                  onOpen={() => {
                    layout.setIsAccountMenuOpen(false)
                    layout.setIsHeaderMenuOpen((current) => !current)
                  }}
                  onRename={() => actions.renameConversation(activeConversation)}
                />
              )}
            </div>
          )}
        </header>

        {admin?.showAdminDashboard ? (
          <AdminDashboard
            onError={admin.onError}
            onNotice={admin.onNotice}
          />
        ) : (
          <>
        {layout.isModelsView && (
          <ModelGallery
            disabled={status.isGenerating}
            models={models.models}
            onClose={() => layout.setActiveView('chat')}
            onSelect={actions.selectModel}
          />
        )}

        <ChatThread
          activeModelAlias={models.activeModelAlias}
          activeModelName={models.activeModel?.displayName || models.modelDisplayName(models.activeModelAlias)}
          bottomRef={chat.bottomRef}
          copiedKey={chat.copiedKey}
          goToBottom={chat.goToBottom}
          hasActiveMessages={chat.hasActiveMessages}
          isComposerTransitioning={chat.isComposerTransitioning}
          isGenerating={status.isGenerating}
          isLastBlockVisible={chat.isLastBlockVisible}
          messages={chat.messages}
          messagesRef={chat.messagesRef}
          onCopy={chat.onCopy}
          onInspectDocument={openInspector}
          onSendSecureMessage={actions.sendSecureMessage}
          onMessagesScroll={chat.onMessagesScroll}
          setCopiedKey={chat.setCopiedKey}
          welcomeComposer={!chat.hasActiveMessages ? (
            <ChatComposer
              attachments={chat.attachments}
              canSend={chat.canSend}
              composerRef={chat.composerRef}
              draft={chat.draft}
              hasActiveMessages={chat.hasActiveMessages}
              isComposerMaxed={chat.isComposerMaxed}
              isGenerating={status.isGenerating}
              onDraftChange={chat.setDraft}
              onFilesSelected={chat.addAttachments}
              onInspectDocument={openInspector}
              onKeyDown={chat.handleKeyDown}
              onRemoveFile={chat.removeAttachment}
              onRemoveFiles={chat.clearAttachments}
              onStop={chat.stopGeneration}
              onSubmit={actions.sendMessage}
              textareaRef={chat.textareaRef}
            />
          ) : null}
        />

        {chat.hasActiveMessages && (
          <ChatComposer
            attachments={chat.attachments}
            canSend={chat.canSend}
            composerRef={chat.composerRef}
            draft={chat.draft}
            hasActiveMessages={chat.hasActiveMessages}
            isComposerMaxed={chat.isComposerMaxed}
            isGenerating={status.isGenerating}
            onDraftChange={chat.setDraft}
            onFilesSelected={chat.addAttachments}
            onInspectDocument={openInspector}
            onKeyDown={chat.handleKeyDown}
            onRemoveFile={chat.removeAttachment}
            onRemoveFiles={chat.clearAttachments}
            onStop={chat.stopGeneration}
            onSubmit={actions.sendMessage}
            textareaRef={chat.textareaRef}
          />
        )}
          </>
        )}

        <Toast
          chatError={feedback.chatError}
          chatNotice={feedback.chatNotice}
          onClose={feedback.onClearToast}
        />
      </main>

      {inspectedDocument && (
        <>
          <div
            className="document-panel-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionner le panneau d'inspection"
            tabIndex={0}
            onPointerDown={handleInspectorResizePointerDown}
          />
          <DocumentInspectorPanel
            attachment={inspectedDocument}
            closing={isInspectorClosing}
            conversationId={activeConversation?.id}
            key={`${inspectedDocument.attachment?.id || inspectedDocument.id || inspectedDocument.attachment?.filename || inspectedDocument.filename || inspectedDocument.name}-${inspectedDocument.mode || 'view'}`}
            onAttachSecure={attachSecureVersion}
            onClose={closeInspector}
            width={inspectorWidth}
          />
        </>
      )}
      </div>

      {dialogs.modelDecision && (
        <div className="decision-backdrop" role="presentation">
          <div className="decision-box" role="dialog" aria-modal="true" aria-labelledby="model-decision-title">
            <h2 id="model-decision-title">Changer de modèle ?</h2>
            <p>Cette conversation utilise actuellement {models.modelDisplayName(activeConversation?.modelAlias)}. Que souhaitez-vous faire avec {models.modelDisplayName(dialogs.modelDecision.alias)} ?</p>
            <div className="decision-actions">
              <button type="button" onClick={() => actions.openNewConversationWithModel(dialogs.modelDecision.alias)}>
                Ouvrir une nouvelle conversation
              </button>
              <button type="button" onClick={() => actions.continueWithModel(dialogs.modelDecision.alias)}>
                Continuer cette conversation
              </button>
              <button type="button" className="secondary" onClick={() => dialogs.setModelDecision(null)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogs.pendingDeleteConversation && (
        <ConfirmDialog
          title="Supprimer la conversation ?"
          message={`La conversation "${displayConversationTitle(dialogs.pendingDeleteConversation.title)}" sera supprimée définitivement.`}
          confirmLabel="Confirmer"
          cancelLabel="Annuler"
          onCancel={() => dialogs.setPendingDeleteConversation(null)}
          onConfirm={actions.confirmDeleteConversation}
        />
      )}
    </div>
  )
}

function normalizeInspectionTarget(target, conversationId) {
  const attachment = target?.attachment || target
  const requestedView = target?.requestedView || normalizeRequestedView(target?.mode)
  return {
    ...target,
    attachment,
    attachmentId: target?.attachmentId || attachment?.id,
    conversationId,
    requestedView,
    mode: requestedView,
  }
}

function normalizeRequestedView(mode) {
  if (mode === 'inspect' || mode === 'detected') return 'detected'
  if (mode === 'secure') return 'secure'
  return 'original'
}
