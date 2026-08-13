import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import ChatMessage from './ChatMessage'
import DocumentInspectorPanel from './DocumentInspectorPanel'
import FileAttachmentCard from './FileAttachmentCard'
import { hashText } from '../utils/markdown'

describe('ChatMessage', () => {
  it('renders a persisted DLP block as a final error without loading dots', () => {
    const html = renderToStaticMarkup(
      <ChatMessage
        copiedKey=""
        fallbackModelName="GPT"
        message={{
          id: 42,
          role: 'USER',
          status: 'DLP_BLOCKED',
          content: 'Ma CIN est AB123456',
          dlpOriginalText: 'Ma CIN est AB123456',
          dlpMaskedText: 'Ma CIN est [MOROCCAN_CIN_1]',
          dlpHighestSeverity: 'HIGH',
          dlpDetectedTypes: ['moroccan_cin'],
          dlpMatches: [{ type: 'moroccan_cin', start: 10, end: 18, lineNumber: 1, placeholder: '[MOROCCAN_CIN_1]' }],
        }}
        onCopy={vi.fn()}
        setCopiedKey={vi.fn()}
      />,
    )

    expect(html).toContain('Votre message a été bloqué')
    expect(html).toContain('Ma CIN est AB123456')
    expect(html).toContain('Une donnée sensible de type CIN a été détectée.')
    expect(html).toContain('Copier mon prompt')
    expect(html).toContain('Copier le message de sécurité')
    expect(html).toContain('Voir la version sécurisée')
    expect(html).toContain('message user')
    expect(html).toContain('message assistant dlp-blocked-response')
    expect(html).toContain('assistant-header')
    expect(html).not.toContain('disabled')
    expect(html).not.toContain('typing-indicator')
  })

  it('shows copied confirmation for the DLP alert copy button', () => {
    const html = renderToStaticMarkup(
      <ChatMessage
        copiedKey="dlp-alert-42"
        fallbackModelName="GPT"
        message={{
          id: 42,
          role: 'USER',
          status: 'DLP_BLOCKED',
          content: 'Ma CIN est AB123456',
          dlpOriginalText: 'Ma CIN est AB123456',
          dlpMaskedText: 'Ma CIN est [MOROCCAN_CIN_1]',
          dlpHighestSeverity: 'HIGH',
          dlpDetectedTypes: ['moroccan_cin'],
          dlpMatches: [{ type: 'moroccan_cin', start: 10, end: 18, lineNumber: 1, placeholder: '[MOROCCAN_CIN_1]' }],
        }}
        onCopy={vi.fn()}
        setCopiedKey={vi.fn()}
      />,
    )

    expect(html).toContain('aria-label="Copié"')
    expect(html).toContain('check-icon')
  })

  it('renders a reloaded DLP block with masked content and disabled original localization', () => {
    const html = renderToStaticMarkup(
      <ChatMessage
        copiedKey=""
        fallbackModelName="GPT"
        message={{
          id: 43,
          role: 'USER',
          status: 'DLP_BLOCKED',
          content: 'Ma CIN est [MOROCCAN_CIN_1]',
          dlpMaskedText: 'Ma CIN est [MOROCCAN_CIN_1]',
          dlpHighestSeverity: 'HIGH',
          dlpDetectedTypes: ['moroccan_cin'],
          dlpMatches: [{ type: 'moroccan_cin', start: 10, end: 18, lineNumber: 1, placeholder: '[MOROCCAN_CIN_1]' }],
        }}
        onCopy={vi.fn()}
        setCopiedKey={vi.fn()}
      />,
    )

    expect(html).toContain('Ma CIN est [MOROCCAN_CIN_1]')
    expect(html).not.toContain('AB123456')
    expect(html).toContain('disabled')
  })

  it('uses the selected model logo for a blocked DLP response', () => {
    const html = renderToStaticMarkup(
      <ChatMessage
        copiedKey=""
        fallbackModelAlias="secure-gemini"
        fallbackModelName="Gemini"
        message={{
          id: 46,
          role: 'USER',
          status: 'DLP_BLOCKED',
          content: 'Token sk-secret',
          modelAlias: 'secure-gemini',
          modelDisplayName: 'Gemini',
          dlpOriginalText: 'Token sk-secret',
          dlpMaskedText: 'Token [OPENAI_API_KEY_1]',
          dlpHighestSeverity: 'HIGH',
          dlpDetectedTypes: ['openai_api_key'],
          dlpMatches: [{ type: 'openai_api_key', start: 6, end: 15, lineNumber: 1, placeholder: '[OPENAI_API_KEY_1]' }],
        }}
        onCopy={vi.fn()}
        setCopiedKey={vi.fn()}
      />,
    )

    expect(html).toContain('/assets/gemini-provider-logo.png')
    expect(html).toContain('Gemini')
    expect(html).not.toContain('>GE<')
  })

  it('keeps user prompt wrapping natural without losing intentional line breaks', () => {
    const shortHtml = renderUserMessage('hello oo')
    const manualBreakHtml = renderUserMessage('hello\noo')
    const longPrompt = 'hello '.repeat(80).trim()
    const longHtml = renderUserMessage(longPrompt)
    const css = readFileSync(new URL('../../../styles/messages.css', import.meta.url), 'utf8')

    expect(shortHtml).toContain('<p>hello oo</p>')
    expect(shortHtml).not.toContain('hello\noo')
    expect(manualBreakHtml).toContain('hello\noo')
    expect(longHtml).toContain(longPrompt)
    expect(cssRule(css, '.message.user .bubble')).toMatch(/width:\s*fit-content;/)
    expect(cssRule(css, '.message.user .bubble')).toMatch(/max-width:\s*min\(75%,\s*48rem\);/)
    expect(cssRule(css, '.user-message-stack')).toMatch(/width:\s*fit-content;/)
    expect(cssRule(css, '.user-message-stack')).toMatch(/max-width:\s*min\(75%,\s*48rem\);/)
    expect(cssRule(css, '.user-text-bubble')).toMatch(/width:\s*fit-content;/)
    expect(cssRule(css, '.user-text-bubble')).toMatch(/max-width:\s*100%;/)
    expect(cssRule(css, '.user-text-bubble')).toMatch(/border-radius:\s*16px 2px 16px 16px;/)
    expect(cssRule(css, '.user-text-bubble')).toMatch(/background-color:\s*#F1F5F9;/)
    expect(cssRule(css, '.message.user .user-text-bubble p')).toMatch(/overflow-wrap:\s*break-word;/)
    expect(cssRule(css, '.message.user .user-text-bubble p')).toMatch(/word-break:\s*normal;/)
    expect(cssRule(css, '.message.user .user-text-bubble p')).toMatch(/white-space:\s*pre-wrap;/)
  })

  it('shows copied confirmation only for the copied assistant message', () => {
    const html = renderToStaticMarkup(
      <ChatMessage
        copiedKey="message-7"
        fallbackModelName="GPT"
        message={{
          id: 7,
          role: 'ASSISTANT',
          status: 'TERMINE',
          content: 'Réponse',
          modelAlias: 'secure-gpt',
        }}
        onCopy={vi.fn()}
        setCopiedKey={vi.fn()}
      />,
    )

    expect(html).toContain('aria-label="Copié"')
    expect(html).toContain('check-icon')
    expect(html).not.toContain('copy-icon')
  })

  it('renders attachment cards as clickable cards without a view button', () => {
    const html = renderToStaticMarkup(
      <FileAttachmentCard
        attachment={{ filename: 'rapport-confidentiel-tres-long.pdf', size: 2048 }}
        onAction={vi.fn()}
      />,
    )

    expect(html).toContain('role="button"')
    expect(html).toContain('is-clickable')
    expect(html).not.toContain('Voir')
    expect(html).not.toContain('Inspecter')
    expect(html).not.toContain('Menaces')
    expect(html).not.toContain('Sécurisé')
    expect(html).not.toContain('Envoyer au LLM')
  })

  it('renders the viewer segmented control labels', () => {
    const html = renderToStaticMarkup(
      <DocumentInspectorPanel
        attachment={{ attachment: { filename: 'secret.txt', decision: 'BLOCK' }, matches: [{ id: 'm1', type: 'ip_address', start: 0, end: 8, lineNumber: 1 }], mode: 'detected' }}
        onClose={vi.fn()}
      />,
    )

    expect(html).toContain('Original')
    expect(html).toContain('Menaces (1)')
    expect(html).toContain('Sécurisé')
    expect(html).toContain('aria-selected="true"')
  })

  it('renders detected threats immediately from the selected attachment target', () => {
    const text = 'first line\nToken sk-test-secret\nEmail admin@example.com'
    const html = renderToStaticMarkup(
      <DocumentInspectorPanel
        attachment={{
          attachment: { id: 12, filename: 'secrets.log', decision: 'MASK' },
          extractedText: text,
          requestedView: 'detected',
          matches: [
            { id: 'openai_api_key_1', type: 'openai_api_key', start: text.indexOf('sk-test-secret'), end: text.indexOf('sk-test-secret') + 'sk-test-secret'.length, lineNumber: 1, severity: 'high', placeholder: '[OPENAI_API_KEY_1]' },
            { id: 'email_1', type: 'email', start: text.indexOf('admin@example.com'), end: text.indexOf('admin@example.com') + 'admin@example.com'.length, lineNumber: 1, severity: 'medium', placeholder: '[EMAIL_1]' },
          ],
        }}
        onClose={vi.fn()}
      />,
    )

    expect(html).toContain('Menaces (2)')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('Ligne 2')
    expect(html).toContain('Ligne 3')
    expect(html).toContain('Token ')
    expect(html).toContain('sk-test-secret')
    expect(html).toContain('Email ')
    expect(html).toContain('admin@example.com')
  })

  it('calculates threat lines from extracted text offsets and wires cards to highlights', () => {
    const text = [
      'line 1',
      'line 2',
      'Email admin@example.com',
      'line 4',
      'line 5',
      'line 6',
      'line 7',
      'Token sk-test-secret',
      'line 9',
      'line 10',
      'line 11',
      'line 12',
      'line 13',
      'line 14',
      'CIN AB123456',
    ].join('\n')
    const matches = [
      matchAt('email_1', 'email', text, 'admin@example.com', 1),
      matchAt('openai_api_key_1', 'openai_api_key', text, 'sk-test-secret', 1),
      matchAt('moroccan_cin_1', 'moroccan_cin', text, 'AB123456', 1),
    ]
    const html = renderToStaticMarkup(
      <DocumentInspectorPanel
        attachment={{
          attachment: { id: 12, filename: 'multiline.txt', decision: 'BLOCK' },
          extractedText: text,
          requestedView: 'detected',
          matches,
        }}
        onClose={vi.fn()}
      />,
    )

    expect(html).toContain('L3')
    expect(html).toContain('L8')
    expect(html).toContain('L15')
    expect(html).toContain('Ligne 3')
    expect(html).toContain('Ligne 8')
    expect(html).toContain('Ligne 15')
    expect(html).toContain('document-threat-navigation shrink-0')
    expect(html).toContain('document-threat-list shrink-0 is-collapsed')
    expect(html).not.toContain('max-h-32')
    expect(html).not.toContain('document-threat-list max-h-32 overflow-y-auto')
    expect(html).toContain('Toutes')
    expect(html).toContain('\u00c9lev\u00e9es')
    expect(html).not.toContain('Voir les autres')
    expect(html).not.toContain('Ligne 1</small>')
    expect(html).toContain('data-target-match-id="email_1"')
    expect(html).toContain('data-match-id="email_1"')
    expect(html).toContain('id="line-3"')
    expect(html).toContain('data-target-match-id="openai_api_key_1"')
    expect(html).toContain('data-match-id="openai_api_key_1"')
    expect(html).toContain('id="line-8"')
    expect(html).toContain('data-target-match-id="moroccan_cin_1"')
    expect(html).toContain('data-match-id="moroccan_cin_1"')
    expect(html).toContain('id="line-15"')
  })

  it('shows the copied label for a copied code block', () => {
    const code = 'console.log("ok")'
    const copiedKey = `code-${hashText(`javascript:${code}`)}`
    const html = renderToStaticMarkup(
      <ChatMessage
        copiedKey={copiedKey}
        fallbackModelName="GPT"
        message={{
          id: 11,
          role: 'ASSISTANT',
          content: `\`\`\`javascript\n${code}\n\`\`\``,
        }}
        onCopy={vi.fn()}
        setCopiedKey={vi.fn()}
      />,
    )

    const codeHeaderHtml = html.slice(html.indexOf('<div class="code-block-header">'), html.indexOf('</div><div style='))
    expect(codeHeaderHtml).toContain('code-copy-button')
    expect(codeHeaderHtml).toContain('is-copied')
    expect(codeHeaderHtml).toContain('Copié')
    expect(codeHeaderHtml).not.toContain('check-icon')
    expect(codeHeaderHtml).not.toContain('copy-icon')
  })

  it('keeps many threat chips compact with summary filters and an expand action', () => {
    const lines = Array.from({ length: 22 }, (_, index) => `line ${index + 1} secret-${index + 1}`)
    const text = lines.join('\n')
    const matches = lines.map((line, index) => {
      const value = `secret-${index + 1}`
      const start = text.indexOf(value)
      return {
        id: `threat_${index + 1}`,
        attachmentId: 12,
        source: 'multiline.txt',
        type: index < 18 ? 'openai_api_key' : 'email',
        start,
        end: start + value.length,
        lineNumber: 1,
        severity: index < 18 ? 'high' : 'medium',
        placeholder: `[THREAT_${index + 1}]`,
      }
    })
    const html = renderToStaticMarkup(
      <DocumentInspectorPanel
        attachment={{
          attachment: { id: 12, filename: 'many.txt', decision: 'BLOCK' },
          extractedText: text,
          requestedView: 'detected',
          matches,
        }}
        onClose={vi.fn()}
      />,
    )

    expect(html).toContain('22 menaces d\u00e9tect\u00e9es')
    expect(html).not.toContain('18 \u00e9lev\u00e9es')
    expect(html).not.toContain('4 moyennes</strong>')
    expect(html).toContain('Toutes')
    expect(html).toContain('\u00c9lev\u00e9es')
    expect(html).toContain('Moyennes')
    expect(html).toContain('Voir les autres')
    expect(html).toContain('document-threat-list shrink-0 is-collapsed')
    expect(html).not.toContain('max-h-32')
    expect(html).not.toContain('document-threat-list max-h-32 overflow-y-auto')
    expect(html).toContain('document-inspection-code flex-1 min-h-0 overflow-y-auto')
    expect((html.match(/data-target-match-id=/g) || [])).toHaveLength(6)
    expect(html).toContain('document-header-tabs')
    expect(html).toContain('document-text-size-trigger')
    expect(html).toContain('Aa')
    expect(html).not.toContain('A-')
    expect(html).not.toContain('A+')
    expect(html).toContain('document-segmented-row')
  })

  it('shows unknown line instead of silently falling back to line one', () => {
    const html = renderToStaticMarkup(
      <DocumentInspectorPanel
        attachment={{
          attachment: { id: 12, filename: 'unknown.txt', decision: 'BLOCK' },
          extractedText: 'short text',
          requestedView: 'detected',
          matches: [
            { id: 'bad_offset_1', attachmentId: 12, source: 'unknown.txt', type: 'email', start: 200, end: 220, lineNumber: 1, severity: 'medium', placeholder: '[EMAIL_1]' },
          ],
        }}
        onClose={vi.fn()}
      />,
    )

    expect(html).toContain('Ligne inconnue')
    expect(html).not.toContain('Ligne 1</small>')
  })

  it('shows a localization error when DLP matches have no extracted text', () => {
    const html = renderToStaticMarkup(
      <DocumentInspectorPanel
        attachment={{
          attachment: { id: 12, filename: 'blocked.txt', decision: 'BLOCK' },
          requestedView: 'detected',
          matches: [
            { id: 'email_1', attachmentId: 12, source: 'blocked.txt', type: 'email', start: 0, end: 18, lineNumber: 1, severity: 'medium', placeholder: '[EMAIL_1]' },
          ],
        }}
        onClose={vi.fn()}
      />,
    )

    expect(html).toContain('Menaces (1)')
    expect(html).toContain('Localisation indisponible')
    expect(html).toContain('Adresse e-mail')
    expect(html).not.toContain('Menaces (0)')
  })

  it('does not fall back to the original preview text in the threats tab', () => {
    const html = renderToStaticMarkup(
      <DocumentInspectorPanel
        attachment={{
          attachment: { id: 12, filename: 'blocked.pdf', decision: 'BLOCK' },
          extractedText: '',
          requestedView: 'detected',
          matches: [
            { id: 'email_1', attachmentId: 12, source: 'blocked.pdf', type: 'email', start: 1200, end: 1218, lineNumber: 8, severity: 'medium', placeholder: '[EMAIL_1]' },
          ],
        }}
        onClose={vi.fn()}
      />,
    )

    expect(html).toContain('Localisation indisponible')
    expect(html).not.toContain('Extraction r\u00e9ussie, mais aucun texte lisible')
  })

  it('renders the file secure version placeholders instead of attachment summary text', () => {
    const html = renderToStaticMarkup(
      <DocumentInspectorPanel
        attachment={{
          attachment: { id: 13, filename: 'safe.txt', decision: 'MASK', maskedText: 'Token [OPENAI_API_KEY_1]' },
          maskedText: 'Pieces jointes: safe.txt',
          requestedView: 'secure',
        }}
        onClose={vi.fn()}
      />,
    )

    expect(html).toContain('[OPENAI_API_KEY_1]')
    expect(html).not.toContain('Pieces jointes: safe.txt')
  })

  it('keeps the inspector scroll inside the content area and the composer centered in chat space', () => {
    const panelsCss = readFileSync(new URL('../../../styles/panels.css', import.meta.url), 'utf8')
    const composerCss = readFileSync(new URL('../../../styles/composer.css', import.meta.url), 'utf8')
    const inspectorSource = readFileSync(new URL('./DocumentInspectorPanel.jsx', import.meta.url), 'utf8')

    expect(cssRule(panelsCss, '.document-inspector-panel')).toMatch(/overflow:\s*hidden;/)
    expect(cssRule(panelsCss, '.document-inspector-viewer')).toMatch(/overflow-y:\s*auto;/)
    expect(cssRule(panelsCss, '.document-inspector-viewer')).toMatch(/overflow-x:\s*hidden;/)
    expect(cssRule(panelsCss, '.document-inspector-viewer')).toMatch(/background:\s*#F8FAFC;/)
    const readerRule = cssRule(panelsCss, '.document-original-code,\n.document-inspection-code,\n.document-secure-text')
    expect(readerRule).toMatch(/background:\s*#F8FAFC;/)
    expect(readerRule).toMatch(/color:\s*#1E293B;/)
    expect(readerRule).toMatch(/font-size:\s*inherit;/)
    expect(readerRule).toMatch(/overflow-y:\s*visible;/)
    expect(readerRule).toMatch(/scrollbar-width:\s*thin;/)
    expect(cssRule(panelsCss, '.document-secure-actionbar')).toMatch(/position:\s*absolute;/)
    expect(cssRule(panelsCss, '.document-secure-actionbar')).toMatch(/bottom:\s*0;/)
    expect(cssRule(panelsCss, '.document-segmented-row')).toMatch(/display:\s*flex !important;/)
    expect(cssRule(panelsCss, '.document-segmented-row')).toMatch(/justify-content:\s*center;/)
    expect(cssRule(panelsCss, '.document-inspector-header')).toMatch(/display:\s*flex;/)
    expect(cssRule(panelsCss, '.document-inspector-header')).toMatch(/justify-content:\s*space-between;/)
    expect(cssRule(panelsCss, '.document-inspector-header')).toMatch(/min-height:\s*48px;/)
    expect(cssRule(panelsCss, '.document-header-tabs')).toMatch(/margin:\s*0 auto;/)
    expect(cssRule(panelsCss, '.document-text-size-trigger')).toMatch(/width:\s*24px;/)
    expect(cssRule(panelsCss, '.document-text-size-trigger')).toMatch(/justify-content:\s*center;/)
    expect(cssRule(panelsCss, '.document-text-size-trigger')).toMatch(/font-size:\s*11px;/)
    expect(cssRule(panelsCss, '.document-text-size-popover')).toMatch(/position:\s*absolute;/)
    expect(cssRule(panelsCss, '.document-text-size-popover')).toMatch(/right:\s*0;/)
    expect(cssRule(panelsCss, '.document-text-size-popover .document-text-size-value')).toMatch(/cursor:\s*default;/)
    expect(cssRule(panelsCss, '.document-text-size-popover .document-text-size-value')).toMatch(/pointer-events:\s*none;/)
    expect(inspectorSource).toContain('className="document-text-size-value"')
    expect(inspectorSource).not.toContain('resetFontSize')
    expect(cssRule(panelsCss, '.document-inspector-header .document-close-button')).toMatch(/border-radius:\s*999px;/)
    expect(cssRule(panelsCss, '.document-dlp-mark')).toMatch(/background:\s*rgba\(254,\s*243,\s*199,\s*0\.5\);/)
    expect(cssRule(panelsCss, '.document-dlp-mark')).toMatch(/color:\s*#78350F;/)
    expect(cssRule(panelsCss, '.document-dlp-mark')).toMatch(/font-weight:\s*600;/)
    expect(cssRule(panelsCss, '.document-threat-list')).toMatch(/overflow:\s*visible;/)
    expect(cssRule(panelsCss, '.document-threat-list')).not.toMatch(/max-height:/)
    expect(cssRule(panelsCss, '.document-threat-list')).not.toMatch(/overflow-y:/)
    expect(cssRule(panelsCss, '.document-threat-list')).not.toMatch(/border-bottom:/)
    expect(cssRule(panelsCss, '.document-threat-list .document-threat-pill.is-active')).not.toMatch(/0F766E|118,\s*110/)
    expect(cssRule(panelsCss, '.document-dlp-mark.is-selected')).not.toMatch(/0F766E|118,\s*110/)
    expect(cssRule(panelsCss, '.document-dlp-mark.is-selected')).toMatch(/outline:\s*none;/)
    expect(cssRule(panelsCss, '.document-inspection-code')).toMatch(/flex:\s*1 1 auto;/)
    expect(cssRule(panelsCss, '.document-inspection-code')).toMatch(/min-height:\s*0;/)
    expect(cssRule(panelsCss, '.document-line code')).not.toMatch(/word-break:\s*break-all;/)
    expect(cssRule(panelsCss, '.document-line')).toMatch(/grid-template-columns:\s*44px minmax\(0,\s*1fr\);/)
    expect(cssRule(panelsCss, '.document-line code')).toMatch(/overflow-wrap:\s*anywhere;/)
    expect(cssRule(panelsCss, '.document-dlp-mark')).toMatch(/box-decoration-break:\s*clone;/)
    expect(inspectorSource).toContain('READER_FONT_SIZE = 13')
    expect(inspectorSource).not.toContain('document-zoom-controls')
    expect(inspectorSource).not.toContain('scale(')
    expect(panelsCss).not.toContain('document-zoom-controls')
    expect(inspectorSource).toContain('fetchAttachmentContent')
    expect(inspectorSource).toContain('fetchAttachmentInspection')
    expect(inspectorSource).toContain('fetchAttachmentSecure')
    expect(inspectorSource).toContain('EXTRACTION_UNAVAILABLE')
    expect(inspectorSource).toContain('isTextLike(extension, contentType)')
    expect(cssRule(composerCss, '.composer-center')).toMatch(/position:\s*static;/)
    expect(cssRule(composerCss, '.composer-center')).toMatch(/width:\s*100%;/)
    expect(cssRule(composerCss, '.composer-center')).toMatch(/min-width:\s*0;/)
    expect(cssRule(composerCss, '.composer-center')).toMatch(/margin-inline:\s*auto;/)
    expect(cssRule(composerCss, '.composer-attachments-wrapper')).toMatch(/overflow:\s*hidden;/)
    expect(cssRule(composerCss, '.composer-attachments-wrapper')).toMatch(/position:\s*relative;/)
    expect(cssRule(composerCss, '.composer-attachments-wrapper')).toMatch(/min-width:\s*0;/)
    expect(cssRule(composerCss, '.composer-attachments-wrapper::after')).toMatch(/pointer-events:\s*none;/)
    expect(cssRule(composerCss, '.composer-attachments-wrapper::after')).toMatch(/right:\s*0;/)
    expect(cssRule(composerCss, '.composer-attachments-wrapper::after')).toMatch(/width:\s*70px;/)
    expect(cssRule(composerCss, '.composer-attachments-wrapper::after')).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.7\)\s*55%,/)
    expect(cssRule(composerCss, '.composer-attachments')).toMatch(/flex:\s*1 1 0;/)
    expect(cssRule(composerCss, '.composer-attachments')).toMatch(/overflow-x:\s*auto;/)
    expect(cssRule(composerCss, '.composer-attachments')).toMatch(/scrollbar-width:\s*none;/)
    expect(cssRule(composerCss, '.composer-attachments')).toMatch(/min-width:\s*0;/)
    expect(cssRule(composerCss, '.composer-attachments')).toMatch(/max-width:\s*100%;/)
    expect(cssRule(composerCss, '.composer-attachments')).toMatch(/padding:\s*6px 50px 8px 6px;/)
    expect(cssRule(composerCss, '.composer button.clear-attachments')).toMatch(/position:\s*absolute;/)
    expect(cssRule(composerCss, '.composer button.clear-attachments')).toMatch(/top:\s*6px;/)
    expect(cssRule(composerCss, '.composer button.clear-attachments')).toMatch(/z-index:\s*20;/)
    expect(cssRule(composerCss, '.composer button.clear-attachments')).toMatch(/background-color:\s*#ffffff;/)
    expect(cssRule(composerCss, '.composer button.clear-attachments')).toMatch(/border:\s*1px solid #e2e8f0;/)
    expect(cssRule(composerCss, '.attachment-chip')).toMatch(/width:\s*var\(--attachment-card-width\);/)
    expect(cssRule(composerCss, '.attachment-chip')).toMatch(/min-width:\s*var\(--attachment-card-width\);/)
    expect(cssRule(composerCss, '.attachment-chip')).toMatch(/max-width:\s*var\(--attachment-card-width\);/)
    expect(cssRule(composerCss, '.attachment-chip')).toMatch(/flex:\s*0 0 var\(--attachment-card-width\);/)
    expect(cssRule(composerCss, '.attachment-chip')).toMatch(/background-color:\s*#f8fafc;/)
    expect(cssRule(composerCss, '.attachment-chip')).toMatch(/border:\s*1px solid #f1f5f9;/)
    expect(cssRule(composerCss, '.attachment-name')).toMatch(/text-overflow:\s*ellipsis;/)
    expect(composerCss).not.toContain('100vw')
  })

  it('keeps blocked responses and the bottom button inside the chat content column', () => {
    const messagesCss = readFileSync(new URL('../../../styles/messages.css', import.meta.url), 'utf8')
    const chatCss = readFileSync(new URL('../../../styles/chat.css', import.meta.url), 'utf8')
    const markdownCss = readFileSync(new URL('../../../styles/markdown.css', import.meta.url), 'utf8')

    expect(cssRule(messagesCss, '.message.assistant.dlp-blocked-response')).toMatch(/width:\s*min\(var\(--assistant-content-width\),\s*calc\(100% - 36px\)\);/)
    expect(cssRule(messagesCss, '.message.assistant.dlp-blocked-response .bubble')).toMatch(/width:\s*100%;/)
    expect(cssRule(messagesCss, '.message.assistant.dlp-blocked-response .bubble')).toMatch(/max-width:\s*100%;/)
    expect(cssRule(messagesCss, '.message.assistant.dlp-blocked-response .dlp-alert')).toMatch(/width:\s*min\(100%,\s*34rem\);/)
    expect(cssRule(messagesCss, '.message.assistant.dlp-blocked-response .dlp-alert')).toMatch(/max-width:\s*min\(100%,\s*34rem\);/)
    expect(cssRule(messagesCss, '.message.assistant.dlp-blocked-response .dlp-alert')).toMatch(/overflow:\s*hidden;/)
    expect(cssRule(messagesCss, '.message.assistant.dlp-blocked-response .dlp-alert.is-expanded')).toMatch(/width:\s*100%;/)
    expect(cssRule(messagesCss, '.message.assistant.dlp-blocked-response .dlp-alert.is-expanded')).toMatch(/max-width:\s*100%;/)
    expect(cssRule(messagesCss, '.message.assistant.dlp-blocked-response')).toMatch(/margin-left:\s*auto;/)
    expect(cssRule(messagesCss, '.message.assistant.dlp-blocked-response')).not.toMatch(/width:\s*100%;/)
    expect(cssRule(chatCss, '.messages')).toMatch(/padding-bottom:\s*136px;/)
    expect(cssRule(chatCss, '.go-bottom-button')).toMatch(/left:\s*50%;/)
    expect(cssRule(chatCss, '.go-bottom-button')).toMatch(/top:\s*var\(--go-bottom-top/)
    expect(cssRule(chatCss, '.go-bottom-button')).not.toMatch(/calc\(100% - 176px\)/)
    expect(cssRule(chatCss, '.go-bottom-button')).not.toMatch(/bottom:\s*132px;/)
    expect(cssRule(chatCss, '.go-bottom-button')).not.toMatch(/right:\s*32px;/)
    expect(cssRule(markdownCss, '.markdown-body')).toMatch(/overflow:\s*hidden;/)
    expect(cssRule(markdownCss, '.markdown-body')).toMatch(/overflow-wrap:\s*break-word;/)
    expect(cssRule(markdownCss, '.markdown-body')).toMatch(/white-space:\s*normal;/)
  })

  it('counts five current attachment matches in the viewer', () => {
    const matches = Array.from({ length: 5 }, (_, index) => ({
      id: `m${index + 1}`,
      source: 'secret.txt',
      type: 'ip_address',
      start: index * 10,
      end: index * 10 + 5,
      lineNumber: index + 1,
    }))
    const html = renderToStaticMarkup(
      <DocumentInspectorPanel
        attachment={{
          attachment: { id: 10, filename: 'secret.txt', decision: 'BLOCK' },
          extractedText: 'aaaaa\nbbbbb\nccccc\nddddd\neeeee',
          matches,
          requestedView: 'detected',
        }}
        onClose={vi.fn()}
      />,
    )

    expect(html).toContain('Menaces (5)')
    expect(html).toContain('style="font-size:13px"')
    expect(html).toContain('data-match-id="m1"')
  })

  it('renders secure masked text without the DOCX limitation banner', () => {
    const html = renderToStaticMarkup(
      <DocumentInspectorPanel
        attachment={{
          attachment: { id: 11, filename: 'secret.docx', decision: 'MASK' },
          maskedText: 'Token [OPENAI_API_KEY_1]\nSuite',
          requestedView: 'secure',
        }}
        onAttachSecure={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(html).toContain('Token ')
    expect(html).toContain('[OPENAI_API_KEY_1]')
    expect(html).toContain('Télécharger')
    expect(html).toContain('Partager')
    expect(html).not.toContain('Mammoth')
    expect(html).not.toContain('conversion PDF')
  })

  it('opens blocked file messages from the clickable attachment card', () => {
    const messagesCss = readFileSync(new URL('../../../styles/messages.css', import.meta.url), 'utf8')
    const html = renderToStaticMarkup(
      <ChatMessage
        copiedKey=""
        fallbackModelName="GPT"
        message={{
          id: 44,
          role: 'USER',
          status: 'DLP_BLOCKED',
          content: 'Pieces jointes: secret.txt',
          dlpMaskedText: 'Token [OPENAI_API_KEY_1]',
          dlpHighestSeverity: 'HIGH',
          dlpDetectedTypes: ['openai_api_key'],
          dlpMatches: [{ id: 'openai_api_key_1', type: 'openai_api_key', start: 6, end: 20, lineNumber: 1, placeholder: '[OPENAI_API_KEY_1]' }],
          attachments: [{ id: 10, filename: 'secret.txt', size: 512, decision: 'BLOCK' }],
        }}
        onCopy={vi.fn()}
        onInspectDocument={vi.fn()}
        setCopiedKey={vi.fn()}
      />,
    )

    expect(html).not.toContain('Inspecter')
    expect(html).not.toContain('Pieces jointes: secret.txt')
    expect(html).not.toContain('Pièces jointes: secret.txt')
    expect(html).not.toContain('Voir secret.txt')
    expect(html).toContain('dlp-file-card')
    expect(html).toContain('message user')
    expect(html).toContain('role="button"')
    expect(cssRule(messagesCss, '.file-message-card.is-clickable')).toMatch(/cursor:\s*pointer;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-card.dlp-file-card')).toMatch(/border:\s*1px solid rgba\(239,\s*68,\s*68,\s*0\.2\);/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-card.dlp-file-card')).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.4\)/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-card.dlp-file-card')).toMatch(/padding:\s*8px 12px;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-card.dlp-file-card')).toMatch(/gap:\s*12px;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-card.dlp-file-card')).toMatch(/flex:\s*0 0 auto;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-card.dlp-file-card')).toMatch(/flex-shrink:\s*0;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-card.dlp-file-card')).toMatch(/overflow:\s*hidden;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-card.dlp-file-card')).toMatch(/width:\s*calc\(100% - 24px\);/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-card.dlp-file-card')).toMatch(/max-width:\s*500px;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-card.dlp-file-card')).toMatch(/margin-inline:\s*auto;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-card.dlp-file-card')).toMatch(/min-width:\s*0;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .message-attachments')).toMatch(/gap:\s*8px;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .message-attachments')).toMatch(/width:\s*100%;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .message-attachments')).toMatch(/align-items:\s*center;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .message-attachments')).not.toMatch(/max-height:/)
    expect(cssRule(messagesCss, '.dlp-file-panel .message-attachments')).not.toMatch(/overflow-y:/)
    expect(cssRule(messagesCss, '.message.assistant.dlp-blocked-response .dlp-alert')).toMatch(/max-width:\s*560px;/)
    expect(cssRule(messagesCss, '.message.assistant.dlp-blocked-response .dlp-alert')).toMatch(/margin-right:\s*auto;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-card.dlp-file-card.is-clickable:hover')).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.7\)/)
    expect(cssRule(messagesCss, '.file-message-card')).toMatch(/width:\s*var\(--attachment-card-width\);/)
    expect(cssRule(messagesCss, '.file-message-card')).toMatch(/min-width:\s*var\(--attachment-card-width\);/)
    expect(cssRule(messagesCss, '.file-message-card')).toMatch(/max-width:\s*var\(--attachment-card-width\);/)
    expect(cssRule(messagesCss, '.file-message-copy strong')).toMatch(/text-overflow:\s*ellipsis;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-card.dlp-file-card .file-type-icon')).toMatch(/width:\s*24px;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-card.dlp-file-card .file-type-icon')).toMatch(/flex-shrink:\s*0;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-copy')).toMatch(/flex-direction:\s*column;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-copy')).toMatch(/justify-content:\s*center;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-copy strong')).toMatch(/font-size:\s*12\.5px;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-copy strong')).toMatch(/line-height:\s*1\.2;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-copy small')).toMatch(/font-size:\s*10\.5px;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-copy small')).toMatch(/margin-top:\s*2px;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-card.dlp-file-card.is-clickable')).toMatch(/cursor:\s*pointer;/)
    expect(cssRule(messagesCss, '.dlp-file-panel .file-message-card.dlp-file-card.is-clickable:hover')).toMatch(/border-color:\s*rgba\(239,\s*68,\s*68,\s*0\.4\);/)
    expect(cssRule(messagesCss, '.dlp-attachments-toggle')).toMatch(/justify-content:\s*center;/)
    expect(cssRule(messagesCss, '.dlp-attachments-toggle')).toMatch(/width:\s*100%;/)
    expect(cssRule(messagesCss, '.dlp-attachments-toggle')).toMatch(/border-top:\s*1px solid rgba\(239,\s*68,\s*68,\s*0\.15\);/)
    expect(messagesCss).not.toContain('.dlp-file-panel .message-attachments::-webkit-scrollbar')
    expect(messagesCss).not.toContain('scrollbar-color: rgba(248, 113, 113, 0.28)')
    expect(messagesCss).not.toContain('content: "Ouvrir"')
    expect(messagesCss).not.toContain('dlp-inspect-primary')
    expect(messagesCss).not.toContain('dlp-inspect-button')
    expect(html).not.toContain('OPENAI_API_KEY_1</span><span class="dlp-detection-type"')
  })

  it('collapses DLP blocked attachments to three cards with a dynamic toggle', () => {
    ;[
      [4, 'Afficher 1 autre', 'fichier-confidentiel-4-avec-un-nom-tres-long.pdf'],
      [7, 'Afficher 4 autres', 'fichier-confidentiel-4-avec-un-nom-tres-long.pdf'],
      [10, 'Afficher 7 autres', 'fichier-confidentiel-4-avec-un-nom-tres-long.pdf'],
    ].forEach(([count, label, hiddenFilename]) => {
    const html = renderToStaticMarkup(
      <ChatMessage
        copiedKey=""
        fallbackModelName="GPT"
        message={{
          id: 47,
          role: 'USER',
          status: 'DLP_BLOCKED',
          content: 'Pieces jointes: fichiers',
          dlpMaskedText: 'Token [OPENAI_API_KEY_1]',
          dlpHighestSeverity: 'HIGH',
          dlpDetectedTypes: ['openai_api_key'],
          dlpMatches: [],
          attachments: Array.from({ length: count }, (_, index) => ({
            id: index + 1,
            filename: `fichier-confidentiel-${index + 1}-avec-un-nom-tres-long.pdf`,
            size: 71475,
            decision: 'BLOCK',
          })),
        }}
        onCopy={vi.fn()}
        onInspectDocument={vi.fn()}
        setCopiedKey={vi.fn()}
      />,
    )

    const dlpPanelHtml = html.slice(html.indexOf('<section class="dlp-file-panel">'))
    expect((dlpPanelHtml.match(/dlp-file-card/g) || [])).toHaveLength(3)
    expect(dlpPanelHtml).toContain(label)
    expect(dlpPanelHtml).toContain('/assets/down.png')
    expect(dlpPanelHtml).not.toContain(hiddenFilename)
    })
  })

  it('does not show the DLP attachment toggle when three files fit in the collapsed list', () => {
    const html = renderToStaticMarkup(
      <ChatMessage
        copiedKey=""
        fallbackModelName="GPT"
        message={{
          id: 48,
          role: 'USER',
          status: 'DLP_BLOCKED',
          content: 'Pieces jointes: fichiers',
          dlpMaskedText: 'Token [OPENAI_API_KEY_1]',
          dlpHighestSeverity: 'HIGH',
          dlpDetectedTypes: ['openai_api_key'],
          dlpMatches: [],
          attachments: Array.from({ length: 3 }, (_, index) => ({
            id: index + 1,
            filename: `fichier-${index + 1}.pdf`,
            size: 1024,
            decision: 'BLOCK',
          })),
        }}
        onCopy={vi.fn()}
        onInspectDocument={vi.fn()}
        setCopiedKey={vi.fn()}
      />,
    )

    expect((html.match(/dlp-file-card/g) || [])).toHaveLength(3)
    expect(html).not.toContain('Afficher')
    expect(html).not.toContain('dlp-attachments-toggle')
  })

  it('shows only DLP-signaled attachments inside blocked file alerts', () => {
    const html = renderToStaticMarkup(
      <ChatMessage
        copiedKey=""
        fallbackModelName="GPT"
        message={{
          id: 45,
          role: 'USER',
          status: 'DLP_BLOCKED',
          content: 'Pieces jointes: clean.pdf, secret.txt',
          dlpMaskedText: 'Token [OPENAI_API_KEY_1]',
          dlpHighestSeverity: 'HIGH',
          dlpDetectedTypes: ['openai_api_key'],
          dlpMatches: [{ id: 'openai_api_key_1', attachmentId: 11, type: 'openai_api_key', start: 6, end: 20, lineNumber: 1, placeholder: '[OPENAI_API_KEY_1]' }],
          attachments: [
            { id: 10, filename: 'clean.pdf', size: 512, decision: 'ALLOW' },
            { id: 11, filename: 'secret.txt', size: 512, decision: 'BLOCK' },
          ],
        }}
        onCopy={vi.fn()}
        onInspectDocument={vi.fn()}
        setCopiedKey={vi.fn()}
      />,
    )

    const blockedPanelHtml = html.slice(html.indexOf('dlp-file-panel'))
    expect(html).toContain('clean.pdf')
    expect(blockedPanelHtml).toContain('secret.txt')
    expect(blockedPanelHtml).not.toContain('clean.pdf</strong>')
  })
})

function renderUserMessage(content) {
  return renderToStaticMarkup(
    <ChatMessage
      copiedKey=""
      fallbackModelName="GPT"
      message={{
        id: `user-${content.length}`,
        role: 'USER',
        status: 'TERMINE',
        content,
      }}
      onCopy={vi.fn()}
      setCopiedKey={vi.fn()}
    />,
  )
}

function matchAt(id, type, text, value, lineNumber = 1) {
  const start = text.indexOf(value)
  return {
    id,
    attachmentId: 12,
    source: 'multiline.txt',
    type,
    start,
    end: start + value.length,
    lineNumber,
    severity: 'high',
    placeholder: `[${id.toUpperCase()}]`,
  }
}

function cssRule(css, selector) {
  const normalizedCss = css.replace(/\r\n/g, '\n')
  const matches = [...normalizedCss.matchAll(new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, 'g'))]
  expect(matches.length, `${selector} rule`).toBeGreaterThan(0)
  return matches[matches.length - 1][1]
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
