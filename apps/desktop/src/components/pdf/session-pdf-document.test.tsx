// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { collectExpandedThinkingKeys, renderSessionPdfHtml, thinkingKey } from './session-pdf-document'

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
  it('with expanded thinking: full doc incl. thinking text, table, math, images, tool marker', () => {
    const expandedThinking = new Set([thinkingKey('thinking about it')])
    const html = renderSessionPdfHtml({ messages, title: 'My Chat', imageMap, expandedThinking })
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('My Chat')
    expect(html).toContain('thinking about it') // expanded → text included
    expect(html).toContain('thinking-label') // expanded block uses the labelled style
    expect(html).toContain('<table')
    expect(html).toContain('katex')
    expect(html).toContain('<!--KATEX_CSS-->')
    expect(html).toContain('data:image/png;base64,GEN')
    expect(html).toContain('data:image/png;base64,UP')
    expect(html).toContain('Ran command') // tool marker uses the chat's friendly headline
  })

  it('marker-only (expandedThinking=null): omits thinking text, shows the marker', () => {
    const html = renderSessionPdfHtml({ messages, title: 'My Chat', imageMap, expandedThinking: null })
    expect(html).not.toContain('thinking about it') // collapsed/closed → no text
    expect(html).toContain('thinking-marker') // just the marker
  })

  const linkMessages = [
    { id: '1', role: 'assistant', parts: [{ type: 'text', text: 'See [1](https://ref.example.org/1).' }] }
  ] as never

  it('renders web links as real anchors with the href preserved', () => {
    const html = renderSessionPdfHtml({ messages: linkMessages, title: 't', imageMap: new Map(), expandedThinking: null })
    expect(html).toContain('href="https://ref.example.org/1"')
    expect(html).not.toContain('data-streamdown="link"') // not the hrefless button
  })

  it('Save (showLinkUrls off): clickable link, no visible URL text', () => {
    const html = renderSessionPdfHtml({ messages: linkMessages, title: 't', imageMap: new Map(), expandedThinking: null })
    expect(html).toContain('href="https://ref.example.org/1"')
    expect(html).not.toContain('class="link-url"') // no rendered URL span (the CSS rule is always present)
    expect(html).not.toContain('(https://ref.example.org/1)') // no visible URL text
  })

  it('Print (showLinkUrls on): clickable link AND visible URL text', () => {
    const html = renderSessionPdfHtml({
      messages: linkMessages,
      title: 't',
      imageMap: new Map(),
      expandedThinking: null,
      showLinkUrls: true
    })
    expect(html).toContain('href="https://ref.example.org/1"')
    expect(html).toContain('class="link-url"') // URL shown as visible text
    expect(html).toContain('(https://ref.example.org/1)')
  })

  it('renders a placeholder for an unresolved image', () => {
    const html = renderSessionPdfHtml({
      messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: '@image:/missing.png' }] }] as never,
      title: 't',
      imageMap: new Map([['/missing.png', '']]),
      expandedThinking: null
    })
    expect(html).toContain('image unavailable')
  })
})

describe('collectExpandedThinkingKeys', () => {
  it('keys reasoning text rendered in the live DOM (expanded disclosures only)', () => {
    document.body.innerHTML = '<div data-slot="aui_reasoning-text">Thinking about it</div>'
    const keys = collectExpandedThinkingKeys()
    expect(keys.has(thinkingKey('thinking about it'))).toBe(true)
    document.body.innerHTML = ''
  })
})
