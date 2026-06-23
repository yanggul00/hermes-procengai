import { renderSessionPdfHtml } from '@/components/pdf/session-pdf-document'
import { getSessionMessages } from '@/hermes'
import type { SessionInfo } from '@/hermes'
import { toChatMessages } from '@/lib/chat-messages'
import { collectImageRefs, resolveImageMap } from '@/lib/session-pdf-images'

export interface SessionPdfOpts {
  profile?: string | null
  title?: string | null
  session?: SessionInfo
}

// Fetch a session, normalize it the same way the chat does (toChatMessages),
// resolve every image ref to a data URL, render to print HTML, and inject the
// KaTeX CSS (with embedded fonts, fetched from main). Returns COMPLETE,
// self-contained HTML used by BOTH Save (printToPDF) and Print (iframe).
export async function buildSessionPdfHtml(sessionId: string, opts: SessionPdfOpts = {}): Promise<string> {
  const profile = opts.profile ?? opts.session?.profile
  const { messages } = await getSessionMessages(sessionId, profile)
  const chat = toChatMessages(messages)
  const imageMap = await resolveImageMap(collectImageRefs(chat))
  const html = renderSessionPdfHtml({ messages: chat, title: opts.title, imageMap })
  const katexCss = await window.hermesDesktop.katexCss()

  return html.replace('<!--KATEX_CSS-->', `<style>${katexCss}</style>`)
}
