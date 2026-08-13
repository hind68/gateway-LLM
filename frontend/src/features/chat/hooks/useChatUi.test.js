import { describe, expect, it } from 'vitest'
import { exceedsMaxAttachments, MAX_ATTACHMENTS } from './useChatUi'

describe('chat attachment limits', () => {
  it('allows up to ten files and refuses the whole selection above the limit', () => {
    expect(MAX_ATTACHMENTS).toBe(10)
    expect(exceedsMaxAttachments(0, MAX_ATTACHMENTS - 1)).toBe(false)
    expect(exceedsMaxAttachments(0, MAX_ATTACHMENTS)).toBe(false)
    expect(exceedsMaxAttachments(9, 1)).toBe(false)
    expect(exceedsMaxAttachments(10, 1)).toBe(true)
    expect(exceedsMaxAttachments(8, 3)).toBe(true)
  })
})
