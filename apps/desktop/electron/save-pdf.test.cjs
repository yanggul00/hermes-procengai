const assert = require('node:assert')
const test = require('node:test')

const { createSavePdf } = require('./save-pdf.cjs')

function fakeDeps(overrides = {}) {
  const writes = []
  const destroyed = []
  const loaded = []
  const win = {
    webContents: { printToPDF: async () => Buffer.from('PDF') },
    loadURL: async url => loaded.push(url),
    destroy: () => destroyed.push(true)
  }

  return {
    writes,
    destroyed,
    loaded,
    deps: {
      BrowserWindow: function () {
        return win
      },
      dialog: { showSaveDialog: async () => ({ canceled: false, filePath: '/out/x.pdf' }) },
      fs: { promises: { writeFile: async (p, b) => writes.push([p, b]) } },
      getMainWindow: () => ({}),
      ...overrides
    }
  }
}

test('writes pdf to chosen path and reports saved; window destroyed', async () => {
  const { deps, writes, destroyed } = fakeDeps()
  const res = await createSavePdf(deps)({ html: '<html></html>', defaultName: 'x.pdf' })
  assert.deepStrictEqual(res, { saved: true })
  assert.strictEqual(writes.length, 1)
  assert.strictEqual(writes[0][0], '/out/x.pdf')
  assert.strictEqual(destroyed.length, 1)
})

test('cancel returns saved:false and writes nothing', async () => {
  const { deps, writes } = fakeDeps({ dialog: { showSaveDialog: async () => ({ canceled: true }) } })
  const res = await createSavePdf(deps)({ html: '', defaultName: 'x.pdf' })
  assert.deepStrictEqual(res, { saved: false })
  assert.strictEqual(writes.length, 0)
})

test('loads the html it was given', async () => {
  const { deps, loaded } = fakeDeps()
  await createSavePdf(deps)({ html: '<html>BODY</html>', defaultName: 'x.pdf' })
  assert.ok(decodeURIComponent(loaded[0]).includes('BODY'))
})

test('destroys the window even when printToPDF throws', async () => {
  const destroyed = []
  const deps = {
    BrowserWindow: function () {
      return {
        webContents: {
          printToPDF: async () => {
            throw new Error('boom')
          }
        },
        loadURL: async () => {},
        destroy: () => destroyed.push(true)
      }
    },
    dialog: { showSaveDialog: async () => ({ canceled: false, filePath: '/out/x.pdf' }) },
    fs: { promises: { writeFile: async () => {} } },
    getMainWindow: () => ({})
  }
  await assert.rejects(() => createSavePdf(deps)({ html: '', defaultName: 'x.pdf' }), /boom/)
  assert.strictEqual(destroyed.length, 1)
})
