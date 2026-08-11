import { describe, expect, it, vi } from 'vitest'
import { focusTextareaOnNextFrame, shouldFocusComposer } from './composerFocus'

describe('composer focus helpers', () => {
  it('restores focus when the textarea or composer still owns interaction', () => {
    const textarea = {}
    const button = {}
    const composer = { contains: (node) => node === textarea || node === button }

    expect(shouldFocusComposer({ activeElement: textarea, composer, textarea })).toBe(true)
    expect(shouldFocusComposer({ activeElement: button, composer, textarea })).toBe(true)
  })

  it('does not restore focus after the user moves outside the composer', () => {
    const textarea = {}
    const outside = {}
    const composer = { contains: () => false }

    expect(shouldFocusComposer({ activeElement: outside, composer, textarea })).toBe(false)
  })

  it('focuses on the next animation frame instead of synchronously', () => {
    const focus = vi.fn()
    const scheduler = vi.fn((callback) => callback())

    focusTextareaOnNextFrame({ focus }, scheduler)

    expect(scheduler).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledTimes(1)
  })
})
