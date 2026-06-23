import type { ChatMessage, ChatMessagePart } from '@/lib/chat-messages'
import { generatedImageFromResult } from '@/lib/generated-images'
import {
  filePathFromMediaPath,
  gatewayMediaDataUrl,
  isRemoteGateway,
  mediaExternalUrl,
  mediaKind,
  mediaPathFromMarkdownHref
} from '@/lib/media'

// Uploaded-image attachment refs (`@image:<path>`, path optionally quoted) that
// `toChatMessages` surfaces in user text parts (via displayContentForMessage).
const IMAGE_REF_RE = /@image:(?:"([^"\n]+)"|'([^'\n]+)'|`([^`\n]+)`|(\S+))/g
// `#media:<encoded path>` hrefs that `renderMediaTags` produces in assistant text.
const MEDIA_HREF_RE = /#media:([^\s)"'`]+)/g

function isInlineSrc(path: string): boolean {
  return /^(?:https?|data):/i.test(path)
}

function partText(part: ChatMessagePart): string {
  return part.type === 'text' || part.type === 'reasoning' ? (part as { text: string }).text : ''
}

// Pull image refs out of a text part: uploaded `@image:` refs + image-kind
// `#media:` links (non-image media — pdfs, audio — are left as links).
function imageRefsFromText(text: string): string[] {
  const refs: string[] = []

  for (const match of text.matchAll(IMAGE_REF_RE)) {
    const raw = match[1] ?? match[2] ?? match[3] ?? match[4] ?? ''
    if (raw) refs.push(raw)
  }

  for (const match of text.matchAll(MEDIA_HREF_RE)) {
    const path = mediaPathFromMarkdownHref(`#media:${match[1]}`)
    if (path && mediaKind(path) === 'image') refs.push(path)
  }

  return refs
}

// Walk normalized chat messages and collect every distinct image reference:
// generated images (image_generate tool results), uploaded images, and inline
// media-image links.
export function collectImageRefs(messages: ChatMessage[]): string[] {
  const seen = new Set<string>()

  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === 'tool-call' && part.toolName === 'image_generate') {
        const ref = generatedImageFromResult(part.result)
        if (ref) seen.add(ref)
        continue
      }

      for (const ref of imageRefsFromText(partText(part))) seen.add(ref)
    }
  }

  return [...seen]
}

// Resolve one ref to an embeddable URL, mirroring resolveImageSrc in
// generated-image-result.tsx (inline → as-is; remote → gateway proxy; local →
// readFileDataUrl).
export async function resolveImageRef(ref: string): Promise<string> {
  if (isInlineSrc(ref)) return ref
  if (window.hermesDesktop && isRemoteGateway()) return gatewayMediaDataUrl(ref)
  if (window.hermesDesktop?.readFileDataUrl) return window.hermesDesktop.readFileDataUrl(filePathFromMediaPath(ref))

  return mediaExternalUrl(ref)
}

// Resolve all refs concurrently. A ref that fails to resolve maps to '' so the
// document can render a placeholder instead of failing the whole export.
export async function resolveImageMap(refs: string[]): Promise<Map<string, string>> {
  const entries = await Promise.all(
    refs.map(async ref => {
      try {
        return [ref, await resolveImageRef(ref)] as const
      } catch {
        return [ref, ''] as const
      }
    })
  )

  return new Map(entries)
}
