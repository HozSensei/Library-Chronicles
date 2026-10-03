import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';

/** Tri naturel : page2 < page10 */
export function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

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

/**
 * Détecte des chapitres si les images sont regroupées en dossiers.
 * @returns {{ name: string, startIndex: number, endIndex: number }[]}
 */
export function detectChapters(pageNames) {
  const groups = new Map();
  for (let i = 0; i < pageNames.length; i += 1) {
    const parts = pageNames[i].replace(/\\/g, '/').split('/');
    const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(i);
  }
  if (groups.size <= 1) return [];
  const chapters = [];
  for (const [name, indices] of groups) {
    chapters.push({
      name: name || 'Racine',
      startIndex: indices[0],
      endIndex: indices[indices.length - 1],
    });
  }
  chapters.sort((a, b) => a.startIndex - b.startIndex);
  return chapters;
}

export async function openCbz(filePath, { isImageEntry }) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier introuvable: ${filePath}`);
  }

  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  const pageNames = Object.keys(zip.files)
    .filter((name) => {
      const entry = zip.files[name];
      return !entry.dir && isImageEntry(name) && !name.startsWith('__MACOSX');
    })
    .sort(naturalCompare);

  if (!pageNames.length) {
    throw new Error('Aucune image trouvée dans l’archive CBZ/ZIP');
  }

  const title = path.basename(filePath, path.extname(filePath));
  const chapters = detectChapters(pageNames);
  const pageCache = new Map();

  return {
    format: 'cbz',
    title,
    pageCount: pageNames.length,
    chapters,
    pageNames,
    async getPage(index) {
      if (index < 0 || index >= pageNames.length) {
        throw new Error(`Page hors limites: ${index}`);
      }
      if (pageCache.has(index)) return pageCache.get(index);
      const name = pageNames[index];
      const buf = Buffer.from(await zip.file(name).async('uint8array'));
      const result = { buffer: buf, mime: mimeFromName(name), name };
      // Cache léger (évite de tout charger en mémoire)
      if (pageCache.size > 12) {
        const oldest = pageCache.keys().next().value;
        pageCache.delete(oldest);
      }
      pageCache.set(index, result);
      return result;
    },
    async getCoverBuffer() {
      const page = await this.getPage(0);
      return page.buffer;
    },
    async close() {
      pageCache.clear();
    },
  };
}
