import { describe, expect, it } from 'vitest'
import { ACCEPTED_ATTACHMENT_EXTENSIONS, getAttachmentIconSrc } from './attachmentFiles'

describe('attachment file helpers', () => {
  it('maps text image and code extensions to the shared icons', () => {
    expect(getAttachmentIconSrc('notes.txt')).toBe('/assets/text.png')
    expect(getAttachmentIconSrc('photo.webp')).toBe('/assets/photo.png')
    expect(getAttachmentIconSrc('script.ts')).toBe('/assets/script.png')
  })

  it('keeps specific icons for the main document types', () => {
    expect(getAttachmentIconSrc('report.pdf')).toBe('/assets/pdf.png')
    expect(getAttachmentIconSrc('contract.docx')).toBe('/assets/doc.png')
    expect(getAttachmentIconSrc('sheet.csv')).toBe('/assets/sheets.png')
    expect(getAttachmentIconSrc('archive.zip')).toBe('/assets/zip.png')
  })

  it('accepts the extensions supported by the DLP upload flow', () => {
    expect(ACCEPTED_ATTACHMENT_EXTENSIONS).toEqual(expect.arrayContaining([
      '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif',
      '.docx', '.pptx', '.csv', '.xlsx', '.zip',
      '.txt', '.md', '.log', '.ini', '.cfg', '.conf', '.toml', '.yml', '.yaml',
      '.py', '.pyw', '.c', '.h', '.cpp', '.hpp', '.cc', '.cs', '.java',
      '.js', '.jsx', '.ts', '.tsx', '.go', '.rb', '.php', '.rs', '.swift',
      '.kt', '.kts', '.scala', '.sh', '.bash', '.ps1', '.sql', '.r',
      '.json', '.xml', '.html', '.htm', '.css',
    ]))
  })
})
