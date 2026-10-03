import path from 'path';
import fs from 'fs';
import { openCbz } from './cbz.js';
import { openCbr } from './cbr.js';
import { openPdf } from './pdf.js';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif']);

export function detectFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.cbz' || ext === '.zip') return 'cbz';
  if (ext === '.cbr' || ext === '.rar') return 'cbr';
  if (ext === '.pdf') return 'pdf';
  return null;
}

export function isImageEntry(name) {
  return IMAGE_EXT.has(path.extname(name).toLowerCase());
}

export async function openBook(filePath) {
  const format = detectFormat(filePath);
  if (!format) {
    throw new Error(`Format non supporté: ${filePath}`);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier introuvable: ${filePath}`);
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
