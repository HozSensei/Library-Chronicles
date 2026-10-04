/**
 * Mapper Google Books : volume API brut → NormalizedMeta.
 */

import { parseVolume, extractYear } from '../types.js';
import { createNormalizedMeta, absoluteHttpsCoverUrl } from '../../../shared/normalized-meta.js';

/**
 * Extrait série / tome depuis un titre Google Books.
 * @param {string|null|undefined} title
 * @returns {{ series: string|null, volume: number|null }}
 */
export function parseGoogleBookTitle(title) {
  const raw = String(title || '').trim();
  if (!raw) return { series: null, volume: null };

  const core = raw.replace(/\s*\([^)]*\)\s*$/u, '').trim();

  let m = core.match(
    /^(.*?)(?:,)?\s+(?:vol\.?|volume|tome|tomes)\s*0*(\d{1,4})$/iu,
  );
  if (m) {
    const series = cleanPart(m[1]);
    return { series: series || null, volume: Number(m[2]) };
  }

  m = core.match(/^(.*\S)\s+0*(\d{1,3})$/u);
  if (m) {
    const series = cleanPart(m[1]);
    if (series && series.length >= 2 && !/^\d+$/u.test(series)) {
      return { series, volume: Number(m[2]) };
    }
  }

  m = core.match(/^(.+?)\s+[-–—]\s+.+$/u);
  if (m) {
    const series = cleanPart(m[1]);
    if (series && series.length >= 2) {
      return { series, volume: null };
    }
  }

  return { series: null, volume: null };
}

/**
 * Normalise une URL jacket Google Books (https, zoom, sans curl).
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
export function upgradeGoogleCover(url) {
  const base = absoluteHttpsCoverUrl(url);
  if (!base) return null;
  let u = base;
  u = u.replace(/([?&])edge=curl&?/i, '$1').replace(/[?&]$/, '');
  if (/zoom=\d/i.test(u)) u = u.replace(/zoom=\d/i, 'zoom=3');
  else u += (u.includes('?') ? '&' : '?') + 'zoom=3';
  return absoluteHttpsCoverUrl(u);
}

/**
 * @param {object|null|undefined} item volume Google Books
 * @returns {import('../../../shared/normalized-meta.js').NormalizedMeta}
 */
export function mapGoogleBooksItem(item) {
  const info = item?.volumeInfo || {};
  const title = String(info.title || '').trim() || 'Book';
  const seriesInfo = info.seriesInfo || null;
  const fromTitle = parseGoogleBookTitle(title);

  const volumeFromSeries = parseVolume(seriesInfo?.bookDisplayNumber);
  const volume =
    volumeFromSeries != null ? volumeFromSeries : fromTitle.volume;

  const series = resolveSeries(title, seriesInfo, fromTitle);
  const authors = Array.isArray(info.authors)
    ? info.authors.map((a) => String(a || '').trim()).filter(Boolean)
    : [];

  return createNormalizedMeta({
    title,
    series,
    volume,
    authors,
    year: extractYear(info.publishedDate),
    synopsis: info.description
      ? String(info.description).replace(/\s+/g, ' ').trim().slice(0, 600)
      : null,
    coverUrl: pickGoogleCover(info.imageLinks),
    provider: 'googlebooks',
    providerId: item?.id != null ? String(item.id) : null,
    confidence: 0.75,
  });
}

/**
 * @param {string} title
 * @param {object|null} seriesInfo
 * @param {{ series: string|null, volume: number|null }} fromTitle
 */
function resolveSeries(title, seriesInfo, fromTitle) {
  const short = String(seriesInfo?.shortSeriesBookTitle || '').trim();
  if (short && short !== title) {
    const fromShort = parseGoogleBookTitle(short);
    if (fromShort.series) return fromShort.series;
    if (short.length >= 2 && short.length < title.length) return short;
  }
  if (fromTitle.series) return fromTitle.series;
  return null;
}

/**
 * @param {object|null|undefined} imageLinks
 * @returns {string|null}
 */
function pickGoogleCover(imageLinks) {
  const links = imageLinks && typeof imageLinks === 'object' ? imageLinks : {};
  const raw =
    links.extraLarge ||
    links.large ||
    links.medium ||
    links.small ||
    links.thumbnail ||
    links.smallThumbnail ||
    null;
  return upgradeGoogleCover(raw);
}

function cleanPart(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, '')
    .trim();
}
