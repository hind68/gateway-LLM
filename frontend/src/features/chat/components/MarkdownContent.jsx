import { memo, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { normalizeAssistantMarkdown, normalizeMarkdownCodeFences } from '../utils/markdown'
import CodeBlock from './CodeBlock'

function MarkdownContent({ content, copiedKey, direction, onCopy, setCopiedKey }) {
  const normalizedContent = useMemo(
    () => normalizeAssistantMarkdown(normalizeMarkdownCodeFences(content)),
    [content],
  )

  const markdownComponents = useMemo(() => ({
    code({ children, className, ...props }) {
      return <code className={className} {...props}>{children}</code>
    },
    pre({ children }) {
      const child = Array.isArray(children) ? children[0] : children
      const props = child?.props || {}
      const className = props.className || ''
      const match = /language-([^\s]+)/.exec(className)
      const code = String(props.children || '').replace(/\n$/, '')
      return (
        <CodeBlock
          code={code}
          copiedKey={copiedKey}
          language={match?.[1] || 'text'}
          onCopy={onCopy}
          setCopiedKey={setCopiedKey}
        />
      )
    },
    img: MarkdownImage,
  }), [copiedKey, onCopy, setCopiedKey])

  return (
    <div className="markdown-body" dir={direction}>
      <ReactMarkdown
        components={markdownComponents}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  )
}

export function MarkdownImage({ src = '', alt = '', title }) {
  const [hasError, setHasError] = useState(false)
  const imageSrc = String(src || '')
  const imageAlt = String(alt || '')
  const imageTitle = title ? String(title) : undefined

  if (hasError || !isRenderableMarkdownImageUrl(imageSrc)) {
    return (
      <span
        className="markdown-image-fallback"
        data-src={imageSrc || undefined}
        role="img"
        aria-label={fallbackImageLabel(imageAlt)}
        title={imageTitle}
      >
        <span>Image indisponible</span>
        {imageAlt && <small>{imageAlt}</small>}
      </span>
    )
  }

  return (
    <img
      src={imageSrc}
      alt={imageAlt}
      title={imageTitle}
      onError={() => setHasError(true)}
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function isRenderableMarkdownImageUrl(src) {
  try {
    const url = new URL(String(src || ''))
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function fallbackImageLabel(alt) {
  return alt ? `Image indisponible - ${alt}` : 'Image indisponible'
}

export default memo(MarkdownContent)
