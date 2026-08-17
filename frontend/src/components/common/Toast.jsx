import { useEffect, useState } from 'react'

const EXIT_ANIMATION_MS = 220
const AUTO_CLOSE_MS = 4000

export default function Toast({ notifications = [], onClose }) {
  if (!notifications.length) return null

  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions removals">
      {notifications.map((notification) => (
        <ToastItem key={notification.id} notification={notification} onClose={onClose} />
      ))}
    </div>
  )
}

function ToastItem({ notification, onClose }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const autoCloseTimer = window.setTimeout(() => {
      setExiting(true)
    }, AUTO_CLOSE_MS)
    const removeTimer = window.setTimeout(() => {
      onClose(notification.id)
    }, AUTO_CLOSE_MS + EXIT_ANIMATION_MS)

    return () => {
      window.clearTimeout(autoCloseTimer)
      window.clearTimeout(removeTimer)
    }
  }, [notification.id, onClose])

  return (
    <div
      className={`inline-error ${notification.kind === 'success' ? 'success' : ''} ${exiting ? 'is-exiting' : ''}`}
      role={notification.kind === 'error' ? 'alert' : 'status'}
    >
      <span className="toast-content">
        <StatusIcon kind={notification.kind} />
        <span className="toast-message">{notification.message}</span>
      </span>
      <button type="button" aria-label="Fermer la notification" onClick={() => onClose(notification.id)}>
        <span className="close-icon" aria-hidden="true"></span>
      </button>
    </div>
  )
}

function StatusIcon({ kind }) {
  if (kind === 'success') {
    return (
      <svg className="toast-status-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M10 1.8a8.2 8.2 0 1 0 0 16.4 8.2 8.2 0 0 0 0-16.4Zm3.8 6.2-4.4 4.6a.8.8 0 0 1-1.2 0L6 10.4a.8.8 0 1 1 1.1-1.1l1.7 1.6 3.8-4a.8.8 0 0 1 1.2 1.1Z" fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg className="toast-status-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 1.8a8.2 8.2 0 1 0 0 16.4 8.2 8.2 0 0 0 0-16.4Zm.8 11.6H9.2v-1.6h1.6v1.6Zm0-3.1H9.2V5.8h1.6v4.5Z" fill="currentColor" />
    </svg>
  )
}
