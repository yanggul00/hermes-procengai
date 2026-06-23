// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const buildSessionPdfHtml = vi.fn().mockResolvedValue('<html>DOC</html>')
const notifyError = vi.fn()
vi.mock('@/lib/session-pdf-html', () => ({ buildSessionPdfHtml }))
vi.mock('@/store/notifications', () => ({ notify: vi.fn(), notifyError }))
vi.mock('@/i18n', () => ({ translateNow: (k: string) => k }))

describe('printSessionPdf', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('writes html to an iframe and calls print', async () => {
    const printed: boolean[] = []
    // fakeWin needs focus() AND print() — printSessionPdf calls win.focus() first.
    const fakeWin = { focus: () => {}, print: () => printed.push(true), document: { open() {}, write() {}, close() {} } }
    const iframe = { style: {}, contentWindow: fakeWin } as never
    vi.spyOn(document, 'createElement').mockReturnValue(iframe)
    vi.spyOn(document.body, 'appendChild').mockImplementation(node => node)
    vi.spyOn(document.body, 'removeChild').mockImplementation(node => node)
    const { printSessionPdf } = await import('./session-print')
    await printSessionPdf('sess-1', { title: 't' })
    // Print forces inlineLinkUrls so URLs are visible (the print dialog flattens links).
    expect(buildSessionPdfHtml).toHaveBeenCalledWith('sess-1', { title: 't', inlineLinkUrls: true })
    // print() runs inside a settle setTimeout — advance fake timers to fire it.
    await vi.runAllTimersAsync()
    expect(printed.length).toBe(1)
  })

  it('no-ops on empty id', async () => {
    const { printSessionPdf } = await import('./session-print')
    await printSessionPdf('')
    expect(buildSessionPdfHtml).toHaveBeenCalledTimes(1)
  })
})
