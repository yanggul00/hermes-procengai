// Offscreen-render a COMPLETE HTML string to a PDF and save it via the OS
// dialog. CSS is already inlined by the renderer (buildSessionPdfHtml), so the
// main process does no CSS work here. Dependency-injected so it unit-tests
// without real Electron.
function createSavePdf({ BrowserWindow, dialog, fs, getMainWindow }) {
  return async function savePdf({ html, defaultName }) {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })

    try {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(String(html)))

      // Running header (centered <title> = "… - ProcEngAI") + footer (date & time
      // bottom-left, page/total bottom-right). The `.title`, `.pageNumber` and
      // `.totalPages` classes are filled by Chromium; the date is stamped now.
      const dateText = new Date().toLocaleString()
      const headerTemplate =
        '<div style="font-size:9px;width:100%;text-align:center;color:#666;"><span class="title"></span></div>'
      const footerTemplate =
        '<div style="font-size:9px;width:100%;color:#666;padding:0 0.5in;display:flex;justify-content:space-between;">' +
        `<span>${dateText}</span>` +
        '<span><span class="pageNumber"></span> / <span class="totalPages"></span></span>' +
        '</div>'

      const pdf = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        margins: { top: 0.6, bottom: 0.6, left: 0.5, right: 0.5 }
      })
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
