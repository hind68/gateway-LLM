export function DotsIcon() {
  return (
    <span className="dots-icon" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </span>
  )
}

export function DownArrowIcon() {
  return <span className="down-arrow-icon" aria-hidden="true"></span>
}

export function StopIcon() {
  return <span className="stop-icon" aria-hidden="true"></span>
}

export function PaperclipIcon() {
  return <span className="paperclip-icon" aria-hidden="true"></span>
}

export function PlusIcon() {
  return <span className="plus-icon" aria-hidden="true"></span>
}

export function XIcon() {
  return <span className="x-icon" aria-hidden="true"></span>
}

export function CopyIcon({ tone = 'dark' }) {
  const src = tone === 'light' ? '/assets/white-copy.png' : '/assets/copy.png'
  return <img className="copy-icon" src={src} alt="" aria-hidden="true" />
}

export function CheckIcon() {
  return <img className="check-icon" src="/assets/check.png" alt="" aria-hidden="true" />
}
