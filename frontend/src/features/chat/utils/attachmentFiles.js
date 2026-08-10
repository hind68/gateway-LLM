export const IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif',
]

export const TEXT_EXTENSIONS = [
  '.txt', '.md', '.log', '.ini', '.cfg', '.conf', '.toml', '.yml', '.yaml',
]

export const CODE_EXTENSIONS = [
  '.py', '.pyw', '.c', '.h', '.cpp', '.hpp', '.cc', '.cs', '.java',
  '.js', '.jsx', '.ts', '.tsx', '.go', '.rb', '.php', '.rs', '.swift',
  '.kt', '.kts', '.scala', '.sh', '.bash', '.ps1', '.sql', '.r',
  '.json', '.xml', '.html', '.htm', '.css',
]

export const DOCUMENT_EXTENSIONS = [
  '.pdf', '.docx', '.pptx', '.csv', '.xlsx', '.zip',
]

export const ACCEPTED_ATTACHMENT_EXTENSIONS = [
  ...DOCUMENT_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
  ...TEXT_EXTENSIONS,
  ...CODE_EXTENSIONS,
]

const SPECIFIC_FILE_ICONS = {
  csv: '/assets/sheets.png',
  doc: '/assets/doc.png',
  docx: '/assets/doc.png',
  pdf: '/assets/pdf.png',
  ppt: '/assets/ppt.png',
  pptx: '/assets/ppt.png',
  xls: '/assets/sheets.png',
  xlsx: '/assets/sheets.png',
  zip: '/assets/zip.png',
}

export function getAttachmentIconSrc(filename) {
  const extension = fileExtension(filename)
  if (SPECIFIC_FILE_ICONS[extension]) return SPECIFIC_FILE_ICONS[extension]
  if (hasExtension(extension, IMAGE_EXTENSIONS)) return '/assets/photo.png'
  if (hasExtension(extension, CODE_EXTENSIONS)) return '/assets/script.png'
  if (hasExtension(extension, TEXT_EXTENSIONS)) return '/assets/text.png'
  return '/assets/document.png'
}

export function fileExtension(filename) {
  const match = String(filename || '').toLowerCase().match(/\.([a-z0-9]+)$/)
  return match ? match[1] : ''
}

function hasExtension(extension, extensions) {
  return extensions.includes(`.${extension}`)
}
