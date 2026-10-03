import path from 'path';

export async function openCbr(filePath, { isImageEntry: _isImageEntry }) {
  const title = path.basename(filePath, path.extname(filePath));

  return {
    format: 'cbr',
    title,
    pageCount: 0,
    async getPage(_index) {
      throw new Error('TODO[Phase 2]: cbr.getPage — node-unrar-js');
    },
    async getCoverBuffer() {
      throw new Error('TODO[Phase 3]: couverture CBR');
    },
    async close() {},
  };
}
