/**
 * Parse heuristique du nom de fichier → métadonnées de base.
 * Ex. "One Piece - Tome 03 (2019).cbz" → series, volume, year, title
 *
 * Priorité série (détection locale) :
 * 1. Parsing du nom de fichier
 * 2. Fallback : nom du dossier parent (hors blacklist générique)
 *
 * L’API metadata (import enrich) reste prioritaire au-dessus : elle n’est
 * appliquée qu’ensuite et ne doit jamais être écrasée par ce fallback.
 */

import path from 'path';
import { seriesFromParentFolder } from '../../shared/series.js';

/** « séries » issues du parse qui ne sont que des mots-clés de volume. */
const GENERIC_FILENAME_SERIES = new Set([
  'tome',
  'tomes',
  'vol',
  'vol.',
  'volume',
  'volumes',
  'v',
  'v.',
  '#',
]);

function isGenericFilenameSeries(name) {
  const key = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return !key || GENERIC_FILENAME_SERIES.has(key);
}

export function detectFromFilename(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  let series = null;
  let volume = null;
  let year = null;
  let author = null;
  let title = base;
  let seriesSource = null;

  const yearMatch = base.match(/\((\d{4})\)/);
  if (yearMatch) year = Number(yearMatch[1]);

  const volMatch = base.match(
    /(?:tome|tomes|vol\.?|volume|v\.?|#)\s*0*(\d{1,4})/i,
  );
  if (volMatch) volume = Number(volMatch[1]);

  const dash = base.split(/\s+[-–—]\s+/);
  if (dash.length >= 2) {
    const candidate = clean(dash[0]);
    title = clean(dash.slice(1).join(' - '));
    if (candidate && !isGenericFilenameSeries(candidate)) {
      series = candidate;
      seriesSource = 'filename';
    }
  } else {
    const seriesVol = base.match(/^(.*?)\s+(?:tome|vol\.?|v\.?|#)?\s*0*(\d{1,4})\b/i);
    if (seriesVol && !series) {
      const candidate = clean(seriesVol[1]);
      if (!volume) volume = Number(seriesVol[2]);
      if (candidate && !isGenericFilenameSeries(candidate)) {
        series = candidate;
        seriesSource = 'filename';
        title = series + (volume != null ? ` T${volume}` : '');
      }
    }
  }

  // Fallback dossier parent — seulement si aucune série du nom de fichier
  const folderSeries = seriesFromParentFolder(filePath, series);
  if (folderSeries) {
    series = folderSeries;
    seriesSource = 'folder';
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
    source: seriesSource === 'folder' ? 'folder' : 'filename',
    seriesSource,
    confidence: series || volume ? (seriesSource === 'folder' ? 0.5 : 0.6) : 0.35,
    raw: base,
  };
}

function clean(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—_|]+|[\s\-–—_|]+$/g, '')
    .trim();
}
