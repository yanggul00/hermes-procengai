import { describe, expect, it } from 'vitest'

import { preprocessMarkdown } from './markdown-preprocess'

// Regression for the LaTeX line-break `\\[<dimen>]` (e.g. `\\[4pt]`) being
// mistaken for a display-math opener `\[`. The `[` in `\\[` is preceded by a
// backslash, so it must NOT start a `\[..\]` -> `$$..$$` rewrite. Before the
// fix, the false opener matched non-greedily to a LATER block's `\]`, mangling
// both blocks and leaving raw LaTeX on screen / in the PDF.
describe('preprocessMarkdown — LaTeX line breaks vs display-math delimiters', () => {
  it('does not treat \\\\[4pt] inside a $$ block as a display-math opener', () => {
    const src = ['$$', '\\begin{aligned}', 'a &= b \\\\[4pt]', 'c &= d', '\\end{aligned}', '$$', '', 'and \\[ x = 1 \\]'].join(
      '\n'
    )

    const out = preprocessMarkdown(src)

    // The line break survives untouched (no `$$` spliced into it).
    expect(out).toContain('a &= b \\\\[4pt]')
    expect(out).not.toContain('\\$$')
    // The genuine later display block still converts.
    expect(out).toContain('$$ x = 1 $$')
  })

  it('converts a bracket-delimited block that contains \\\\[4pt] without corruption', () => {
    const src = ['\\[', '\\begin{aligned}', 'a &= b \\\\[4pt]', 'c &= d', '\\end{aligned}', '\\]'].join('\n')
    const out = preprocessMarkdown(src)

    expect(out.trimStart().startsWith('$$')).toBe(true) // outer opener converted
    expect(out).toContain('\\begin{aligned}')
    expect(out).toContain('a &= b \\\\[4pt]') // inner line break preserved verbatim
    expect(out).not.toContain('\\[\n') // the standalone outer `\[` opener is gone
  })

  it('still converts ordinary \\[..\\] and \\(..\\) delimiters', () => {
    expect(preprocessMarkdown('see \\[ E = mc^2 \\] ok')).toContain('$$ E = mc^2 $$')
    expect(preprocessMarkdown('inline \\( a^2 \\) ok')).toContain('$ a^2 $')
  })
})
