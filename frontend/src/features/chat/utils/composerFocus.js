export function shouldFocusComposer({ activeElement, composer, textarea }) {
  if (!textarea) return false
  if (!activeElement) return true
  if (activeElement === textarea) return true
  if (typeof document !== 'undefined' && activeElement === document.body) return true
  return Boolean(composer?.contains(activeElement))
}

export function focusTextareaOnNextFrame(textarea, scheduler = window.requestAnimationFrame) {
  if (!textarea) return
  scheduler(() => {
    textarea.focus()
  })
}
