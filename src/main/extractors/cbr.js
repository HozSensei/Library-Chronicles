import path from 'path';
import fs from 'fs';
import { createExtractorFromData } from 'node-unrar-js';
import { naturalCompare, detectChapters } from './cbz.js';
import { createLruMap } from '../../shared/perf-cache.js';

function mimeFromName(name) {
  const ext = path.extname(name).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.avif': 'image/avif',
  };
  return map[ext] || 'application/octet-stream';
}

export async function openCbr(filePath, { isImageEntry }) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier introuvable: ${filePath}`);
  }

  const data = new Uint8Array(fs.readFileSync(filePath));
  const extractor = await createExtractorFromData({ data });
  const list = extractor.getFileList();
  const fileHeaders = [...list.fileHeaders];

  const pageNames = fileHeaders
    .filter((h) => !h.flags.directory && isImageEntry(h.name) && !h.name.startsWith('__MACOSX'))
    .map((h) => h.name)
    .sort(naturalCompare);

  if (!pageNames.length) {
    throw new Error('Aucune image trouvée dans l’archive CBR/RAR');
  }

  const title = path.basename(filePath, path.extname(filePath));
  const chapters = detectChapters(pageNames);
  /** Extraction RAR bornée (évite de garder tout le tome en RAM). */
  const extracted = createLruMap(12);

  function ensureExtracted(name) {
    const hit = extracted.get(name);
    if (hit) return hit;
    const { files } = extractor.extract({ files: [name] });
    const file = [...files].find((f) => f.fileHeader.name === name);
    if (!file || !file.extraction) {
      throw new Error(`Extraction RAR échouée: ${name}`);
    }
    const buf = Buffer.from(file.extraction);
    extracted.set(name, buf);
    return buf;
  }

  return {
    format: 'cbr',
    title,
    pageCount: pageNames.length,
    chapters,
    pageNames,
    async getPage(index) {
      if (index < 0 || index >= pageNames.length) {
        throw new Error(`Page hors limites: ${index}`);
      }
      const name = pageNames[index];
      const buffer = ensureExtracted(name);
      return { buffer, mime: mimeFromName(name), name };
    },
    async getCoverBuffer() {
      const page = await this.getPage(0);
      return page.buffer;
    },
    async close() {
      extracted.clear();
    },
  };
}
