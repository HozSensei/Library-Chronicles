/**
 * Routeur d'extraction selon l'extension.
 * Phase 1: CBZ/ZIP — Phase 2: CBR + PDF
 */

const path = require('path');
const { openCbz } = require('./cbz');
const { openCbr } = require('./cbr');
const { openPdf } = require('./pdf');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']);

function detectFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.cbz' || ext === '.zip') return 'cbz';
  if (ext === '.cbr' || ext === '.rar') return 'cbr';
  if (ext === '.pdf') return 'pdf';
  return null;
}

function isImageEntry(name) {
  return IMAGE_EXT.has(path.extname(name).toLowerCase());
}

/**
 * @returns {Promise<{ format: string, pageCount: number, title: string, getPage: (i:number)=>Promise<Buffer|null> }>}
 */
async function openBook(filePath) {
  const format = detectFormat(filePath);
  if (!format) {
    throw new Error(`Format non supporté: ${filePath}`);
  }

  switch (format) {
    case 'cbz':
      return openCbz(filePath, { isImageEntry });
    case 'cbr':
      return openCbr(filePath, { isImageEntry });
    case 'pdf':
      return openPdf(filePath);
    default:
      throw new Error(`Format non géré: ${format}`);
  }
}

module.exports = { openBook, detectFormat, isImageEntry };
