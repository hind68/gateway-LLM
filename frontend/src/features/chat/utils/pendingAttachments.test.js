import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearPendingAttachments, loadPendingAttachments, pendingAttachmentKey, savePendingAttachments } from './pendingAttachments'

describe('pending attachments persistence', () => {
  beforeEach(() => {
    globalThis.indexedDB = createIndexedDbMock()
  })

  afterEach(() => {
    delete globalThis.indexedDB
  })

  it('restores files, preserves removal, and clears explicit deletes', async () => {
    const files = [
      new File(['alpha'], 'alpha.txt', { type: 'text/plain', lastModified: 1 }),
      new File(['beta'], 'beta.txt', { type: 'text/plain', lastModified: 2 }),
      new File(['gamma'], 'gamma.txt', { type: 'text/plain', lastModified: 3 }),
    ]

    await savePendingAttachments(files)
    const restored = await loadPendingAttachments()

    expect(restored.map((file) => file.name)).toEqual(['alpha.txt', 'beta.txt', 'gamma.txt'])
    expect(restored[0]).toBeInstanceOf(File)
    expect(restored[1].type).toBe('text/plain')
    expect(restored[2].lastModified).toBe(3)

    await savePendingAttachments(restored.filter((file) => file.name !== 'beta.txt'))
    expect((await loadPendingAttachments()).map((file) => file.name)).toEqual(['alpha.txt', 'gamma.txt'])

    await clearPendingAttachments()
    expect(await loadPendingAttachments()).toEqual([])
  })

  it('uses stable keys that prevent duplicate pending files', () => {
    const file = new File(['alpha'], 'alpha.txt', { type: 'text/plain', lastModified: 1 })

    expect(pendingAttachmentKey(file)).toBe('alpha.txt:5:text/plain:1')
  })
})

function createIndexedDbMock() {
  const stores = new Map()

  return {
    open() {
      const request = {}
      queueMicrotask(() => {
        const db = createDb(stores)
        request.result = db
        request.onupgradeneeded?.()
        request.onsuccess?.()
      })
      return request
    },
  }
}

function createDb(stores) {
  return {
    objectStoreNames: {
      contains: (name) => stores.has(name),
    },
    createObjectStore(name) {
      if (!stores.has(name)) stores.set(name, new Map())
    },
    transaction(name) {
      if (!stores.has(name)) stores.set(name, new Map())
      const tx = {
        objectStore: () => createObjectStoreApi(stores.get(name)),
      }
      setTimeout(() => tx.oncomplete?.(), 0)
      return tx
    },
  }
}

function createObjectStoreApi(store) {
  return {
    getAll() {
      const request = {}
      queueMicrotask(() => {
        request.result = Array.from(store.values())
        request.onsuccess?.()
      })
      return request
    },
    clear() {
      store.clear()
    },
    put(record) {
      store.set(record.key, record)
    },
  }
}
