/**
 * Extraction CBZ / ZIP via JSZip.
 * TODO[Phase 1]: brancher JSZip, tri naturel des pages, getPage → Buffer.
 */

const path = require('path');
const fs = require('fs');

async function openCbz(filePath, { isImageEntry }) {
  // Vérifie au moins que le fichier existe (utile dès le squelette).
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier introuvable: ${filePath}`);
  }

  // TODO[Phase 1]:
  // const JSZip = require('jszip');
  // const data = fs.readFileSync(filePath);
  // const zip = await JSZip.loadAsync(data);
  // const entries = Object.keys(zip.files)
  //   .filter((n) => !zip.files[n].dir && isImageEntry(n))
  //   .sort(naturalSort);

  const title = path.basename(filePath, path.extname(filePath));

  return {
    format: 'cbz',
    title,
    pageCount: 0,
    async getPage(_index) {
      throw new Error('TODO[Phase 1]: cbz.getPage — décompresser via JSZip');
    },
    async getCoverBuffer() {
      throw new Error('TODO[Phase 3]: première page comme couverture');
    },
    async close() {},
  };
}

module.exports = { openCbz };
