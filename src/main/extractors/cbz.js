import path from 'path';
import fs from 'fs';

export async function openCbz(filePath, { isImageEntry: _isImageEntry }) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier introuvable: ${filePath}`);
  }

  // TODO[Phase 1]: JSZip + tri naturel des pages
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
