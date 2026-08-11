import ModelFilterDropdown from '../../models/components/ModelFilterDropdown'
import ArchiveTabs from './ArchiveTabs'
import { cleanModelName, displayConversationTitle } from '../../../utils/modelMetadata'

export default function SearchModal({
  conversations,
  inputRef,
  isLoadingHistory,
  modelFilter,
  models,
  onClose,
  openConversation,
  search,
  setModelFilter,
  setSearch,
  setShowArchived,
  showArchived,
}) {
  const visibleConversations = modelFilter
    ? conversations.filter((conversation) => conversation.modelAlias === modelFilter)
    : conversations

  return (
    <div className="modal-overlay search-modal-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="search-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="search-modal-header">
          <h2 id="search-modal-title">Rechercher</h2>
          <button type="button" aria-label="Fermer la recherche" onClick={onClose}>
            <span className="close-icon" aria-hidden="true"></span>
          </button>
        </div>
        <input
          ref={inputRef}
          className="search-modal-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault()
          }}
          placeholder="Rechercher une conversation"
        />
        <div className="search-modal-filters">
          <ArchiveTabs showArchived={showArchived} setShowArchived={setShowArchived} />
          <ModelFilterDropdown modelFilter={modelFilter} models={models} setModelFilter={setModelFilter} />
        </div>
        <div className="search-results" role="listbox" aria-label="Résultats de recherche">
          {isLoadingHistory && <div className="search-result-empty">Recherche...</div>}
          {!isLoadingHistory && visibleConversations.length === 0 && (
            <div className="search-result-empty">Aucune conversation trouvée</div>
          )}
          {!isLoadingHistory && visibleConversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className="search-result-row"
              role="option"
              onClick={async () => {
                await openConversation(conversation)
                onClose()
              }}
            >
              <span>{displayConversationTitle(conversation.title)}</span>
              <small>{cleanModelName(conversation.modelDisplayName, conversation.modelAlias)}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
