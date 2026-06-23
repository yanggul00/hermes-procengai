// Document + table-grid + code styles. KaTeX CSS is injected at <!--KATEX_CSS-->
// by buildSessionPdfHtml (Task 6). No Shiki CSS: code renders as plain monospace
// (Shiki is async and does not run in renderToStaticMarkup — see design §5.5).
export function sessionPdfCss(): string {
  return `
    * { box-sizing: border-box; }
    /* Force backgrounds/borders to print in the OS print dialog too (it defaults
       "Background graphics" off, which would otherwise drop the thinking tint/bar
       that the printToPDF Save path always renders). */
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Georgia,'Times New Roman',serif; color:#111; margin:0; padding:24px; font-size:12pt; line-height:1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .pdf-title { font-size:20pt; font-weight:700; margin:0 0 4px; }
    .pdf-sub { color:#666; font-size:10pt; margin:0 0 20px; }
    .msg { margin:0 0 20px; break-inside:avoid; }
    .msg-role { font-weight:700; font-size:10pt; text-transform:uppercase; letter-spacing:.04em; color:#444; margin:0 0 4px; }
    .thinking { border-left:3px solid #bbb; background:#fafafa; color:#555; padding:6px 10px; margin:6px 0; font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; font-size:9.5pt; line-height:1.45; }
    /* Force the smaller sans font onto the rendered markdown children so nothing
       (UA/print stylesheet) overrides it back to the serif body font. */
    .thinking p, .thinking li, .thinking blockquote { font-family:inherit; font-size:inherit; line-height:inherit; color:inherit; margin:0 0 6px; }
    .thinking p:last-child, .thinking li:last-child { margin-bottom:0; }
    .thinking-label { font-weight:700; font-size:8.5pt; text-transform:uppercase; letter-spacing:.06em; color:#999; margin:0 0 3px; }
    .thinking-marker { font-weight:700; font-size:8.5pt; text-transform:uppercase; letter-spacing:.06em; color:#999; margin:6px 0; }
    .tool-marker { font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace; font-size:10pt; color:#666; margin:6px 0; }
    table { border-collapse:collapse; margin:8px 0; max-width:100%; }
    th, td { border:1px solid #999; padding:4px 8px; text-align:left; }
    pre { background:#f6f8fa; border:1px solid #ddd; border-radius:6px; padding:10px; overflow-x:auto; font-size:10pt; break-inside:avoid; }
    code { font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace; }
    a { color:#0645ad; text-decoration:underline; overflow-wrap:anywhere; }
    /* Streamdown renders each code line as a <span class="block ..."> and relies
       on Tailwind for layout. The PDF has no Tailwind, so force each line span to
       its own line and preserve/wrap intra-line whitespace. */
    pre, pre code { white-space:pre-wrap; overflow-wrap:anywhere; }
    pre code > span { display:block; }
    img { max-width:100%; height:auto; break-inside:avoid; margin:6px 0; }
    .img-missing { color:#a00; font-style:italic; font-size:10pt; margin:6px 0; }
  `
}
