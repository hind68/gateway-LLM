import { modelProviderName } from '../../../utils/modelMetadata'

export default function ModelSelector({ activeModel, activeModelAlias, disabled, isOpen, models, onToggle, onSelect }) {
  return (
    <div className="model-switcher" data-menu-root>
      <button
        className="model-button"
        type="button"
        onClick={onToggle}
        disabled={disabled}
      >
        <span>{activeModel?.displayName || (activeModelAlias ? `Modèle indisponible (${activeModelAlias})` : 'Modèle')}</span>
        <span className="model-arrow" aria-hidden="true"></span>
      </button>
      {isOpen && (
        <div className="model-menu" role="menu">
          {models.map((model) => (
            <button key={model.alias} type="button" role="menuitem" onClick={() => onSelect(model.alias)}>
              <strong>{model.displayName}</strong>
              <span>{modelProviderName(model.alias)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
