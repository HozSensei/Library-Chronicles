/**
 * Rendu PDF via pdfjs-dist (pages → PNG/canvas côté main ou données pour renderer).
 * TODO[Phase 2]
 */

const path = require('path');

async function openPdf(filePath) {
  const title = path.basename(filePath, path.extname(filePath));

  return {
    format: 'pdf',
    title,
    pageCount: 0,
    async getPage(_index) {
      throw new Error('TODO[Phase 2]: pdf.getPage — pdfjs-dist → image/canvas payload');
    },
    async getCoverBuffer() {
      throw new Error('TODO[Phase 3]: couverture PDF (page 1)');
    },
    async close() {},
  };
}

module.exports = { openPdf };
