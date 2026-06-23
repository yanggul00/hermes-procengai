import { translateNow } from '@/i18n'
import { pdfFilenameFromTitle } from '@/lib/session-pdf-filename'
import { buildSessionPdfHtml, type SessionPdfOpts } from '@/lib/session-pdf-html'
import { notify, notifyError } from '@/store/notifications'

// Save the whole session as a PDF (Feat-1 sidebar item + Feat-2 ctx 'save').
export async function saveSessionPdf(sessionId: string, opts: SessionPdfOpts = {}): Promise<void> {
  if (!sessionId) {
    return
  }

  try {
    const html = await buildSessionPdfHtml(sessionId, opts)
    const result = await window.hermesDesktop.savePdf({ html, defaultName: pdfFilenameFromTitle(opts.title) })

    if (result.saved) {
      notify({ kind: 'success', message: translateNow('desktop.sessionPdfSaved'), durationMs: 2_000 })
    }
  } catch (err) {
    notifyError(err, translateNow('desktop.sessionPdfFailed'))
  }
}
