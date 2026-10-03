import fs from 'fs';
import path from 'path';
import { scanLibraryRoot } from './scanner.js';
import { openBook, detectFormat } from '../extractors/index.js';
import { ensureCover } from './thumbnails.js';
import { upsertBook, getBookByPath } from '../database/books.js';
import { detectMetadata } from '../metadata/provider.js';
import { getConfig } from '../config.js';
import { getActiveProfileId } from '../database/profiles.js';

/**
 * Scan le dossier import + métadonnées détectées pour chaque fichier.
 */
export async function scanImportFolder(importRoot) {
  const root = importRoot || getConfig().importRoot;
  if (!root) return { found: [], error: 'Aucun dossier import configuré' };

  const scan = await scanLibraryRoot(root);
  const items = [];

  for (const file of scan.found) {
    const already = getBookByPath(file.filePath);
    const detected = detectMetadata(file.filePath);
    items.push({
      ...file,
      detected,
      alreadyInLibrary: Boolean(already),
      existingBookId: already?.id ?? null,
    });
  }

  return { root, found: items, error: scan.error || null };
}

/**
 * Importe un tome : copie vers libraryRoot (optionnel) + upsert DB + couverture.
 * @param {{ sourcePath: string, metadata: object, copyToLibrary?: boolean }} opts
 */
export async function commitImport({ sourcePath, metadata, copyToLibrary = true }) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error('Fichier source introuvable');
  }

  const cfg = getConfig();
  let destPath = sourcePath;

  if (copyToLibrary && cfg.libraryRoot) {
    fs.mkdirSync(cfg.libraryRoot, { recursive: true });
    const base = path.basename(sourcePath);
    destPath = path.join(cfg.libraryRoot, base);
    if (path.resolve(destPath) !== path.resolve(sourcePath)) {
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(sourcePath, destPath);
      }
    }
  }

  const format = detectFormat(destPath);
  let pageTotal = 0;
  let coverPath = null;

  try {
    const book = await openBook(destPath);
    pageTotal = book.pageCount || 0;
    try {
      coverPath = await ensureCover(
        destPath,
        () => book.getCoverBuffer(),
        getActiveProfileId(),
      );
    } catch (err) {
      console.warn('[VDR] couverture:', err.message);
    }
    await book.close();
  } catch (err) {
    console.warn('[VDR] openBook pendant import:', err.message);
  }

  const meta = {
    filePath: destPath,
    title: metadata?.title || path.basename(destPath, path.extname(destPath)),
    series: metadata?.series ?? null,
    seriesId: metadata?.seriesId ?? null,
    volume: metadata?.volume ?? null,
    author: metadata?.author ?? null,
    year: metadata?.year ?? null,
    format,
    coverPath,
    pageTotal,
    metadata: {
      ...(metadata || {}),
      importedAt: new Date().toISOString(),
      sourcePath,
    },
  };

  const saved = upsertBook(meta);
  return { ok: true, book: saved, destPath };
}

/**
 * Aperçu couverture (base64) pour un fichier pas encore importé.
 */
export async function previewCover(filePath) {
  const book = await openBook(filePath);
  try {
    const buf = await book.getCoverBuffer();
    const page = await book.getPage(0);
    return {
      mime: page.mime || 'image/jpeg',
      data: buf.toString('base64'),
    };
  } finally {
    await book.close();
  }
}
