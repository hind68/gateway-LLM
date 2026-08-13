import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch, apiFetchResponse } from './client'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('api client', () => {
  it('parses JSON responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    })))

    await expect(apiFetch('/health')).resolves.toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/health$/), expect.any(Object))
  })

  it('returns undefined for 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))

    await expect(apiFetch('/empty')).resolves.toBeUndefined()
  })

  it('preserves raw responses for streaming callers', async () => {
    const response = new Response('data: hi\n\n', { status: 200 })
    vi.stubGlobal('fetch', vi.fn(async () => response))

    await expect(apiFetchResponse('/stream')).resolves.toBe(response)
  })

  it('raises ApiError with status and backend message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'nope' }), {
      headers: { 'content-type': 'application/json' },
      status: 400,
    })))

    await expect(apiFetch('/bad')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      details: 'nope',
      payload: { message: 'nope' },
    })
    await expect(apiFetch('/bad')).rejects.toBeInstanceOf(ApiError)
  })

  it('preserves structured backend error payloads', async () => {
    const payload = {
      code: 'ATTACHMENT_LIMIT_EXCEEDED',
      message: "Vous pouvez joindre jusqu'a 10 fichiers par message.",
      maxFiles: 10,
      receivedFiles: 11,
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), {
      headers: { 'content-type': 'application/json' },
      status: 400,
    })))

    await expect(apiFetch('/bad')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      details: payload.message,
      payload,
    })
  })
})
