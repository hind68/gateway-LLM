import { useState } from 'react'
import { modelLogoSrc } from '../../../utils/modelMetadata'
import { normalizeModelLogoUrl } from './modelLogoUrl'

export default function ModelLogo({ alias, logoUrl = '', className = '', fallback = '' }) {
  const logo = normalizeModelLogoUrl(logoUrl) || modelLogoSrc(alias)
  const [failedLogo, setFailedLogo] = useState('')

  if (!logo || failedLogo === logo) {
    return fallback ? <span className={className}>{fallback}</span> : null
  }

  return (
    <span className={className}>
      <img src={logo} alt="" referrerPolicy="no-referrer" onError={() => setFailedLogo(logo)} />
    </span>
  )
}
