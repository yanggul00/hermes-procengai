// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

const getSessionMessages = vi.fn().mockResolvedValue({ messages: [{ role: 'user', content: 'hi' }] })
const savePdf = vi.fn().mockResolvedValue({ saved: true })
const katexCss = vi.fn().mockResolvedValue('/*k*/')
const notify = vi.fn()
const notifyError = vi.fn()

vi.mock('@/hermes', () => ({ getSessionMessages }))
vi.mock('@/store/notifications', () => ({ notify, notifyError }))
vi.mock('@/i18n', () => ({ translateNow: (k: string) => k }))
vi.mock('@/lib/chat-messages', () => ({ toChatMessages: (m: unknown) => m }))
vi.mock('@/lib/session-pdf-images', () => ({ collectImageRefs: () => [], resolveImageMap: async () => new Map() }))
vi.mock('@/components/pdf/session-pdf-document', () => ({
  renderSessionPdfHtml: () => '<head><!--KATEX_CSS--></head>'
}))

describe('saveSessionPdf', () => {
  it('builds html (css injected at marker), saves, and notifies success', async () => {
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = { savePdf, katexCss }
    const { saveSessionPdf } = await import('./session-pdf')
    await saveSessionPdf('sess-1', { title: 'My Chat' })
    expect(getSessionMessages).toHaveBeenCalledWith('sess-1', undefined)
    const arg = savePdf.mock.calls[0][0]
    expect(arg.defaultName).toBe('my-chat.pdf')
    expect(arg.html).toContain('<style>/*k*/</style>')
    expect(arg.html).not.toContain('<!--KATEX_CSS-->')
    expect(notify).toHaveBeenCalled()
  })

  it('no-ops on empty sessionId', async () => {
    const { saveSessionPdf } = await import('./session-pdf')
    await saveSessionPdf('')
    expect(getSessionMessages).toHaveBeenCalledTimes(1)
  })
})
