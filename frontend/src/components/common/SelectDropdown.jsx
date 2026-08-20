import { useEffect, useRef, useState } from 'react'
import { DownArrowIcon } from './icons'

export default function SelectDropdown({
  value,
  options,
  onChange,
  ariaLabel = 'Sélectionner une option',
  placeholder = 'Sélectionner…',
  disabled = false,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef(null)

  const selectedOption = options.find((option) => option.value === value)
  const activeLabel = selectedOption?.label || placeholder

  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div
      ref={rootRef}
      className={`custom-dropdown ${className}`.trim()}
      data-menu-root
    >
      <button
        type="button"
        className="custom-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{activeLabel}</span>
        <DownArrowIcon />
      </button>

      {isOpen && (
        <ul
          className="custom-dropdown-menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => (
            <li
              key={option.value}
              role="option"
              aria-selected={value === option.value}
              className={value === option.value ? 'selected' : ''}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
