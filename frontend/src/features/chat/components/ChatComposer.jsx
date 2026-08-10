import { useEffect, useState } from 'react'
import { PlusIcon, StopIcon } from '../../../components/common/icons'
import FileAttachmentCard from './FileAttachmentCard'
import { ACCEPTED_ATTACHMENT_EXTENSIONS, MAX_ATTACHMENTS } from '../hooks/useChatUi'

export default function ChatComposer({
  canSend,
  attachments = [],
  composerRef,
  draft,
  hasActiveMessages,
  isComposerMaxed,
  isGenerating,
  onDraftChange,
  onFilesSelected,
  onInspectDocument,
  onKeyDown,
  onRemoveFile,
  onRemoveFiles,
  onSubmit,
  onStop,
  textareaRef,
}) {
  const [visibleAttachments, setVisibleAttachments] = useState(attachments)
  const [hideComplete, setHideComplete] = useState(false)
  const displayAttachments = attachments.length > 0 ? attachments : visibleAttachments
  const isHidingAttachments = attachments.length === 0 && displayAttachments.length > 0 && !hideComplete

  useEffect(() => {
    if (attachments.length > 0) {
      const frame = window.requestAnimationFrame(() => {
        setVisibleAttachments(attachments)
        setHideComplete(false)
      })
      return () => window.cancelAnimationFrame(frame)
    }
    const timeout = window.setTimeout(() => setHideComplete(true), 220)
    return () => window.clearTimeout(timeout)
  }, [attachments])

  return (
    <form
      ref={composerRef}
      className={`composer ${hasActiveMessages ? 'composer-bottom' : 'composer-welcome composer-center'} ${isComposerMaxed ? 'composer-maxed' : ''} ${isGenerating ? 'is-generating' : ''}`}
      onSubmit={onSubmit}
    >
      {displayAttachments.length > 0 && (attachments.length > 0 || !hideComplete) && (
        <div className={`composer-attachments-wrapper ${isHidingAttachments ? 'is-hiding' : ''}`}>
          <div className="composer-attachments">
            {displayAttachments.map((file, index) => (
              <FileAttachmentCard
                attachment={file}
                key={`${file.name}-${file.size}-${index}`}
                onInspect={onInspectDocument}
                onRemove={() => !isGenerating && onRemoveFile(index)}
                variant="chip"
              />
            ))}
          </div>
          <button
            className="clear-attachments"
            type="button"
            aria-label="Retirer toutes les pièces jointes"
            title="Retirer toutes les pièces jointes"
            disabled={isGenerating}
            onClick={onRemoveFiles}
          >
            <span aria-hidden="true"></span>
          </button>
        </div>
      )}
      <div className="composer-input-row">
      <label className="attach-button" aria-label="Joindre des fichiers" title="Joindre des fichiers">
        <PlusIcon />
        <input
          type="file"
          multiple
          hidden
          accept={ACCEPTED_ATTACHMENT_EXTENSIONS.join(',')}
          disabled={isGenerating || attachments.length >= MAX_ATTACHMENTS}
          onChange={(event) => {
            onFilesSelected(event.target.files)
            event.target.value = ''
          }}
        />
      </label>
      <textarea
        ref={textareaRef}
        aria-disabled={isGenerating}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Poser une question"
        readOnly={isGenerating}
        rows={1}
        value={draft}
      />
      <button
        className={isGenerating ? 'stop-button' : ''}
        type={isGenerating ? 'button' : 'submit'}
        aria-label={isGenerating ? 'Interrompre la génération' : 'Envoyer'}
        title={isGenerating ? 'Interrompre la génération' : 'Envoyer'}
        disabled={!isGenerating && !canSend}
        onClick={isGenerating ? onStop : undefined}
      >
        {isGenerating ? <StopIcon /> : <span className="send-arrow" aria-hidden="true"></span>}
      </button>
      </div>
    </form>
  )
}
