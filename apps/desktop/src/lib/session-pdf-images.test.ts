// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import { collectImageRefs, resolveImageRef } from './session-pdf-images'

vi.mock('@/lib/media', () => ({
  isRemoteGateway: () => false,
  gatewayMediaDataUrl: vi.fn(),
  filePathFromMediaPath: (p: string) => p,
  mediaExternalUrl: (p: string) => `file://${p}`,
  mediaKind: (p: string) => (/\.(png|jpe?g|gif|webp|svg)$/i.test(p) ? 'image' : 'file'),
  mediaPathFromMarkdownHref: (href: string) =>
    href?.startsWith('#media:') ? decodeURIComponent(href.slice('#media:'.length)) : null
}))

vi.mock('@/lib/generated-images', () => ({
  generatedImageFromResult: (r: unknown) =>
    (r as { host_image?: string; image?: string })?.host_image ?? (r as { image?: string })?.image ?? null
}))

describe('collectImageRefs (normalized ChatMessage parts)', () => {
  it('finds generated images from image_generate tool-call parts', () => {
    const refs = collectImageRefs([
      { id: '1', role: 'assistant', parts: [{ type: 'tool-call', toolName: 'image_generate', result: { image: '/gen.png' } }] }
    ] as never)
    expect(refs).toContain('/gen.png')
  })

  it('finds uploaded images from @image: refs in user text parts', () => {
    const refs = collectImageRefs([
      { id: '1', role: 'user', parts: [{ type: 'text', text: '@image:/up/photo.png\nWhat is this?' }] }
    ] as never)
    expect(refs).toContain('/up/photo.png')
  })

  it('finds image #media: links in assistant text parts (skips non-image media)', () => {
    const refs = collectImageRefs([
      {
        id: '1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'See [Image: a.png](#media:%2Ftmp%2Fa.png) and [Doc](#media:%2Ftmp%2Fb.pdf)' }]
      }
    ] as never)
    expect(refs).toContain('/tmp/a.png')
    expect(refs).not.toContain('/tmp/b.pdf')
  })

  it('de-duplicates', () => {
    const refs = collectImageRefs([
      { id: '1', role: 'user', parts: [{ type: 'text', text: '@image:/a.png' }] },
      { id: '2', role: 'user', parts: [{ type: 'text', text: '@image:/a.png' }] }
    ] as never)
    expect(refs).toEqual(['/a.png'])
  })
})

describe('resolveImageRef', () => {
  it('returns inline data/http refs as-is', async () => {
    expect(await resolveImageRef('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA')
    expect(await resolveImageRef('https://x/y.png')).toBe('https://x/y.png')
  })
  it('reads local files via readFileDataUrl', async () => {
    const readFileDataUrl = vi.fn().mockResolvedValue('data:image/png;base64,LOCAL')
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = { readFileDataUrl }
    expect(await resolveImageRef('/tmp/up.png')).toBe('data:image/png;base64,LOCAL')
    expect(readFileDataUrl).toHaveBeenCalledWith('/tmp/up.png')
  })
})
