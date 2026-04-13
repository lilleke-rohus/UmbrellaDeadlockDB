'use strict'

const fs = require('node:fs')
const path = require('node:path')

/**
 * Strips large shipped license artifacts next to the Windows executable.
 * @param {import('electron-builder').AfterPackContext} context
 */
module.exports = async function afterPackRemoveLicenseFiles(context) {
  const names = ['LICENSES.chromium.html', 'LICENSE.electron.txt']
  for (const name of names) {
    const full = path.join(context.appOutDir, name)
    if (fs.existsSync(full)) {
      try {
        fs.unlinkSync(full)
      } catch (err) {
        console.warn(`[after-pack] could not remove ${name}:`, err)
      }
    }
  }
}
