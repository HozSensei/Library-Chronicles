import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { app } from 'electron';
import { createLruMap } from '../../shared/perf-cache.js';

/** Cache mémoire data-URL (évite relecture disque + re-encode base64). */
const dataUrlCache = createLruMap(96);
/** @type {Map<string, number>} mtimeMs au moment du cache */
const dataUrlMtimes = new Map();

export function cacheDir(profileId = null) {
  const root = path.join(app.getPath('userData'), 'covers');
  if (profileId == null) return root;
  return path.join(root, `profile-${profileId}`);
}

/**
 * Écrit la couverture sur disque (cache) et retourne le chemin.
 */
export async function ensureCover(bookFilePath, getCoverBuffer, profileId = null) {
  const dir = cacheDir(profileId);
  fs.mkdirSync(dir, { recursive: true });
  const hash = crypto.createHash('sha1').update(bookFilePath).digest('hex').slice(0, 16);
  const coverPath = path.join(dir, `${hash}.jpg`);

  if (fs.existsSync(coverPath) && fs.statSync(coverPath).size > 0) {
    return coverPath;
  }

  const buffer = await getCoverBuffer();
  if (!buffer || !buffer.length) {
    throw new Error('Couverture vide');
  }
  fs.writeFileSync(coverPath, buffer);
  invalidateCoverDataUrl(coverPath);
  return coverPath;
}

export function invalidateCoverDataUrl(coverPath) {
  if (!coverPath) return;
  dataUrlCache.delete(coverPath);
  dataUrlMtimes.delete(coverPath);
}

/**
 * Lit la couverture depuis le cache disque ; mémoise le data-URL en RAM.
 */
export function coverToDataUrl(coverPath) {
  if (!coverPath || !fs.existsSync(coverPath)) return null;
  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(coverPath).mtimeMs;
  } catch {
    return null;
  }
  const cached = dataUrlCache.get(coverPath);
  if (cached && dataUrlMtimes.get(coverPath) === mtimeMs) {
    return cached;
  }
  const buf = fs.readFileSync(coverPath);
  const ext = path.extname(coverPath).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const url = `data:${mime};base64,${buf.toString('base64')}`;
  dataUrlCache.set(coverPath, url);
  dataUrlMtimes.set(coverPath, mtimeMs);
  if (dataUrlMtimes.size > 128) {
    for (const key of [...dataUrlMtimes.keys()]) {
      if (!dataUrlCache.has(key)) dataUrlMtimes.delete(key);
    }
  }
  return url;
}
