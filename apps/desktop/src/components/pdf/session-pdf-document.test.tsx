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

  it('sets the document <title> with the ProcEngAI suffix (header source)', () => {
    const html = renderSessionPdfHtml({ messages, title: 'My Chat', imageMap, expandedThinking: null })
    expect(html).toContain('<title>My Chat - ProcEngAI</title>')
  })

  it('omits Streamdown control buttons (copy/download/fullscreen) on code/tables', () => {
    const html = renderSessionPdfHtml({
      messages: [
        {
          id: '1',
          role: 'assistant',
          parts: [{ type: 'text', text: '```python\nx=1\n```\n\n| a | b |\n| - | - |\n| 1 | 2 |' }]
        }
      ] as never,
      title: 't',
      imageMap: new Map(),
      expandedThinking: null
    })

    // Links render as <a>, tool markers as <div> — so any <button> would be a
    // Streamdown control. controls={false} removes them.
    expect(html).not.toContain('<button')
  })

  it('renders \\[...\\] bracket math via KaTeX, not raw LaTeX source', () => {
    const html = renderSessionPdfHtml({
      messages: [
        { id: '1', role: 'assistant', parts: [{ type: 'text', text: 'Equation:\n\n\\[ E = mc^2 \\]' }] }
      ] as never,
      title: 't',
      imageMap: new Map(),
      expandedThinking: null
    })

    expect(html).toContain('class="katex"') // bracket form converted + rendered by KaTeX
    expect(html).not.toContain('\\[') // raw bracket delimiter is gone
  })

  it('renders \\(...\\) inline math via KaTeX, not raw LaTeX source', () => {
    const html = renderSessionPdfHtml({
      messages: [
        { id: '1', role: 'assistant', parts: [{ type: 'text', text: 'Inline \\(a^2 + b^2\\) here.' }] }
      ] as never,
      title: 't',
      imageMap: new Map(),
      expandedThinking: null
    })

    expect(html).toContain('class="katex"') // bracket form converted + rendered
    expect(html).not.toContain('\\(') // raw inline delimiter is gone
  })

  it('renders a multi-line \\[ \\begin{aligned} ... \\] block as display math', () => {
    // The real-world case from the bug report: a multi-line aligned environment
    // in LaTeX display brackets. Multi-line `\[..\]` becomes a `$$\n..\n$$` block,
    // which remark-math renders in DISPLAY mode (centered) — like the chat shows.
    const html = renderSessionPdfHtml({
      messages: [
        {
          id: '1',
          role: 'assistant',
          parts: [{ type: 'text', text: '\\[\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n\\]' }]
        }
      ] as never,
      title: 't',
      imageMap: new Map(),
      expandedThinking: null
    })

    expect(html).toContain('katex-display') // rendered as centered display math
    expect(html).toContain('display="block"') // KaTeX display mode, not inline
    // The aligned environment became a real MathML table (rendered), not a bare
    // <p> dump of the source. (KaTeX keeps the TeX in an <annotation>, which is
    // expected — the regression was the source leaking as visible paragraph text.)
    expect(html).toContain('<mtable')
  })

  it('renders a display block with a \\\\[4pt] line break AND a following equation (no raw leak)', () => {
    // Regression: `\\[4pt]` (a LaTeX line break) inside one block used to be
    // mistaken for a display opener and swallow the next block's `\]`, leaving
    // both as raw text. Both must now render via KaTeX.
    const text = '\\[\n\\begin{aligned}\na &= b \\\\[4pt]\nc &= d\n\\end{aligned}\n\\]\n\nthen \\( x = 1 \\) ok'

    const html = renderSessionPdfHtml({
      messages: [{ id: '1', role: 'assistant', parts: [{ type: 'text', text }] }] as never,
      title: 't',
      imageMap: new Map(),
      expandedThinking: null
    })

    expect(html).toContain('katex-display') // the aligned block rendered as display math
    expect(html).toContain('<mtable') // ...as a real math table, not source text
    // The following inline equation also rendered (its delimiter wasn't eaten).
    expect(html).toContain('class="katex"')
    expect(html).not.toContain('<p>then \\( x = 1 \\) ok') // not raw paragraph text
  })

  it('renders a KKT-style block (escaped stars + multiple \\tag) via KaTeX, not raw', () => {
    // The real bug-report block: markdown-escaped asterisks (x^\*) and a numbered
    // system with one \tag per row — both invalid for KaTeX until sanitized.
    const text =
      '\\[\n\\begin{aligned}\n\\nabla f(x^\\*) &= 0 \\tag{1}\\\\[4pt]\nc_i(x^\\*) &= 0 \\tag{2}\\\\\nc_j(x^\\*) &\\ge 0 \\tag{3}\n\\end{aligned}\n\\]'

    const html = renderSessionPdfHtml({
      messages: [{ id: '1', role: 'assistant', parts: [{ type: 'text', text }] }] as never,
      title: 't',
      imageMap: new Map(),
      expandedThinking: null
    })

    expect(html).toContain('katex-display') // rendered as display math
    expect(html).toContain('<mtable') // the aligned system became a real math table
    expect(html).not.toContain('\\tag{') // multiple tags rewritten to inline labels
    expect(html).not.toContain('x^\\*') // escaped stars normalized
  })

  it('runningHeader on (Print): injects a print-only running header with the title + suffix', () => {
    const html = renderSessionPdfHtml({
      messages,
      title: 'My Chat',
      imageMap,
      expandedThinking: null,
      runningHeader: true
    })

    expect(html).toContain('pdf-running-header')
    expect(html).toContain('My Chat - ProcEngAI') // header text (also the <title>)
    expect(html).toContain('@page')
    expect(html).toContain('table-header-group') // repeats at the TOP of every printed page
  })

  it('runningHeader off (Save default): no running-header element (printToPDF adds it)', () => {
    const html = renderSessionPdfHtml({ messages, title: 'My Chat', imageMap, expandedThinking: null })
    expect(html).not.toContain('pdf-running-header')
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
