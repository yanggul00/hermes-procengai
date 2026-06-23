import { describe, expect, it } from 'vitest'

import { pdfFilenameFromTitle } from './session-pdf-filename'

describe('pdfFilenameFromTitle', () => {
  it('sanitizes a normal title', () => {
    expect(pdfFilenameFromTitle('My Chat: Plans!')).toBe('my-chat-plans.pdf')
  })
  it('falls back when empty', () => {
    expect(pdfFilenameFromTitle('')).toBe('session.pdf')
    expect(pdfFilenameFromTitle(null)).toBe('session.pdf')
    expect(pdfFilenameFromTitle('   ')).toBe('session.pdf')
  })
  it('caps length', () => {
    expect(pdfFilenameFromTitle('x'.repeat(200))).toBe('x'.repeat(48) + '.pdf')
  })
})
