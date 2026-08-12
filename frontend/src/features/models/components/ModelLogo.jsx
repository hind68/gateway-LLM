import { useState } from 'react'
import { modelLogoSrc } from '../../../utils/modelMetadata'

export default function ModelLogo({ alias, logoUrl = '', className = '', fallback = '' }) {
  const logo = logoUrl || modelLogoSrc(alias)
  const [hasError, setHasError] = useState(false)

  if (!logo || hasError) {
    return fallback ? (
      <span className={className} aria-label={fallback}>
        {fallback}
      </span>
    ) : null
  }

  return (
    <span className={`${className} model-logo-image`}>
      <img
        src={logo}
        alt=""
        onError={() => setHasError(true)}
      />
    </span>
  )
}
