// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { renderSessionPdfHtml } from './session-pdf-document'

const messages = [
  { id: '1', role: 'user', parts: [{ type: 'text', text: '@image:/up.png\nMake a table and an equation' }] },
  {
    id: '2',
    role: 'assistant',
    parts: [
      { type: 'reasoning', text: 'thinking about it' },
      { type: 'text', text: '| a | b |\n| - | - |\n| 1 | 2 |\n\ninline $x^2$' },
      { type: 'tool-call', toolName: 'image_generate', result: { image: '/gen.png' } },
      { type: 'tool-call', toolName: 'terminal', args: {}, result: {} }
    ]
  }
] as never

const imageMap = new Map([
  ['/up.png', 'data:image/png;base64,UP'],
  ['/gen.png', 'data:image/png;base64,GEN']
])

describe('renderSessionPdfHtml', () => {
  it('produces a full doc with title, thinking, table, math, marker, images, tool marker', () => {
    const html = renderSessionPdfHtml({ messages, title: 'My Chat', imageMap })
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('My Chat') // title header
    expect(html).toContain('thinking about it') // reasoning block, expanded
    expect(html).toContain('<table') // markdown table
    expect(html).toContain('katex') // math typeset at render time
    expect(html).toContain('<!--KATEX_CSS-->') // marker for main-process css injection
    expect(html).toContain('data:image/png;base64,GEN') // generated image embedded
    expect(html).toContain('data:image/png;base64,UP') // uploaded image embedded
    expect(html).toContain('terminal') // one-line marker for non-image tool call
  })

  it('renders a placeholder for an unresolved image', () => {
    const html = renderSessionPdfHtml({
      messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: '@image:/missing.png' }] }] as never,
      title: 't',
      imageMap: new Map([['/missing.png', '']])
    })
    expect(html).toContain('image unavailable')
  })
})
