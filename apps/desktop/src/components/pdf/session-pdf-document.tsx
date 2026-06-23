import { renderToStaticMarkup } from 'react-dom/server'
import { Streamdown } from 'streamdown'

import type { ChatMessage, ChatMessagePart } from '@/lib/chat-messages'
import { generatedImageFromResult } from '@/lib/generated-images'
import { createMemoizedMathPlugin } from '@/lib/katex-memo'
import { mediaKind, mediaName, mediaPathFromMarkdownHref } from '@/lib/media'
import { sessionPdfCss } from '@/lib/session-pdf-css'

const math = createMemoizedMathPlugin({ singleDollarTextMath: true })

const ROLE_LABEL: Record<string, string> = { assistant: 'Assistant', system: 'System', tool: 'Tool', user: 'You' }

// Markdown body (static): tables + KaTeX math; code as plain monospace.
function Md({ children }: { children: string }) {
  return (
    <Streamdown mode="static" parseIncompleteMarkdown={false} plugins={{ math }}>
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

function PartView({ part, imageMap }: { part: ChatMessagePart; imageMap: Map<string, string> }) {
  if (part.type === 'reasoning') {
    const text = (part as { text: string }).text
    return text.trim() ? <div className="thinking"><Md>{text}</Md></div> : null
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
    return <div className="tool-marker">🔧 {part.toolName}</div>
  }

  return null
}

function MessageView({ message, imageMap }: { message: ChatMessage; imageMap: Map<string, string> }) {
  return (
    <div className="msg">
      <div className="msg-role">{ROLE_LABEL[message.role] ?? message.role}</div>
      {message.parts.map((part, i) => <PartView imageMap={imageMap} key={i} part={part} />)}
    </div>
  )
}

export function renderSessionPdfHtml(args: {
  messages: ChatMessage[]
  title?: string | null
  imageMap: Map<string, string>
}): string {
  const { messages, title, imageMap } = args

  const body = renderToStaticMarkup(
    <div>
      <h1 className="pdf-title">{title || 'Untitled session'}</h1>
      <p className="pdf-sub">Hermes session export</p>
      {messages.map(message => <MessageView imageMap={imageMap} key={message.id} message={message} />)}
    </div>
  )

  return `<!doctype html><html><head><meta charset="utf-8"><!--KATEX_CSS--><style>${sessionPdfCss()}</style></head><body>${body}</body></html>`
}
