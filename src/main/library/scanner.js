import fs from 'fs';
import path from 'path';

const SUPPORTED = new Set(['.cbz', '.cbr', '.pdf', '.zip', '.rar']);

/**
 * Scan récursif d’un dossier pour fichiers BD.
 * @returns {{ root: string, found: Array<{ filePath: string, name: string, format: string, size: number, mtime: string }> }}
 */
export async function scanLibraryRoot(rootDir) {
  if (!rootDir || !fs.existsSync(rootDir)) {
    return { root: rootDir, found: [], error: 'Dossier introuvable', supportedExtensions: [...SUPPORTED] };
  }

  const found = [];
  walk(rootDir, found);

  found.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));

  return {
    root: rootDir,
    found,
    supportedExtensions: [...SUPPORTED],
  };
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED.has(ext)) continue;
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    out.push({
      filePath: full,
      name: path.basename(entry.name, ext),
      format: ext === '.zip' ? 'cbz' : ext === '.rar' ? 'cbr' : ext.slice(1),
      size: stat.size,
      mtime: stat.mtime.toISOString(),
    });
  }
}

export { SUPPORTED };
