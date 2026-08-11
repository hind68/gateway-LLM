import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { CheckIcon, CopyIcon } from '../../../components/common/icons'
import { detectCodeLanguage, formatLanguageName, hashText } from '../utils/markdown'
import SyntaxHighlighter from '../config/syntaxHighlighter'

export default function CodeBlock({ code, copiedKey, language, onCopy, setCopiedKey }) {
  const detectedLanguage = detectCodeLanguage(code, language)
  const copyKey = `code-${hashText(`${detectedLanguage}:${code}`)}`
  const isCopied = copiedKey === copyKey

  async function copyCode() {
    const success = await onCopy(code)
    if (!success) return
    markCopied(copyKey, setCopiedKey)
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{formatLanguageName(detectedLanguage)}</span>
        <button
          type="button"
          aria-label={isCopied ? 'Copié' : 'Copier le code'}
          title={isCopied ? 'Copié' : 'Copier le code'}
          onClick={copyCode}
        >
          {isCopied ? <CheckIcon /> : <CopyIcon tone="light" />}
        </button>
      </div>
      <SyntaxHighlighter
        CodeTag="code"
        PreTag="div"
        customStyle={{
          background: '#0b1020',
          margin: 0,
          padding: '15px 16px',
        }}
        language={detectedLanguage}
        lineNumberStyle={{
          color: 'rgba(203, 213, 225, 0.38)',
          minWidth: '2.25em',
          paddingRight: '1em',
        }}
        showLineNumbers={code.split('\n').length > 15}
        style={oneDark}
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

function markCopied(copyKey, setCopiedKey) {
  setCopiedKey(copyKey)
  window.setTimeout(() => setCopiedKey((current) => (current === copyKey ? '' : current)), 1500)
}
