import fs from 'fs';
import path from 'path';
import { scanLibraryRoot } from './scanner.js';
import { openBook, detectFormat } from '../extractors/index.js';
import { ensureCover, ensureCoverFromUrl } from './thumbnails.js';
import { upsertBook, findBookForImportSource } from '../database/books.js';
import { detectMetadata } from '../metadata/provider.js';
import { getConfig } from '../config.js';
import { getActiveProfileId } from '../database/profiles.js';
import { fetchBuffer } from '../metadata/fetch.js';
import { USER_AGENT } from '../metadata/types.js';
import {
  bufferToDataUrl,
  normalizeRemoteCoverUrl,
} from '../../shared/cover-url.js';

/**
 * Scan le dossier import + métadonnées détectées pour chaque fichier.
 */
export async function scanImportFolder(importRoot) {
  const root = importRoot || getConfig().importRoot;
  if (!root) return { found: [], error: 'Aucun dossier import configuré' };

  const cfg = getConfig();
  const scan = await scanLibraryRoot(root);
  const items = [];

  for (const file of scan.found) {
    const already = findBookForImportSource(file.filePath, {
      libraryRoot: cfg.libraryRoot,
    });
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
  const profileId = getActiveProfileId();
  const remoteCoverUrl = normalizeRemoteCoverUrl(metadata?.coverUrl);

  // Jacket API en priorité (providers renvoient coverUrl) — fallback page 0 archive.
  let coverError = null;
  if (remoteCoverUrl) {
    try {
      coverPath = await ensureCoverFromUrl(destPath, remoteCoverUrl, profileId);
    } catch (err) {
      coverError = String(err?.message || err);
      console.warn('[VDR] jacket API:', coverError);
    }
  } else if (
    typeof metadata?.coverUrl === 'string' &&
    metadata.coverUrl.trim()
  ) {
    coverError = 'URL couverture invalide (https absolu requis)';
    console.warn('[VDR] jacket API:', coverError, metadata.coverUrl);
  }

  try {
    const book = await openBook(destPath);
    pageTotal = book.pageCount || 0;
    if (!coverPath) {
      try {
        coverPath = await ensureCover(
          destPath,
          () => book.getCoverBuffer(),
          profileId,
        );
      } catch (err) {
        console.warn('[VDR] couverture:', err.message);
      }
    }
    await book.close();
  } catch (err) {
    console.warn('[VDR] openBook pendant import:', err.message);
  }

  const appliedRemote =
    Boolean(coverPath) && Boolean(remoteCoverUrl) && !coverError;
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
      coverUrl: remoteCoverUrl || null,
      /** remote = jacket API écrite ; archive = page 0 ; null = aucune. */
      coverSource: appliedRemote ? 'remote' : coverPath ? 'archive' : null,
      ...(coverError ? { coverError } : {}),
      importedAt: new Date().toISOString(),
      sourcePath,
    },
  };

  const saved = upsertBook(meta);
  return {
    ok: true,
    book: saved,
    destPath,
    coverWarning: coverError || null,
  };
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

/**
 * Télécharge une jacket distante et renvoie un data-URL (CSP renderer : pas de https img).
 * @param {string} coverUrl
 * @returns {Promise<{ dataUrl: string, mime: string }|null>}
 */
export async function previewCoverFromUrl(coverUrl) {
  const raw = String(coverUrl || '').trim();
  if (!raw) return null;
  // data: déjà affichable
  if (/^data:/i.test(raw)) {
    return { dataUrl: raw, mime: raw.slice(5).split(';')[0] || 'image/jpeg' };
  }
  const url = normalizeRemoteCoverUrl(raw);
  if (!url) {
    throw new Error('URL couverture invalide');
  }
  const buffer = await fetchBuffer(url, {
    timeoutMs: 12_000,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'image/*,*/*;q=0.8',
    },
  });
  if (!buffer?.length) throw new Error('Couverture distante vide');
  const dataUrl = bufferToDataUrl(buffer);
  if (!dataUrl) return null;
  const mime = dataUrl.slice(5).split(';')[0] || 'image/jpeg';
  return { dataUrl, mime };
}
