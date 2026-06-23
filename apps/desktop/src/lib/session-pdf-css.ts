// Document + table-grid + code styles. KaTeX CSS is injected at <!--KATEX_CSS-->
// by buildSessionPdfHtml (Task 6). No Shiki CSS: code renders as plain monospace
// (Shiki is async and does not run in renderToStaticMarkup — see design §5.5).
export function sessionPdfCss(): string {
  return `
    * { box-sizing: border-box; }
    body { font-family: Georgia,'Times New Roman',serif; color:#111; margin:0; padding:24px; font-size:12pt; line-height:1.5; }
    .pdf-title { font-size:20pt; font-weight:700; margin:0 0 4px; }
    .pdf-sub { color:#666; font-size:10pt; margin:0 0 20px; }
    .msg { margin:0 0 20px; break-inside:avoid; }
    .msg-role { font-weight:700; font-size:10pt; text-transform:uppercase; letter-spacing:.04em; color:#444; margin:0 0 4px; }
    .thinking { border-left:3px solid #bbb; background:#fafafa; color:#555; padding:6px 10px; margin:6px 0; font-size:11pt; }
    .tool-marker { font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace; font-size:10pt; color:#666; margin:6px 0; }
    table { border-collapse:collapse; margin:8px 0; max-width:100%; }
    th, td { border:1px solid #999; padding:4px 8px; text-align:left; }
    pre { background:#f6f8fa; border:1px solid #ddd; border-radius:6px; padding:10px; overflow-x:auto; font-size:10pt; break-inside:avoid; }
    code { font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace; }
    img { max-width:100%; height:auto; break-inside:avoid; margin:6px 0; }
    .img-missing { color:#a00; font-style:italic; font-size:10pt; margin:6px 0; }
  `
}
