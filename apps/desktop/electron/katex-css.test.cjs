const assert = require('node:assert')
const test = require('node:test')

const { katexCssInlined } = require('./katex-css.cjs')

test('returns css with embedded woff2 data urls and no fonts/ refs', () => {
  const css = katexCssInlined()
  assert.ok(css.includes('data:font/woff2;base64,'), 'should embed woff2 fonts as data URLs')
  assert.ok(!/url\(fonts\//.test(css), 'should leave no relative url(fonts/...) refs')
})
