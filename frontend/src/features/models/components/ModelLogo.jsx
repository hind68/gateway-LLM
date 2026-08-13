import { modelLogoSrc } from '../../../utils/modelMetadata'

export default function ModelLogo({ alias, className = '', fallback = '' }) {
  const logo = modelLogoSrc(alias)

  if (!logo) {
    return fallback ? <span className={className}>{fallback}</span> : null
  }

  return (
    <span className={className}>
      <img src={logo} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />
    </span>
  )
}
