import { getAttachmentIconSrc } from '../utils/attachmentFiles'

export default function FileAttachmentCard({ attachment, hideActions = false, hideViewButton = false, variant = 'message', onAction, onInspect, onRemove }) {
  const filename = attachment?.filename || attachment?.name || 'Fichier'
  const size = attachment?.size || 0

  if (variant === 'chip') {
    return (
      <div className="attachment-chip">
        {getFileIcon(filename, 32)}
        <span className="attachment-chip-copy">
          <span className="attachment-name" title={filename}>{filename}</span>
          <span className="attachment-size">{formatBytes(size)}</span>
        </span>
        <button
          className="attachment-remove-button"
          type="button"
          aria-label={`Retirer ${filename}`}
          title={`Retirer ${filename}`}
          onClick={onRemove}
        >
          <span aria-hidden="true" />
        </button>
      </div>
    )
  }

  const canOpen = !hideActions && !hideViewButton
  return (
    <li
      className={`file-message-card${variant === 'dlp-alert' ? ' dlp-file-card' : ''}${canOpen ? ' is-clickable' : ''}`}
      onClick={canOpen ? () => emitAction(onAction, onInspect, attachment, 'original') : undefined}
      onKeyDown={canOpen ? (event) => handleCardKeyDown(event, onAction, onInspect, attachment) : undefined}
      role={canOpen ? 'button' : undefined}
      tabIndex={canOpen ? 0 : undefined}
      aria-label={canOpen ? filename : undefined}
      title={filename}
    >
      {getFileIcon(filename, 32)}
      <span className="file-message-copy">
        <strong title={filename}>{filename}</strong>
        <small>{formatBytes(size)}</small>
      </span>
    </li>
  )
}

function handleCardKeyDown(event, onAction, onInspect, attachment) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  emitAction(onAction, onInspect, attachment, 'original')
}

function emitAction(onAction, onInspect, attachment, mode) {
  if (onAction) {
    onAction(attachment, mode)
    return
  }
  onInspect?.({ attachment, mode })
}

function getFileIcon(filename, size = 32) {
  const src = getAttachmentIconSrc(filename)
  return (
    <img
      className="file-type-icon"
      src={src}
      alt=""
      aria-hidden="true"
      style={{ width: size, height: size }}
    />
  )
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}
