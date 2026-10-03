import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { app } from 'electron';

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
  return coverPath;
}

export function coverToDataUrl(coverPath) {
  if (!coverPath || !fs.existsSync(coverPath)) return null;
  const buf = fs.readFileSync(coverPath);
  const ext = path.extname(coverPath).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}
