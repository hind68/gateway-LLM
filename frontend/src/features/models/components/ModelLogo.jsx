import { useState } from 'react'
import { modelLogoSrc } from '../../../utils/modelMetadata'

export default function ModelLogo({ alias, className = '', fallback = '' }) {
  const logo = modelLogoSrc(alias)
  const [hasError, setHasError] = useState(false)

  if (!logo || hasError) {
    return fallback ? (
      <span className={className} aria-label={fallback}>
        {fallback}
      </span>
    ) : null
  }

  return (
    <span className={className}>
      <img
        src={logo}
        alt=""
        onError={() => setHasError(true)}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    </span>
  )
}