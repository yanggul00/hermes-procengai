import { createContext, useContext, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Streamdown } from 'streamdown'

import { buildToolView, type ToolPart } from '@/components/assistant-ui/tool-fallback-model'
import type { ChatMessage, ChatMessagePart } from '@/lib/chat-messages'
import { generatedImageFromResult } from '@/lib/generated-images'
import { createMemoizedMathPlugin } from '@/lib/katex-memo'
import { mediaKind, mediaName, mediaPathFromMarkdownHref } from '@/lib/media'
import { sessionPdfCss } from '@/lib/session-pdf-css'

const math = createMemoizedMathPlugin({ singleDollarTextMath: true })

const ROLE_LABEL: Record<string, string> = { assistant: 'Assistant', system: 'System', tool: 'Tool', user: 'You' }

// Content key for matching a reasoning part against the live chat DOM: lowercase
// alphanumerics only (so raw markdown vs. rendered textContent still match), capped.
export function thinkingKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 80)
}

// Collect the keys of thinking blocks currently EXPANDED in the live chat. Open
// disclosures render `[data-slot="aui_reasoning-text"]`; collapsed ones render
// nothing — so presence in the DOM == expanded. Reflects the active session only.
export function collectExpandedThinkingKeys(): Set<string> {
  const keys = new Set<string>()
  for (const el of document.querySelectorAll('[data-slot="aui_reasoning-text"]')) {
    const key = thinkingKey(el.textContent ?? '')
    if (key) keys.add(key)
  }
  return keys
}

// On in the Print path only: also render the URL as visible text next to a link.
// The OS print dialog (Windows "Microsoft Print to PDF" etc.) flattens clickable
// link annotations, so the visible URL keeps the link "associated" on the page.
// Save leaves this off — its printToPDF output keeps links genuinely clickable.
const ShowLinkUrlsContext = createContext(false)

// Streamdown renders links as a <button> with the URL only in client JS state,
// so static output loses the href entirely. Override `a` to emit a real anchor
// (keeps the link — incl. numeric "citation" links — clickable in the PDF).
function PdfLink({ href, children }: ComponentProps<'a'>) {
  const showUrl = useContext(ShowLinkUrlsContext)

  if (!href) {
    return <>{children}</>
  }

  const label = typeof children === 'string' ? children : ''

  return (
    <>
      <a href={href}>{children}</a>
      {showUrl && label !== href ? <span className="link-url"> ({href})</span> : null}
    </>
  )
}

const PDF_COMPONENTS = { a: PdfLink } as ComponentProps<typeof Streamdown>['components']

// Markdown body (static): tables + KaTeX math; code as plain monospace.
function Md({ children }: { children: string }) {
  return (
    <Streamdown components={PDF_COMPONENTS} mode="static" parseIncompleteMarkdown={false} plugins={{ math }}>
      {children}
    </Streamdown>
  )
}

// Pull image refs out of a text part and strip them from the prose — they render
// as separate <img> below (uniform with generated images, and independent of
// Streamdown's image policy). Returns the cleaned text + the refs found in order.
function splitTextAndImages(text: string): { refs: string[]; text: string } {
  const refs: string[] = []

  let cleaned = text.replace(/\[([^\]]*)\]\(#media:([^)]+)\)/g, (whole, _label, enc) => {
    const path = mediaPathFromMarkdownHref(`#media:${enc}`)
    if (path && mediaKind(path) === 'image') {
      refs.push(path)
      return ''
    }
    return whole
  })

  cleaned = cleaned.replace(/@image:(?:"([^"\n]+)"|'([^'\n]+)'|`([^`\n]+)`|(\S+))/g, (whole, a, b, c, d) => {
    const path = a ?? b ?? c ?? d ?? ''
    if (path) {
      refs.push(path)
      return ''
    }
    return whole
  })

  return { refs, text: cleaned.replace(/\n{3,}/g, '\n\n').trim() }
}

function ImageOrPlaceholder({ refKey, imageMap }: { refKey: string; imageMap: Map<string, string> }) {
  const src = imageMap.get(refKey)
  return src ? <img alt="" src={src} /> : <div className="img-missing">[image unavailable: {mediaName(refKey)}]</div>
}

// expandedThinking: null → marker-only (closed session, e.g. sidebar Save);
// a Set → include thinking text only for blocks expanded in the live chat
// (active-window Print/Save), else a compact "Thinking" marker.
function PartView({
  part,
  imageMap,
  expandedThinking
}: {
  part: ChatMessagePart
  imageMap: Map<string, string>
  expandedThinking: Set<string> | null
}) {
  if (part.type === 'reasoning') {
    const text = (part as { text: string }).text
    if (!text.trim()) {
      return null
    }
    const expanded = expandedThinking !== null && expandedThinking.has(thinkingKey(text))
    if (!expanded) {
      return <div className="thinking-marker">Thinking</div>
    }
    return (
      <div className="thinking">
        <div className="thinking-label">Thinking</div>
        <Md>{text}</Md>
      </div>
    )
  }

  if (part.type === 'text') {
    const { refs, text } = splitTextAndImages((part as { text: string }).text)
    return (
      <>
        {text && <Md>{text}</Md>}
        {refs.map((ref, i) => <ImageOrPlaceholder imageMap={imageMap} key={i} refKey={ref} />)}
      </>
    )
  }

  if (part.type === 'tool-call') {
    if (part.toolName === 'image_generate') {
      const ref = generatedImageFromResult(part.result)
      return ref ? <ImageOrPlaceholder imageMap={imageMap} refKey={ref} /> : null
    }
    // Mirror the chat's human-friendly tool headline ("Ran foo.py",
    // "Analyzed image") via the same buildToolView used by the live chat.
    const view = buildToolView(part as unknown as ToolPart, '')
    return <div className="tool-marker">🔧 {view.title}</div>
  }

  return null
}

function MessageView({
  message,
  imageMap,
  expandedThinking
}: {
  message: ChatMessage
  imageMap: Map<string, string>
  expandedThinking: Set<string> | null
}) {
  return (
    <div className="msg">
      <div className="msg-role">{ROLE_LABEL[message.role] ?? message.role}</div>
      {message.parts.map((part, i) => (
        <PartView expandedThinking={expandedThinking} imageMap={imageMap} key={i} part={part} />
      ))}
    </div>
  )
}

export function renderSessionPdfHtml(args: {
  messages: ChatMessage[]
  title?: string | null
  imageMap: Map<string, string>
  // null → all thinking blocks render as a marker (closed session). A Set of
  // thinkingKey()s → those blocks render their full text (expanded in chat).
  expandedThinking: Set<string> | null
  // Print path: also show each link's URL as visible text (the OS print dialog
  // flattens clickable annotations). Save leaves this off (links stay clickable).
  showLinkUrls?: boolean
}): string {
  const { messages, title, imageMap, expandedThinking, showLinkUrls = false } = args

  const body = renderToStaticMarkup(
    <ShowLinkUrlsContext.Provider value={showLinkUrls}>
      <div>
        <h1 className="pdf-title">{title || 'Untitled session'}</h1>
        <p className="pdf-sub">Hermes session export</p>
        {messages.map(message => (
          <MessageView expandedThinking={expandedThinking} imageMap={imageMap} key={message.id} message={message} />
        ))}
      </div>
    </ShowLinkUrlsContext.Provider>
  )

  return `<!doctype html><html><head><meta charset="utf-8"><!--KATEX_CSS--><style>${sessionPdfCss()}</style></head><body>${body}</body></html>`
}
