import { translateNow } from '@/i18n'
import { buildSessionPdfHtml, type SessionPdfOpts } from '@/lib/session-pdf-html'
import { notifyError } from '@/store/notifications'

// Print the whole chat via a hidden iframe → OS print dialog (where the user can
// pick a printer or "Save as PDF"). Same data-driven HTML as Save, so identical
// fidelity and independent of the live selection.
export async function printSessionPdf(sessionId: string, opts: SessionPdfOpts = {}): Promise<void> {
  if (!sessionId) {
    return
  }

  try {
    // Print flattens clickable link annotations → show URLs as visible text.
    const html = await buildSessionPdfHtml(sessionId, { ...opts, inlineLinkUrls: true })

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const win = iframe.contentWindow

    if (!win) {
      document.body.removeChild(iframe)

      return
    }

    win.document.open()
    win.document.write(html)
    win.document.close()

    // Give images/fonts a tick to settle, then print and clean up.
    window.setTimeout(() => {
      win.focus()
      win.print()
      window.setTimeout(() => document.body.removeChild(iframe), 1_000)
    }, 250)
  } catch (err) {
    notifyError(err, translateNow('desktop.sessionPdfFailed'))
  }
}
