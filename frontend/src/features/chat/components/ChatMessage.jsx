import { memo, useMemo, useState } from 'react'
import { CheckIcon, CopyIcon } from '../../../components/common/icons'
import ModelLogo from '../../models/components/ModelLogo'
import MarkdownContent from './MarkdownContent'
import FileAttachmentCard from './FileAttachmentCard'
import { cleanModelName, modelCardMeta } from '../../../utils/modelMetadata'
import { dlpUserMessage } from '../utils/dlpErrors'
import { splitMaskedTextByPlaceholders, normalizeSensitiveSpans, splitTextBySpans } from '../utils/dlpViews'
import { detectTextDirection } from '../utils/markdown'

const COLLAPSED_ATTACHMENT_COUNT = 3

function ChatMessage({ copiedKey, fallbackModelAlias, fallbackModelName, message, onCopy, onInspectDocument, setCopiedKey }) {
  const isUser = message.role === 'USER'
  const isDlpBlocked = message.status === 'DLP_BLOCKED'
  const effectiveModelAlias = message.modelAlias || fallbackModelAlias || fallbackModelName
  const modelName = cleanModelName(message.modelDisplayName || fallbackModelName, effectiveModelAlias)
  const isWaiting = !isUser && message.status === 'EN_COURS' && !message.content
  const isFailed = !isUser && message.status === 'ECHEC'
  const messageCopyKey = `message-${message.id}`
  const promptCopyKey = `prompt-${message.id}`
  const alertCopyKey = `dlp-alert-${message.id}`
  const safeCopyKey = `dlp-safe-${message.id}`
  const isMessageCopied = copiedKey === messageCopyKey
  const isPromptCopied = copiedKey === promptCopyKey
  const isAlertCopied = copiedKey === alertCopyKey
  const isSafeCopied = copiedKey === safeCopyKey
  const textDirection = detectTextDirection(message.content || '')
  const visibleContent = displayableMessageContent(message)
  const dlpPromptContent = message.dlpOriginalText || displayableMessageContent(message) || ''

  async function copyResponse(copyKey = messageCopyKey, text = message.content || '') {
    const success = await onCopy(text)
    if (!success) return
    markCopied(copyKey, setCopiedKey)
  }

  if (isUser && isDlpBlocked) {
    return (
      <>
        {(dlpPromptContent || message.attachments?.length > 0) && (
          <article className="message user">
            <div className="user-message-stack">
              <AttachmentList attachments={message.attachments} onInspectDocument={onInspectDocument} />
              {dlpPromptContent && (
                <div className="user-text-bubble">
                  <p>{dlpPromptContent}</p>
                </div>
              )}
            </div>
            {dlpPromptContent && (
              <div className="message-actions user-actions">
                <button
                  type="button"
                  aria-label={isPromptCopied ? 'Copié' : 'Copier mon prompt'}
                  title={isPromptCopied ? 'Copié' : 'Copier mon prompt'}
                  onClick={() => copyResponse(promptCopyKey, dlpPromptContent)}
                >
                  {isPromptCopied ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
            )}
          </article>
        )}
        <article className="message assistant dlp-blocked-response">
          <div className="bubble">
            <AssistantMessageHeader modelAlias={effectiveModelAlias} modelName={modelName} />
            <DlpBlockedMessage
              alertCopied={isAlertCopied}
              copied={isSafeCopied}
              message={message}
              onCopyAlert={(text) => copyResponse(alertCopyKey, text)}
              onCopySafe={(text) => copyResponse(safeCopyKey, text)}
              onInspectDocument={onInspectDocument}
            />
          </div>
        </article>
      </>
    )
  }

  return (
    <article className={`message ${isUser ? 'user' : 'assistant'}`}>
      <div className="bubble">
        {!isUser && <AssistantMessageHeader modelAlias={effectiveModelAlias} modelName={modelName} />}
        {isUser ? (
          <div className="user-message-stack">
            <AttachmentList attachments={message.attachments} onInspectDocument={onInspectDocument} />
            {visibleContent && (
              <div className="user-text-bubble">
                <p>{visibleContent}</p>
              </div>
            )}
            {hasMaskedAttachment(message.attachments) && (
              <p className="dlp-mask-note">Certaines données ont été masquées avant envoi.</p>
            )}
          </div>
        ) : isWaiting ? (
          <TypingIndicator />
        ) : isFailed ? (
          <ErrorMessage content={message.content || 'La génération a échoué.'} />
        ) : (
          <>
            <MarkdownContent
              content={message.content || ''}
              copiedKey={copiedKey}
              direction={textDirection}
              onCopy={onCopy}
              setCopiedKey={setCopiedKey}
            />
            {message.content && (
              <div className="message-actions">
                <button
                  type="button"
                  aria-label={isMessageCopied ? 'Copié' : 'Copier la réponse'}
                  title={isMessageCopied ? 'Copié' : 'Copier la réponse'}
                  onClick={() => copyResponse()}
                >
                  {isMessageCopied ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {isUser && !isDlpBlocked && visibleContent && (
        <div className="message-actions user-actions">
          <button
            type="button"
            aria-label={isPromptCopied ? 'Copié' : 'Copier mon prompt'}
            title={isPromptCopied ? 'Copié' : 'Copier mon prompt'}
            onClick={() => copyResponse(promptCopyKey, visibleContent)}
          >
            {isPromptCopied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
      )}
    </article>
  )
}

function DlpBlockedMessage({ alertCopied, copied, message, onCopyAlert, onCopySafe, onInspectDocument }) {
  const [showSafe, setShowSafe] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const [showAllAttachments, setShowAllAttachments] = useState(false)
  const matches = useMemo(() => message.dlpMatches || [], [message.dlpMatches])
  const attachments = useMemo(() => (
    Array.isArray(message.attachments) ? message.attachments : []
  ), [message.attachments])
  const blockedAttachments = useMemo(() => attachments.filter((attachment) => hasDlpAttachmentSignal(attachment, matches, attachments.length)), [attachments, matches])
  const hasDlpFiles = blockedAttachments.length > 0
  const hiddenAttachmentCount = Math.max(blockedAttachments.length - COLLAPSED_ATTACHMENT_COUNT, 0)
  const canToggleAttachments = hiddenAttachmentCount > 0
  const visibleBlockedAttachments = showAllAttachments
    ? blockedAttachments
    : blockedAttachments.slice(0, COLLAPSED_ATTACHMENT_COUNT)
  const safeText = message.dlpMaskedText || ''
  const originalText = message.dlpOriginalText || ''
  const hasOriginal = Boolean(originalText)
  const hasOpenDetails = showSafe || showOriginal
  const summary = dlpUserMessage({
    code: 'DLP_BLOCKED',
    detectedTypes: message.dlpDetectedTypes,
    highestSeverity: message.dlpHighestSeverity,
  })
  const safeParts = useMemo(
    () => splitMaskedTextByPlaceholders(safeText, matches.map((match) => match.placeholder)),
    [matches, safeText],
  )
  const originalParts = useMemo(
    () => splitTextBySpans(originalText, normalizeSensitiveSpans(originalText, matches)),
    [matches, originalText],
  )

  return (
    <div className={`dlp-alert ${hasOpenDetails ? 'is-expanded' : 'is-compact'}`} role="alert">
      <div className="dlp-alert-heading">
        <div className="dlp-alert-title-row">
          <SecurityIcon />
          <div>
            <strong>Message bloqué : Donnée sensible détectée</strong>
            <p>{summary}</p>
          </div>
        </div>
        <button
          type="button"
          aria-label={alertCopied ? 'Copié' : 'Copier le message de sécurité'}
          title={alertCopied ? 'Copié' : 'Copier le message de sécurité'}
          onClick={() => onCopyAlert(summary)}
        >
          {alertCopied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
      {hasDlpFiles ? (
        <section className="dlp-file-panel">
          <div className="dlp-file-inspection-row">
            <AttachmentList
              attachments={visibleBlockedAttachments}
              onAttachmentAction={(attachment) => inspectBlockedAttachment(blockedAttachments, matches, safeText, onInspectDocument, attachment)}
              onInspectDocument={onInspectDocument}
              variant="dlp-alert"
            />
          </div>
          {canToggleAttachments && (
            <button
              type="button"
              className="dlp-attachments-toggle"
              aria-expanded={showAllAttachments}
              onClick={() => setShowAllAttachments((current) => !current)}
            >
              <span>{showAllAttachments ? 'R\u00e9duire' : `Afficher ${hiddenAttachmentCount} autre${hiddenAttachmentCount > 1 ? 's' : ''}`}</span>
              <img
                src="/assets/down.png"
                alt=""
                aria-hidden="true"
                className={`dlp-attachments-toggle-icon ${showAllAttachments ? 'is-expanded' : ''}`}
              />
            </button>
          )}
        </section>
      ) : (
        <div className="dlp-alert-tabs">
          <button
            type="button"
            aria-controls={`dlp-safe-${message.id}`}
            aria-expanded={showSafe}
            onClick={() => setShowSafe((current) => !current)}
          >
            {showSafe ? 'Masquer la version sécurisée' : 'Voir la version sécurisée'}
          </button>
          <button
            type="button"
            aria-controls={`dlp-original-${message.id}`}
            aria-expanded={showOriginal}
            disabled={!hasOriginal}
            title={hasOriginal ? undefined : 'Disponible uniquement avant actualisation'}
            onClick={() => setShowOriginal((current) => !current)}
          >
            {showOriginal ? 'Masquer la localisation' : 'Localiser dans mon message'}
          </button>
        </div>
      )}
      {!hasDlpFiles && showSafe && (
        <section className="dlp-detail-panel" id={`dlp-safe-${message.id}`}>
          <div className="dlp-detail-heading">
            <span>Version sécurisée</span>
            <button
              type="button"
              aria-label={copied ? 'Copié' : 'Copier la version sécurisée'}
              title={copied ? 'Copié' : 'Copier la version sécurisée'}
              onClick={() => onCopySafe(safeText)}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
          <HighlightedPre parts={safeParts} />
          <DetectionList matches={matches} />
        </section>
      )}
      {!hasDlpFiles && showOriginal && hasOriginal && (
        <section className="dlp-detail-panel sensitive" id={`dlp-original-${message.id}`}>
          <p className="dlp-sensitive-warning">Cette vue affiche les données sensibles que vous avez saisies.</p>
          <HighlightedPre parts={originalParts} />
        </section>
      )}
    </div>
  )
}

function inspectBlockedAttachment(attachments, matches, maskedText, onInspectDocument, selectedAttachment) {
  const attachment = selectedAttachment || attachments.find((item) => item?.decision === 'BLOCK') || attachments[0]
  if (!attachment) return
  const attachmentMatches = matches.filter((match) => (
    matchesAttachment(match, attachment)
  ))
  onInspectDocument?.({
    attachment,
    attachmentId: attachment.id,
    maskedText: attachment.id ? '' : maskedText,
    matches: attachmentMatches,
    requestedView: 'detected',
  })
}

function hasDlpAttachmentSignal(attachment, matches, attachmentCount = 1) {
  const decision = String(attachment?.decision || attachment?.status || '').toUpperCase()
  if (decision && !['ALLOW', 'ALLOWED', 'CLEAN', 'OK'].includes(decision)) return true
  if (attachment?.flagged || attachment?.blocked || attachment?.hasDlpMatches || attachment?.dlpBlocked) return true
  return (matches || []).some((match) => {
    const hasScopedMatch = match?.attachmentId != null || match?.source
    return (hasScopedMatch || attachmentCount === 1) && matchesAttachment(match, attachment)
  })
}

function matchesAttachment(match, attachment) {
  const attachmentId = attachment?.id == null ? '' : String(attachment.id)
  const idMatches = match?.attachmentId != null && attachmentId && String(match.attachmentId) === attachmentId
  const sourceNames = [attachment?.filename, attachment?.name, attachment?.source]
    .filter(Boolean)
    .flatMap(sourceAliases)
  const sourceMatches = match?.source && sourceAliases(match.source).some((source) => sourceNames.includes(source))
  if (idMatches || sourceMatches) return true
  return !match?.attachmentId && !match?.source
}

function sourceAliases(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return []
  const basename = normalized.split(/[\\/]/).pop()
  return [...new Set([normalized, basename].map((item) => item.toLowerCase()))]
}

function displayableMessageContent(message) {
  const content = message.content || ''
  const hasAttachments = Array.isArray(message.attachments) && message.attachments.length > 0
  if (hasAttachments && /^Pi[eè]ces jointes\s*:/i.test(content.trim())) {
    return ''
  }
  return content
}

function AttachmentList({ attachments, hideActions = false, hideViewButton = false, onAttachmentAction, onInspectDocument, variant = 'message' }) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null
  return (
    <ul className="message-attachments">
      {attachments.map((attachment, index) => (
        <FileAttachmentCard
          attachment={attachment}
          hideActions={hideActions}
          hideViewButton={hideViewButton}
          key={`${attachment.filename || attachment.name}-${index}`}
          variant={variant}
          onAction={(selectedAttachment, mode) => {
            if (onAttachmentAction) {
              onAttachmentAction(selectedAttachment, mode)
              return
            }
            onInspectDocument?.({ attachment: selectedAttachment, attachmentId: selectedAttachment.id, requestedView: normalizeAttachmentAction(mode) })
          }}
        />
      ))}
    </ul>
  )
}

function normalizeAttachmentAction(mode) {
  if (mode === 'inspect' || mode === 'detected') return 'detected'
  if (mode === 'secure') return 'secure'
  return 'original'
}

function hasMaskedAttachment(attachments) {
  return Array.isArray(attachments) && attachments.some((attachment) => attachment.decision === 'MASK')
}

function SecurityIcon() {
  return (
    <svg className="dlp-alert-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.1 5.5 5.4v5.2c0 4.2 2.6 8 6.5 9.4 3.9-1.4 6.5-5.2 6.5-9.4V5.4L12 3.1Zm0 2.1 4.6 1.6v3.8c0 3-1.8 5.8-4.6 7-2.8-1.2-4.6-4-4.6-7V6.8L12 5.2Z" />
    </svg>
  )
}

function HighlightedPre({ parts }) {
  return (
    <pre className="dlp-code-view"><code>
      {parts.map((part, index) => (
        part.kind === 'mark'
          ? <mark key={index} title={part.match?.type}>{part.text}</mark>
          : <span key={index}>{part.text}</span>
      ))}
    </code></pre>
  )
}

function DetectionList({ matches }) {
  if (!matches.length) return null
  return (
    <ul className="dlp-detections">
      {matches.map((match, index) => (
        <li key={`${match.placeholder || match.type}-${index}`}>
          <span className="dlp-detection-badge">{displayPlaceholder(match)}</span>
          <span className="dlp-detection-type">{displayDetectionType(match.type)}</span>
          <small>{match.lineNumber ? `Ligne ${match.lineNumber}` : 'Position non précisée'}</small>
        </li>
      ))}
    </ul>
  )
}

function displayPlaceholder(match) {
  return String(match.placeholder || match.type || 'DLP').replace(/^\[|\]$/g, '')
}

function displayDetectionType(type) {
  return String(type || 'donnée sensible').replaceAll('_', ' ')
}

function AssistantMessageHeader({ modelAlias, modelName }) {
  const meta = modelCardMeta(modelAlias)

  return (
    <div className="assistant-header">
      <ModelLogo alias={modelAlias} className={`assistant-logo ${meta.tone}`} fallback={meta.initials} />
      <div className="assistant-meta">
        <strong>{modelName}</strong>
      </div>
    </div>
  )
}

function ErrorMessage({ content }) {
  return (
    <div className="assistant-error" role="alert">
      <strong>Impossible de générer la réponse</strong>
      <p>{content}</p>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="typing-indicator" aria-label="Réponse en cours">
      <span></span>
      <span></span>
      <span></span>
    </div>
  )
}

function markCopied(copyKey, setCopiedKey) {
  setCopiedKey(copyKey)
  window.setTimeout(() => setCopiedKey((current) => (current === copyKey ? '' : current)), 1500)
}

function isCopyStateRelevant(copiedKey, messageId) {
  return (
    copiedKey.startsWith('code-') ||
    copiedKey === `message-${messageId}` ||
    copiedKey === `prompt-${messageId}` ||
    copiedKey === `dlp-alert-${messageId}` ||
    copiedKey === `dlp-safe-${messageId}`
  )
}

function areChatMessagesEqual(previous, next) {
  const previousMessage = previous.message
  const nextMessage = next.message
  const sameStableProps = (
    previousMessage === nextMessage &&
    previous.fallbackModelAlias === next.fallbackModelAlias &&
    previous.fallbackModelName === next.fallbackModelName &&
    previous.onCopy === next.onCopy &&
    previous.onInspectDocument === next.onInspectDocument &&
    previous.setCopiedKey === next.setCopiedKey
  )

  if (!sameStableProps) return false
  if (previous.copiedKey === next.copiedKey) return true

  const wasCopyRelevant = isCopyStateRelevant(previous.copiedKey, previousMessage.id)
  const isCopyRelevant = isCopyStateRelevant(next.copiedKey, nextMessage.id)

  return !wasCopyRelevant && !isCopyRelevant
}

export default memo(ChatMessage, areChatMessagesEqual)
