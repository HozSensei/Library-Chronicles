/**
 * Parse heuristique du nom de fichier → métadonnées de base.
 * Ex. "One Piece - Tome 03 (2019).cbz" → series, volume, year, title
 */

import path from 'path';

export function detectFromFilename(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  let series = null;
  let volume = null;
  let year = null;
  let author = null;
  let title = base;

  const yearMatch = base.match(/\((\d{4})\)/);
  if (yearMatch) year = Number(yearMatch[1]);

  const volMatch = base.match(
    /(?:tome|tomes|vol\.?|volume|v\.?|#)\s*0*(\d{1,4})/i,
  );
  if (volMatch) volume = Number(volMatch[1]);

  const dash = base.split(/\s+[-–—]\s+/);
  if (dash.length >= 2) {
    series = clean(dash[0]);
    title = clean(dash.slice(1).join(' - '));
  } else {
    const seriesVol = base.match(/^(.*?)\s+(?:tome|vol\.?|v\.?|#)?\s*0*(\d{1,4})\b/i);
    if (seriesVol && !series) {
      series = clean(seriesVol[1]);
      if (!volume) volume = Number(seriesVol[2]);
      title = series + (volume != null ? ` T${volume}` : '');
    }
  }

  title = clean(
    title
      .replace(/\(\d{4}\)/g, '')
      .replace(/(?:tome|tomes|vol\.?|volume|v\.?|#)\s*0*\d{1,4}/gi, '')
      .replace(/[_\.]+/g, ' ')
      .trim(),
  );
  if (!title) {
    title = series
      ? `${series}${volume != null ? ` T${String(volume).padStart(2, '0')}` : ''}`
      : clean(base);
  }

  return {
    title: title || clean(base),
    series,
    volume,
    year,
    author,
    source: 'filename',
    confidence: series || volume ? 0.6 : 0.35,
    raw: base,
  };
}

function clean(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—_|]+|[\s\-–—_|]+$/g, '')
    .trim();
}
