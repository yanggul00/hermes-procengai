const assert = require('node:assert')
const test = require('node:test')

const { createSavePdf } = require('./save-pdf.cjs')

function fakeDeps(overrides = {}) {
  const writes = []
  const destroyed = []
  const loaded = []
  const unlinked = []
  const printOpts = []
  const win = {
    webContents: {
      printToPDF: async opts => {
        printOpts.push(opts)
        return Buffer.from('PDF')
      }
    },
    loadFile: async p => loaded.push(p),
    destroy: () => destroyed.push(true)
  }

  return {
    writes,
    destroyed,
    loaded,
    unlinked,
    printOpts,
    deps: {
      BrowserWindow: function () {
        return win
      },
      dialog: { showSaveDialog: async () => ({ canceled: false, filePath: '/out/x.pdf' }) },
      fs: {
        promises: {
          writeFile: async (p, b) => writes.push([p, b]),
          unlink: async p => unlinked.push(p)
        }
      },
      getMainWindow: () => ({}),
      ...overrides
    }
  }
}

test('prints with a header/footer (title, date, page/total)', async () => {
  const { deps, printOpts } = fakeDeps()
  await createSavePdf(deps)({ html: '<html></html>', defaultName: 'x.pdf' })
  const opts = printOpts[0]
  assert.strictEqual(opts.displayHeaderFooter, true)
  assert.match(opts.headerTemplate, /class="title"/)
  assert.match(opts.footerTemplate, /class="pageNumber"/)
  assert.match(opts.footerTemplate, /class="totalPages"/)
})

test('writes pdf to chosen path and reports saved; window destroyed', async () => {
  const { deps, writes, destroyed } = fakeDeps()
  const res = await createSavePdf(deps)({ html: '<html></html>', defaultName: 'x.pdf' })
  assert.deepStrictEqual(res, { saved: true })
  // The PDF is written to the chosen path (a temp .html write also happens).
  assert.ok(writes.some(([p]) => p === '/out/x.pdf'))
  assert.strictEqual(destroyed.length, 1)
})

test('loads the html from a temp file (avoids the data: URL size limit)', async () => {
  const { deps, loaded, writes, unlinked } = fakeDeps()
  await createSavePdf(deps)({ html: '<html>BODY</html>', defaultName: 'x.pdf' })
  // The exact temp file that was written is the one loaded...
  const tmpWrite = writes.find(([, b]) => String(b).includes('BODY'))
  assert.ok(tmpWrite, 'html should be written to a temp file')
  assert.ok(tmpWrite[0].endsWith('.html'))
  assert.strictEqual(loaded[0], tmpWrite[0])
  // ...and it is cleaned up afterwards.
  assert.ok(unlinked.includes(tmpWrite[0]))
})

test('cancel returns saved:false and writes no pdf', async () => {
  const { deps, writes, unlinked } = fakeDeps({ dialog: { showSaveDialog: async () => ({ canceled: true }) } })
  const res = await createSavePdf(deps)({ html: '<html>BODY</html>', defaultName: 'x.pdf' })
  assert.deepStrictEqual(res, { saved: false })
  // Only the temp .html is written; no PDF output write happens on cancel.
  assert.ok(writes.every(([p]) => p.endsWith('.html')))
  // Temp file still cleaned up.
  assert.strictEqual(unlinked.length, 1)
})

test('destroys the window and cleans up temp even when printToPDF throws', async () => {
  const destroyed = []
  const unlinked = []
  const deps = {
    BrowserWindow: function () {
      return {
        webContents: {
          printToPDF: async () => {
            throw new Error('boom')
          }
        },
        loadFile: async () => {},
        destroy: () => destroyed.push(true)
      }
    },
    dialog: { showSaveDialog: async () => ({ canceled: false, filePath: '/out/x.pdf' }) },
    fs: { promises: { writeFile: async () => {}, unlink: async p => unlinked.push(p) } },
    getMainWindow: () => ({})
  }
  await assert.rejects(() => createSavePdf(deps)({ html: '', defaultName: 'x.pdf' }), /boom/)
  assert.strictEqual(destroyed.length, 1)
  assert.strictEqual(unlinked.length, 1)
})
