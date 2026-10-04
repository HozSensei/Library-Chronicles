/**
 * Helpers jackets distantes (sans dépendance Electron).
 */

/**
 * Normalise une URL jacket (http → https ; // → https ; rejette non-http).
 * @param {string} coverUrl
 * @returns {string}
 */
export function normalizeRemoteCoverUrl(coverUrl) {
  let url = String(coverUrl || '').trim();
  if (!url) return '';
  if (url.startsWith('//')) {
    url = `https:${url}`;
  }
  if (/^http:\/\//i.test(url)) {
    url = `https://${url.slice(7)}`;
  }
  if (!/^https:\/\//i.test(url)) return '';
  return url;
}

/**
 * Buffer image → data-URL (mime sniffé).
 * @param {Buffer|Uint8Array} buffer
 * @returns {string|null}
 */
export function bufferToDataUrl(buffer) {
  if (!buffer?.length) return null;
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let mime = 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) mime = 'image/png';
  else if (buf[0] === 0x47 && buf[1] === 0x49) mime = 'image/gif';
  else if (buf[0] === 0x52 && buf[1] === 0x49) mime = 'image/webp';
  else if (buf[0] === 0xff && buf[1] === 0xd8) mime = 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}
