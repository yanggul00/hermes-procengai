const fs = require('fs')
const path = require('path')

// KaTeX CSS with woff2 fonts embedded as data: URLs → self-contained, so it
// renders correctly both in the offscreen printToPDF window and the print
// iframe (relative url(fonts/…) refs would not resolve there). Built once and
// cached (it is ~360 KB and never changes within a run).
let cached = null

function katexCssInlined() {
  if (cached !== null) {
    return cached
  }

  const dist = path.dirname(require.resolve('katex/package.json')) + '/dist'
  let css = fs.readFileSync(path.join(dist, 'katex.min.css'), 'utf8')

  css = css.replace(
    /url\(fonts\/([^)]+?\.woff2)\)/g,
    (_match, file) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(dist, 'fonts', file)).toString('base64')})`
  )
  // Drop the now-unreachable ttf/woff alternates to keep the string small.
  css = css.replace(/,\s*url\(fonts\/[^)]+\)\s*format\("(?:truetype|woff)"\)/g, '')

  cached = css

  return cached
}

module.exports = { katexCssInlined }
