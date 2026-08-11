import ModelCard from './ModelCard'

export default function ModelGallery({ disabled, models, onClose, onSelect }) {
  return (
    <div className="modal-overlay model-gallery-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="model-gallery"
        aria-labelledby="model-gallery-title"
        data-menu-root
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="model-gallery-header">
          <div>
            <span>Catalogue</span>
            <h2 id="model-gallery-title">Explorer les modèles</h2>
          </div>
          <button className="close-button" type="button" aria-label="Fermer l’explorateur" onClick={onClose}>
            <span className="close-icon" aria-hidden="true"></span>
          </button>
        </div>

        <div className="model-card-grid">
          {models.map((model) => (
            <ModelCard
              disabled={disabled}
              key={model.alias}
              model={model}
              onSelect={(alias) => {
                onSelect(alias)
                onClose()
              }}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
