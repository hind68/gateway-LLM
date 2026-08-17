import ModelLogo from './ModelLogo'
import { modelCardMeta } from '../../../utils/modelMetadata'

export default function ModelCard({ disabled, model, onSelect }) {
  const meta = modelCardMeta(model.alias)

  return (
    <button
      className="model-card"
      type="button"
      onClick={() => onSelect(model.alias)}
      disabled={disabled}
    >
      <div className={`model-card-visual ${meta.tone}`} aria-hidden="true">
        <ModelLogo alias={model.alias} logoUrl={model.logoUrl} className="model-card-logo" fallback={meta.initials} />
      </div>
      <div className="model-card-copy">
        <h3>{model.displayName}</h3>
        <p>{model.description || meta.description}</p>
      </div>
    </button>
  )
}
