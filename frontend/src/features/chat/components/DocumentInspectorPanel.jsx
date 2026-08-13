import { useEffect, useMemo, useRef, useState } from 'react'
import mammoth from 'mammoth'
import {
  downloadSecureAttachment,
  fetchAttachmentContent,
  fetchAttachmentInspection,
  fetchAttachmentSecure,
} from '../../../api/attachmentsApi'
import { CopyIcon } from '../../../components/common/icons'
import { CODE_EXTENSIONS, TEXT_EXTENSIONS, fileExtension } from '../utils/attachmentFiles'

const TEXT_LIKE_EXTENSIONS = new Set([
  ...TEXT_EXTENSIONS,
  ...CODE_EXTENSIONS,
  '.csv',
  '.properties',
  '.env',
].map((extension) => extension.slice(1)))
const READER_FONT_SIZE = 13
const COMPACT_THREAT_LIMIT = 6
const PREVIEW_UNAVAILABLE = 'Format non prévisualisable'
const EXTRACTION_UNAVAILABLE = 'Extraction impossible'

export default function DocumentInspectorPanel({ attachment: inspectionTarget, closing = false, onAttachSecure, onClose, width }) {
  const target = useMemo(() => normalizeTarget(inspectionTarget), [inspectionTarget])
  const attachment = target.attachment
  const attachmentKey = attachmentIdentity(attachment)
  const [activeTab, setActiveTab] = useState(initialMode(target))
  const [originalState, setOriginalState] = useState(() => initialOriginalState())
  const [inspectionState, setInspectionState] = useState(() => initialInspectionState(target))
  const [secureState, setSecureState] = useState(() => initialSecureState(target))
  const [copySucceeded, setCopySucceeded] = useState(false)
  const [fontSize, setFontSize] = useState(READER_FONT_SIZE)
  const [showTextSizeMenu, setShowTextSizeMenu] = useState(false)
  const textSizeControlRef = useRef(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActiveTab(initialMode(target))
      setOriginalState(initialOriginalState())
      setInspectionState(initialInspectionState(target))
      setSecureState(initialSecureState(target))
      setCopySucceeded(false)
      setFontSize(READER_FONT_SIZE)
      setShowTextSizeMenu(false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [attachmentKey, target])

  useEffect(() => {
    if (!attachment) return undefined
    let cancelled = false
    let previewUrl = ''
    const controller = new AbortController()

    async function loadOriginal() {
      setOriginalState((current) => ({ ...current, error: '', loading: true, status: 'Chargement du document…' }))
      try {
        const filename = attachment.filename || attachment.name || ''
        const fallbackText = target.extractedText || ''
        if (attachment.id) {
          const source = await fetchAttachmentContent(attachment.id, { signal: controller.signal })
          const nextState = await previewStateFromBlob(source.blob, filename, source.contentType || '', fallbackText)
          previewUrl = nextState.url || ''
          if (!cancelled) setOriginalState(nextState)
          return
        }

        const file = attachment.file || attachment
        if (!(file instanceof Blob)) {
          if (!cancelled) setOriginalState(fallbackOriginalState(fallbackText))
          return
        }

        const nextState = await previewStateFromBlob(file, filename, file.type || '', fallbackText)
        previewUrl = nextState.url || ''
        if (!cancelled) setOriginalState(nextState)
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') {
          setOriginalState(fallbackOriginalState(target.extractedText || '', EXTRACTION_UNAVAILABLE))
        }
      }
    }

    loadOriginal()
    return () => {
      cancelled = true
      controller.abort()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [attachmentKey, attachment, target.extractedText])

  useEffect(() => {
    if (!showTextSizeMenu) return undefined

    function closeOnOutsideInteraction(event) {
      if (textSizeControlRef.current?.contains(event.target)) return
      setShowTextSizeMenu(false)
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') setShowTextSizeMenu(false)
    }

    document.addEventListener('mousedown', closeOnOutsideInteraction)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideInteraction)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [showTextSizeMenu])

  useEffect(() => {
    if (!attachment) return undefined
    let cancelled = false
    const controller = new AbortController()

    async function loadInspection() {
      setInspectionState((current) => ({ ...current, error: '', loading: true }))
      try {
        if (attachment.id) {
          const payload = await fetchAttachmentInspection(attachment.id, { signal: controller.signal })
          if (!cancelled) {
            const extractedText = payload.extractedText || ''
            setInspectionState({
              error: '',
              loading: false,
              matches: Array.isArray(payload.matches) ? payload.matches : [],
              status: payload.extractionStatus || '',
              text: extractedText,
            })
            setOriginalState((current) => (
              current.text
                ? current
                : { ...current, loading: false, status: extractedText ? '' : (current.status || EXTRACTION_UNAVAILABLE), text: extractedText }
            ))
          }
          return
        }

        if (!cancelled) {
          setInspectionState({
            error: '',
            loading: false,
            matches: target.matches,
            status: '',
            text: target.extractedText || '',
          })
        }
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') {
          setInspectionState({ error: "Impossible de charger l'inspection DLP.", loading: false, matches: [], status: 'ERROR', text: '' })
        }
      }
    }

    loadInspection()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [attachmentKey, attachment, target.extractedText, target.matches])

  useEffect(() => {
    if (!attachment) return undefined
    let cancelled = false
    const controller = new AbortController()

    async function loadSecure() {
      setSecureState((current) => ({ ...current, error: '', loading: true }))
      try {
        if (attachment.id) {
          const payload = await fetchAttachmentSecure(attachment.id, { signal: controller.signal })
          if (!cancelled) setSecureState((current) => ({ error: '', loading: false, status: payload.extractionStatus || '', text: payload.maskedText || current.text || target.maskedText || '' }))
          return
        }

        if (!cancelled) setSecureState({ error: '', loading: false, status: '', text: target.maskedText || '' })
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') {
          setSecureState({ error: 'Impossible de charger la version sécurisée.', loading: false, status: 'ERROR', text: '' })
        }
      }
    }

    loadSecure()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [attachmentKey, attachment, target.maskedText])

  const filename = attachment?.filename || attachment?.name || 'Document'
  const extension = fileExtension(filename).toUpperCase() || 'FICHIER'
  const hasSecureText = Boolean(secureState.text)
  const visibleMatches = useMemo(() => filterMatchesForAttachment(inspectionState.matches, attachment), [attachment, inspectionState.matches])
  const matchCount = visibleMatches.length
  const canDownloadOriginal = attachment?.id && String(attachment?.decision || '').toUpperCase() !== 'BLOCK'
  const pageClass = useMemo(() => {
    if (activeTab === 'secure') return 'document-text-page document-secure-page'
    if (activeTab === 'detected') return 'document-text-page document-detected-page'
    return 'document-text-page document-editor-page'
  }, [activeTab])
  const readerStyle = pageClass.includes('document-text-page') ? { fontSize: `${fontSize}px` } : undefined

  async function copySecureVersion() {
    if (!secureState.text) return
    await navigator.clipboard?.writeText(secureState.text)
    setCopySucceeded(true)
    window.setTimeout(() => setCopySucceeded(false), 1500)
  }

  async function handleDownloadSecure() {
    if (!secureState.text) return
    if (attachment?.id) {
      await downloadSecureAttachment(attachment.id)
      return
    }
    downloadText(`${filenameWithoutExtension(filename)}-securise.txt`, secureState.text)
  }

  function handleAttachSecureVersion() {
    if (!secureState.text) return
    const secureFile = new File(
      [secureState.text],
      `${filenameWithoutExtension(filename)}-securise.txt`,
      { type: 'text/plain;charset=utf-8' },
    )
    onAttachSecure?.(secureFile)
  }

  function decreaseFontSize() {
    setFontSize((current) => Math.max(10, current - 1))
  }

  function increaseFontSize() {
    setFontSize((current) => Math.min(24, current + 1))
  }

  if (!attachment) return null

  return (
    <aside className={`document-inspector-panel ${closing ? 'is-closing' : ''}`} style={{ width }} aria-label="Inspection du document">
      <header className="document-inspector-header">
        <div className="document-inspector-title">
          <strong title={filename}>{filename}</strong>
          <span>{extension}</span>
        </div>
        <div className="document-inspector-header-actions">
          <div className="document-text-size-control" ref={textSizeControlRef}>
            <button
              type="button"
              className="document-header-icon-action document-text-size-trigger"
              aria-expanded={showTextSizeMenu}
              aria-label="Modifier la taille du texte"
              title="Taille du texte"
              onClick={() => setShowTextSizeMenu((current) => !current)}
            >
              Aa
            </button>
            {showTextSizeMenu && (
              <div className="document-text-size-popover" role="dialog" aria-label="Taille du texte">
                <button type="button" aria-label="Réduire la taille du texte" onClick={decreaseFontSize}>A-</button>
                <span className="document-text-size-value" aria-label="Taille actuelle du texte">{fontSize} px</span>
                <button type="button" aria-label="Agrandir la taille du texte" onClick={increaseFontSize}>A+</button>
              </div>
            )}
          </div>
          {canDownloadOriginal && (
            <a className="document-header-icon-action" href={`/api/attachments/${attachment.id}/content`} download aria-label="Télécharger le fichier original" title="Télécharger le fichier original">
              <img src="/assets/downloads.png" alt="" aria-hidden="true" />
            </a>
          )}
          <button type="button" className="document-close-button" aria-label="Fermer l'inspection du document" title="Fermer" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="document-segmented-row">
        <div className="segmented-control document-header-tabs" role="tablist" aria-label="Vues du document">
          <button type="button" role="tab" aria-selected={activeTab === 'original'} className={activeTab === 'original' ? 'active' : ''} onClick={() => setActiveTab('original')}>
            Original
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'detected'} className={activeTab === 'detected' ? 'active' : ''} onClick={() => setActiveTab('detected')}>
            Menaces ({matchCount})
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'secure'} className={activeTab === 'secure' ? 'active' : ''} onClick={() => setActiveTab('secure')}>
            Sécurisé
          </button>
        </div>
      </div>

      <div className="document-inspector-viewer">
        <div className="document-zoom-shell">
          <article className={pageClass} style={readerStyle}>
            {activeTab === 'original' && <OriginalDocumentView documentState={originalState} extractedText={inspectionState.text || target.extractedText} extractionLoading={inspectionState.loading} />}
            {activeTab === 'detected' && <InspectionDocumentView state={{ ...inspectionState, matches: visibleMatches, text: inspectionState.text || target.extractedText }} />}
            {activeTab === 'secure' && <SecureDocumentView state={secureState} />}
          </article>
        </div>
      </div>

      {activeTab === 'secure' && (
        <div className="document-secure-actionbar" aria-label="Actions de la version sécurisée">
          <button type="button" className="document-icon-action labeled" title={hasSecureText ? 'Copier la version sécurisée' : 'Version sécurisée indisponible'} aria-label="Copier la version sécurisée" disabled={!hasSecureText} onClick={copySecureVersion}>
            {copySucceeded ? <span className="check-icon" aria-hidden="true" /> : <CopyIcon />}
            <span>Copier</span>
          </button>
          <button type="button" className="document-icon-action labeled" title={hasSecureText ? 'Télécharger la version sécurisée' : 'Version sécurisée indisponible'} aria-label="Télécharger la version sécurisée" disabled={!hasSecureText} onClick={handleDownloadSecure}>
            <img src="/assets/downloads.png" alt="" aria-hidden="true" />
            <span>Télécharger</span>
          </button>
          <button type="button" className="document-icon-action primary labeled" title={hasSecureText ? 'Ajouter la version sécurisée aux pièces jointes' : 'Version sécurisée indisponible'} aria-label="Ajouter la version sécurisée aux pièces jointes" disabled={!hasSecureText} onClick={handleAttachSecureVersion}>
            <img src="/assets/share.png" alt="" aria-hidden="true" />
            <span>Partager</span>
          </button>
        </div>
      )}
    </aside>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function OriginalDocumentView({ documentState, extractedText, extractionLoading }) {
  if (documentState.loading) return <LoadingState label="Chargement du document…" />
  if (documentState.kind === 'pdf' && documentState.url) {
    return (
      <object className="document-pdf-viewer" data={documentState.url} type="application/pdf" aria-label="Aperçu PDF">
        <PdfFallback text={extractedText} />
      </object>
    )
  }
  if (documentState.kind === 'image' && documentState.url) return <img className="document-image-viewer" src={documentState.url} alt="Aperçu du document original" />
  if (documentState.kind === 'html' && documentState.html) return <div className="document-docx-preview" dangerouslySetInnerHTML={{ __html: documentState.html }} />
  const text = documentState.text || extractedText || ''
  if (text) return <EditorText text={text} className="document-original-code" />
  if (extractionLoading) return <LoadingState label="Extraction du texte en cours…" />
  const placeholder = documentState.status || EXTRACTION_UNAVAILABLE
  return <EditorText text={placeholder} className="document-original-code document-code-placeholder" renderLine={(line) => <span className="document-code-placeholder-line">{line}</span>} />
}

function PdfFallback({ text }) {
  if (!text) return <p>{PREVIEW_UNAVAILABLE}</p>
  return <EditorText text={text} className="document-original-code" />
}

function InspectionDocumentView({ state }) {
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const hasMatches = Array.isArray(state.matches) && state.matches.length > 0
  const highlightableMatches = filterHighlightableMatches(state.matches, state.text)
  if (state.loading) return <LoadingState label="Analyse de sécurité en cours…" />
  if (state.error) return <p>{state.error}</p>
  if (!state.text && hasMatches) {
    return (
      <DetectionIssueState
        matches={state.matches}
        message="Le DLP a détecté des données sensibles, mais le texte extrait n'a pas été conservé pour localiser les positions."
      />
    )
  }
  if (!state.text && String(state.status).toUpperCase() === 'SUCCESS') return <p>Extraction réussie, mais aucun texte lisible n'a été retourné pour ce fichier.</p>
  if (!state.text && state.matches?.length) return <p>Le texte extrait du fichier n'a pas été retrouvé pour ces détections.</p>
  if (!state.text) return <p>L'extraction du texte n'est pas disponible.</p>

  if (hasMatches && highlightableMatches.length === 0) {
    return (
      <DetectionIssueState
        matches={state.matches}
        message="Le DLP a détecté des données sensibles, mais leurs positions ne correspondent pas au texte extrait affichable."
        text={state.text}
      />
    )
  }

  const rows = lineRows(state.text, highlightableMatches)
  function selectMatch(match) {
    const id = matchKey(match)
    const line = lineNumberForMatch(state.text, match)
    setSelectedMatchId(id)
    const lineElement = Number.isInteger(line) ? document.getElementById(`line-${line}`) : null
    const matchElement = document.querySelector(`[data-match-id="${CSS.escape(id)}"]`)
    ;(lineElement || matchElement)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }

  return (
    <div className="document-detected-layout">
      <DetectionIndex matches={highlightableMatches} selectedMatchId={selectedMatchId} text={state.text} onSelect={selectMatch} />
      <div className="document-inspection-code flex-1 min-h-0 overflow-y-auto">
        {rows.map((line) => (
          <div className="document-line" id={`line-${line.number}`} key={line.number}>
            <span className="document-line-number">{line.number}</span>
            <code>{renderHighlightedParts(line.parts, selectedMatchId, selectMatch)}</code>
          </div>
        ))}
      </div>
    </div>
  )
}

function DetectionIssueState({ matches, message, text = '' }) {
  return (
    <div className="document-empty-state">
      <span aria-hidden="true">!</span>
      <strong>Localisation indisponible</strong>
      <p>{message}</p>
      <DetectionIndex matches={matches} selectedMatchId="" text={text} onSelect={() => undefined} />
    </div>
  )
}

function SecureDocumentView({ state }) {
  if (state.loading) return <LoadingState label="Chargement de la version sécurisée…" />
  if (state.error) return <p>{state.error}</p>
  if (!state.text) {
    return (
      <div className="document-empty-state">
        <span aria-hidden="true">!</span>
        <strong>Version sécurisée indisponible</strong>
        <p>La version sécurisée est en cours de génération ou indisponible.</p>
      </div>
    )
  }
  return <EditorText text={state.text} className="document-secure-text" renderLine={renderSecureText} />
}

function LoadingState({ label }) {
  return (
    <div className="document-loading-state" role="status" aria-live="polite">
      <span className="document-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

function EditorText({ text, className, renderLine = (line) => line }) {
  const lines = String(text || '').split('\n')
  return (
    <pre className={className}>
      {lines.map((line, index) => (
        <div className="document-line" key={index}>
          <span className="document-line-number">{index + 1}</span>
          <code>{renderLine(line)}</code>
        </div>
      ))}
    </pre>
  )
}

function DetectionIndex({ matches, selectedMatchId, text, onSelect }) {
  const [expanded, setExpanded] = useState(false)
  const [filter, setFilter] = useState('all')
  if (!Array.isArray(matches) || matches.length === 0) return null
  const counts = severityCounts(matches)
  const filters = threatFilters(counts)
  const visibleMatches = filter === 'all' ? matches : matches.filter((match) => severityGroup(match) === filter)
  const visibleChips = expanded ? visibleMatches : visibleMatches.slice(0, COMPACT_THREAT_LIMIT)
  const canExpand = visibleMatches.length > COMPACT_THREAT_LIMIT
  return (
    <div className="document-threat-navigation shrink-0" aria-label="Liste des menaces détectées">
      <div className="document-threat-summary">
        <strong>{threatSummary(counts)}</strong>
        <div className="document-threat-filters" aria-label="Filtres des menaces">
          {filters.map((item) => (
            <button
              type="button"
              className={filter === item.key ? 'active' : ''}
              key={item.key}
              onClick={() => {
                setFilter(item.key)
                setExpanded(false)
              }}
            >
              {item.label} <span>{item.count}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={`document-threat-list shrink-0 ${expanded ? 'is-expanded' : 'is-collapsed'}`}>
        {visibleChips.map((match, index) => {
          const id = matchKey(match)
          const severity = severityClass(match)
          const line = lineNumberForMatch(text, match)
          const lineLabel = Number.isInteger(line) ? `L${line}` : 'L?'
          const fullLineLabel = Number.isInteger(line) ? `Ligne ${line}` : 'Ligne inconnue'
          return (
            <button
              type="button"
              aria-label={`${displaySeverity(match.severity)} ${displayTypeFr(match.type)} ${fullLineLabel}`}
              className={`document-threat-pill severity-${severity} ${selectedMatchId === id ? 'is-active' : ''}`}
              key={`${id}-${index}`}
              data-target-match-id={id}
              onClick={() => onSelect(match)}
              title={`${displaySeverity(match.severity)} - ${displayTypeFr(match.type)} - ${fullLineLabel}`}
            >
              <span>{displayTypeFr(match.type)}</span>
              <small title={fullLineLabel}>{lineLabel}</small>
            </button>
          )
        })}
      </div>
      {canExpand && (
        <button type="button" className="document-threat-toggle" onClick={() => setExpanded((current) => !current)}>
          {expanded ? 'Réduire' : 'Voir les autres'}
        </button>
      )}
    </div>
  )
}
function lineRows(text, matches) {
  const rows = String(text || '').split('\n')
  let cursor = 0
  return rows.map((line, index) => {
    const start = cursor
    const end = start + line.length
    cursor = end + 1
    const lineMatches = (matches || [])
      .filter((match) => Number.isInteger(match.start) && Number.isInteger(match.end))
      .filter((match) => match.end > start && match.start < end)
      .map((match) => ({
        ...match,
        absoluteStart: match.absoluteStart ?? match.start,
        absoluteEnd: match.absoluteEnd ?? match.end,
        start: Math.max(match.start, start) - start,
        end: Math.min(match.end, end) - start,
      }))
    return {
      number: index + 1,
      parts: splitOriginalText(line, lineMatches),
    }
  })
}

function renderHighlightedParts(parts, selectedMatchId, onSelect) {
  return parts.map((part, index) => {
    if (part.kind !== 'mark') return <span key={index}>{part.text}</span>
    const id = matchKey(part.match)
    return (
      <mark
        className={`document-dlp-mark severity-${severityClass(part.match)} ${selectedMatchId === id ? 'is-selected' : ''}`}
        data-match-id={id}
        key={index}
        onClick={() => onSelect?.(part.match)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onSelect?.(part.match)
        }}
        role="button"
        tabIndex={0}
        title={`${displayType(part.match?.type)} - ${severityClass(part.match)}`}
      >
        {part.text}
      </mark>
    )
  })
}

function splitOriginalText(text, matches) {
  const spans = normalizeSpans(text, matches)
  const parts = []
  let cursor = 0
  spans.forEach((match) => {
    if (match.start > cursor) parts.push({ kind: 'text', text: text.slice(cursor, match.start) })
    parts.push({ kind: 'mark', text: text.slice(match.start, match.end), match })
    cursor = match.end
  })
  if (cursor < text.length) parts.push({ kind: 'text', text: text.slice(cursor) })
  return parts
}

function normalizeSpans(text, matches) {
  const length = text.length
  return [...(matches || [])]
    .filter((match) => Number.isInteger(match.start) && Number.isInteger(match.end))
    .map((match) => ({
      ...match,
      start: Math.max(0, Math.min(match.start, length)),
      end: Math.max(0, Math.min(match.end, length)),
    }))
    .filter((match) => match.end > match.start)
    .sort((left, right) => left.start - right.start)
}

function normalizeTarget(target) {
  if (target?.attachment) {
    return {
      attachment: target.attachment,
      extractedText: target.extractedText || '',
      maskedText: fileMaskedText(target),
      matches: Array.isArray(target.matches) ? target.matches : [],
      mode: target.requestedView || target.mode,
    }
  }
  return { attachment: target, extractedText: '', maskedText: fileMaskedText(target), matches: [], mode: 'original' }
}

function fileMaskedText(target) {
  const value = target?.attachment?.maskedText || target?.maskedText || ''
  return /^Pi[eè]ces jointes\s*:/i.test(String(value).trim()) ? '' : value
}

function normalizeMode(mode) {
  if (mode === 'inspect' || mode === 'detected') return 'detected'
  if (mode === 'secure') return 'secure'
  return 'original'
}

function initialMode(target) {
  return normalizeMode(target.mode)
}

function initialOriginalState() {
  return { error: '', html: '', kind: 'message', loading: false, status: 'Chargement du document…', text: '', url: '' }
}

function initialInspectionState(target) {
  return { error: '', loading: false, matches: target.matches, status: '', text: target.extractedText || '' }
}

function initialSecureState(target) {
  return { error: '', loading: false, status: '', text: target.maskedText || '' }
}

function filterMatchesForAttachment(matches, attachment) {
  if (!Array.isArray(matches)) return []
  const attachmentId = attachment?.id == null ? '' : String(attachment.id)
  const sourceNames = new Set([
    attachment?.filename,
    attachment?.name,
    attachment?.source,
  ].filter(Boolean).flatMap(sourceAliases))
  return matches.filter((match) => {
    const idMatches = match.attachmentId != null && attachmentId && String(match.attachmentId) === attachmentId
    const sourceMatches = match.source && sourceNames.size > 0 && sourceAliases(match.source).some((source) => sourceNames.has(source))
    if (idMatches || sourceMatches) return true
    if (match.attachmentId != null || match.source) return false
    return !match.attachmentId && !match.source
  })
}

function sourceAliases(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return []
  const basename = normalized.split(/[\\/]/).pop()
  return [...new Set([normalized, basename].map((item) => item.toLowerCase()))]
}

function filterHighlightableMatches(matches, text) {
  const length = String(text || '').length
  return (matches || [])
    .filter((match) => Number.isInteger(match.start) && Number.isInteger(match.end))
    .filter((match) => match.start >= 0 && match.end > match.start && match.end <= length)
}

function severityCounts(matches) {
  return (matches || []).reduce((counts, match) => {
    const group = severityGroup(match)
    return { ...counts, total: counts.total + 1, [group]: counts[group] + 1 }
  }, { total: 0, high: 0, medium: 0, low: 0 })
}

function threatFilters(counts) {
  return [
    { key: 'all', label: 'Toutes', count: counts.total },
    { key: 'high', label: 'Élevées', count: counts.high },
    { key: 'medium', label: 'Moyennes', count: counts.medium },
    counts.low > 0 ? { key: 'low', label: 'Faibles', count: counts.low } : null,
  ].filter(Boolean).filter((item) => item.key === 'all' || item.count > 0)
}

function threatSummary(counts) {
  return `${counts.total} ${counts.total > 1 ? 'menaces détectées' : 'menace détectée'}`
}

function severityGroup(match) {
  const normalized = severityClass(match)
  if (normalized === 'high') return 'high'
  if (normalized === 'low') return 'low'
  return 'medium'
}

function severityClass(match) {
  return String(match?.severity || match?.level || 'medium').toLowerCase()
}

function displayType(type) {
  return String(type || 'donnée sensible').replaceAll('_', ' ')
}

function displayTypeFr(type) {
  const normalized = String(type || '').toLowerCase()
  const labels = {
    ip_address: 'Adresse IP',
    private_key: 'Clé privée',
    connection_string: 'Chaîne de connexion',
    openai_api_key: 'Clé API OpenAI',
    moroccan_cin: 'CIN',
    email: 'Adresse e-mail',
  }
  return labels[normalized] || displayType(type)
}

function displaySeverity(severity) {
  const normalized = String(severity || 'medium').toLowerCase()
  if (normalized === 'high') return 'Élevée'
  if (normalized === 'low') return 'Faible'
  return 'Moyenne'
}

function matchKey(match, fallback = '') {
  const start = match?.absoluteStart ?? match?.start ?? 'unknown'
  const end = match?.absoluteEnd ?? match?.end ?? 'unknown'
  return String(match?.id || `${match?.attachmentId || ''}-${match?.source || ''}-${start}-${end}-${fallback}`)
}

function renderSecureText(text) {
  const value = String(text || '')
  const pattern = /\[([A-Z0-9_]+?)(?:_\d+)?\]/g
  const parts = []
  let cursor = 0
  value.replace(pattern, (placeholder, type, index) => {
    if (index > cursor) parts.push(<span key={`t-${index}`}>{value.slice(cursor, index)}</span>)
    parts.push(<span className="document-secure-placeholder" key={`p-${index}`}>{placeholder}</span>)
    cursor = index + placeholder.length
    return placeholder
  })
  if (cursor < value.length) parts.push(<span key="tail">{value.slice(cursor)}</span>)
  return parts
}

function lineNumberForMatch(text, match) {
  const value = String(text || '')
  if (Number.isInteger(match?.start)) {
    if (value && match.start >= 0 && match.start <= value.length) {
      return value.slice(0, match.start).split('\n').length
    }
    return Number.isInteger(match?.lineNumber) && match.lineNumber > 1 ? match.lineNumber : 'inconnue'
  }
  if (Number.isInteger(match?.lineNumber) && match.lineNumber > 0) return match.lineNumber
  return 'inconnue'
}

function isTextLike(extension, contentType = '') {
  const normalized = String(contentType).toLowerCase()
  return TEXT_LIKE_EXTENSIONS.has(extension) || normalized.startsWith('text/') || normalized.includes('json') || normalized.includes('xml')
}

function isPdf(extension, contentType = '') {
  return extension === 'pdf' || String(contentType).toLowerCase().includes('pdf')
}

function isImage(extension, contentType = '') {
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tif', 'tiff'].includes(extension) || String(contentType).toLowerCase().startsWith('image/')
}

function isDocx(extension, contentType = '') {
  return extension === 'docx' || String(contentType).toLowerCase().includes('wordprocessingml.document')
}

async function previewStateFromBlob(blob, filename, contentType, fallbackText) {
  const extension = fileExtension(filename)
  if (blob && isDocx(extension, contentType)) {
    try {
      const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() })
      if (result.value) return { error: '', html: result.value, kind: 'html', loading: false, status: '', text: fallbackText || '', url: '' }
    } catch {
      return fallbackOriginalState(fallbackText, fallbackText ? '' : EXTRACTION_UNAVAILABLE)
    }
  }
  if (blob && isPdf(extension, contentType)) {
    return { error: '', html: '', kind: 'pdf', loading: false, status: '', text: fallbackText || '', url: URL.createObjectURL(blob) }
  }
  if (blob && isImage(extension, contentType)) {
    return { error: '', html: '', kind: 'image', loading: false, status: '', text: fallbackText || '', url: URL.createObjectURL(blob) }
  }
  if (blob && isTextLike(extension, contentType)) {
    return { error: '', html: '', kind: 'text', loading: false, status: '', text: await blob.text(), url: '' }
  }
  return fallbackOriginalState(fallbackText, fallbackText ? PREVIEW_UNAVAILABLE : EXTRACTION_UNAVAILABLE)
}

function fallbackOriginalState(text, status = PREVIEW_UNAVAILABLE) {
  return { error: '', html: '', kind: 'text', loading: false, status: text ? '' : status, text: text || '', url: '' }
}

function filenameWithoutExtension(filename) {
  return String(filename || 'document').replace(/\.[^.]+$/, '')
}

function attachmentIdentity(attachment) {
  return String(attachment?.id || attachment?.filename || attachment?.name || '')
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
