import { describe, expect, it } from 'vitest'

import { sanitizeTex } from './katex-memo'

// KaTeX is stricter than full LaTeX / MathJax. Two patterns LLMs emit that
// KaTeX rejects, normalized here so the math renders (in both chat and PDF):
//   1. markdown-escaped asterisks inside math: `x^\*` -> `x^*`
//   2. a numbered system with one \tag per row in a single block; KaTeX allows
//      only ONE \tag per expression, so 2+ become inline `(n)` labels.
describe('sanitizeTex', () => {
  it('un-escapes markdown-escaped asterisks (\\* -> *)', () => {
    expect(sanitizeTex('x^\\* + \\mu_j^\\*')).toBe('x^* + \\mu_j^*')
  })

  it('leaves a single \\tag untouched (KaTeX renders one fine)', () => {
    const tex = '\\boxed{E=mc^2}\\tag{1}'
    expect(sanitizeTex(tex)).toBe(tex)
  })

  it('rewrites 2+ \\tag into inline labels so KaTeX can render the block', () => {
    const out = sanitizeTex('a &= b \\tag{1}\\\\ c &= d \\tag{2}')
    expect(out).not.toContain('\\tag{')
    expect(out).toContain('(\\text{1})')
    expect(out).toContain('(\\text{2})')
  })

  it('handles both fixes together (escaped stars + multiple tags)', () => {
    const out = sanitizeTex('\\nabla f(x^\\*) &= 0 \\tag{1}\\\\ c_i(x^\\*) &= 0 \\tag{2}')
    expect(out).not.toContain('\\*')
    expect(out).not.toContain('\\tag{')
    expect(out).toContain('x^*')
  })

  it('leaves ordinary math unchanged', () => {
    expect(sanitizeTex('\\frac{a}{b} + c_k^2')).toBe('\\frac{a}{b} + c_k^2')
  })
})
