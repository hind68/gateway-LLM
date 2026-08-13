export const PENDING_ATTACHMENTS_DB = 'synapse.pendingAttachments'
export const PENDING_ATTACHMENTS_STORE = 'files'

const DB_VERSION = 1

export function pendingAttachmentKey(file) {
  return `${file?.name || ''}:${file?.size || 0}:${file?.type || ''}:${file?.lastModified || 0}`
}

export async function loadPendingAttachments() {
  const db = await openPendingAttachmentsDb()
  const records = await readAllRecords(db)
  return records
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(recordToFile)
    .filter(Boolean)
}

export async function savePendingAttachments(files) {
  const db = await openPendingAttachmentsDb()
  const records = Array.from(files || []).map((file, index) => ({
    key: pendingAttachmentKey(file),
    name: file.name || 'fichier',
    size: file.size || 0,
    type: file.type || '',
    lastModified: file.lastModified || Date.now(),
    order: index,
    blob: file,
  }))
  await replaceRecords(db, records)
}

export async function clearPendingAttachments() {
  const db = await openPendingAttachmentsDb()
  await clearStore(db)
}

function recordToFile(record) {
  if (!record?.blob) return null
  try {
    return new File([record.blob], record.name || 'fichier', {
      type: record.type || record.blob.type || '',
      lastModified: record.lastModified || Date.now(),
    })
  } catch {
    return null
  }
}

function openPendingAttachmentsDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible'))
      return
    }

    const request = indexedDB.open(PENDING_ATTACHMENTS_DB, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PENDING_ATTACHMENTS_STORE)) {
        db.createObjectStore(PENDING_ATTACHMENTS_STORE, { keyPath: 'key' })
      }
    }
    request.onerror = () => reject(request.error || new Error('Impossible d ouvrir IndexedDB'))
    request.onsuccess = () => resolve(request.result)
  })
}

function readAllRecords(db) {
  return new Promise((resolve, reject) => {
    let records = []
    const transaction = db.transaction(PENDING_ATTACHMENTS_STORE, 'readonly')
    const store = transaction.objectStore(PENDING_ATTACHMENTS_STORE)
    const request = store.getAll()
    request.onerror = () => reject(request.error || new Error('Impossible de lire les pieces jointes'))
    request.onsuccess = () => {
      records = request.result || []
    }
    transaction.oncomplete = () => resolve(records)
    transaction.onerror = () => reject(transaction.error || new Error('Erreur IndexedDB'))
    transaction.onabort = () => reject(transaction.error || new Error('Transaction IndexedDB annulee'))
  })
}

function replaceRecords(db, records) {
  return transactionPromise(db, 'readwrite', (store) => {
    store.clear()
    records.forEach((record) => store.put(record))
  })
}

function clearStore(db) {
  return transactionPromise(db, 'readwrite', (store) => {
    store.clear()
  })
}

function transactionPromise(db, mode, run) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PENDING_ATTACHMENTS_STORE, mode)
    const store = transaction.objectStore(PENDING_ATTACHMENTS_STORE)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('Erreur IndexedDB'))
    transaction.onabort = () => reject(transaction.error || new Error('Transaction IndexedDB annulee'))
    run(store, resolve, reject)
  })
}
