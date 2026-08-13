import { useEffect, useRef, useState } from 'react'

const EXIT_ANIMATION_MS = 220
const AUTO_CLOSE_MS = 4000

export default function Toast({ chatError, chatNotice, onClose }) {
  const incomingMessage = chatError || chatNotice
  const incomingKind = chatNotice ? 'success' : 'error'
  const [toast, setToast] = useState(null)
  const autoCloseTimerRef = useRef(null)
  const exitTimerRef = useRef(null)
  const toastKeyRef = useRef(0)

  useEffect(() => {
    if (autoCloseTimerRef.current) {
      window.clearTimeout(autoCloseTimerRef.current)
      autoCloseTimerRef.current = null
    }

    if (exitTimerRef.current) {
      window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }

    if (incomingMessage) {
      toastKeyRef.current += 1
      setToast({
        key: toastKeyRef.current,
        kind: incomingKind,
        message: incomingMessage,
        exiting: false,
      })
      autoCloseTimerRef.current = window.setTimeout(() => {
        autoCloseTimerRef.current = null
        onClose()
      }, AUTO_CLOSE_MS)
      return () => {
        if (autoCloseTimerRef.current) {
          window.clearTimeout(autoCloseTimerRef.current)
          autoCloseTimerRef.current = null
        }
      }
    }

    setToast((current) => (current ? { ...current, exiting: true } : null))
    exitTimerRef.current = window.setTimeout(() => {
      setToast(null)
      exitTimerRef.current = null
    }, EXIT_ANIMATION_MS)

    return () => {
      if (exitTimerRef.current) {
        window.clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
    }
  }, [incomingKind, incomingMessage, onClose])

  if (!toast) return null

  return (
    <div
      key={toast.key}
      className={`inline-error ${toast.kind === 'success' ? 'success' : ''} ${toast.exiting ? 'is-exiting' : ''}`}
      role={toast.kind === 'error' ? 'alert' : 'status'}
    >
      <span className="toast-content">
        <StatusIcon kind={toast.kind} />
        <span className="toast-message">{toast.message}</span>
      </span>
      <button type="button" aria-label="Fermer la notification" onClick={onClose}>
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
