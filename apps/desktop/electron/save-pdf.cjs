// Offscreen-render a COMPLETE HTML string to a PDF and save it via the OS
// dialog. CSS is already inlined by the renderer (buildSessionPdfHtml), so the
// main process does no CSS work here. Dependency-injected so it unit-tests
// without real Electron.
function createSavePdf({ BrowserWindow, dialog, fs, getMainWindow }) {
  return async function savePdf({ html, defaultName }) {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })

    try {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(String(html)))
      const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' })
      const result = await dialog.showSaveDialog(getMainWindow(), {
        title: 'Save Session as PDF',
        defaultPath: defaultName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })

      if (result.canceled || !result.filePath) {
        return { saved: false }
      }

      await fs.promises.writeFile(result.filePath, pdf)

      return { saved: true }
    } finally {
      win.destroy()
    }
  }
}

module.exports = { createSavePdf }
