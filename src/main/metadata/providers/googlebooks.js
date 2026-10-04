/**
 * Google Books API — livres/BD. Quota gratuit mais clé API requise.
 * Docs: https://developers.google.com/books/docs/v1/using
 * Pagination : startIndex (0-based) + maxResults (max 40), totalItems.
 *
 * Mapping MetadataResult :
 * - coverUrl : imageLinks (http→https, zoom↑, sans edge=curl) — pas d’URL
 *   fabriquée si Google omet imageLinks (placeholders PNG vides).
 * - series / volume : seriesInfo si fiable, sinon parse du titre
 *   (« Solo Leveling, Vol. 9 (comic) », « Solo Leveling 04 »).
 */

import { fetchJson } from '../fetch.js';
import {
  USER_AGENT,
  metadataSearchLimit,
  collectSearchPages,
  extractYear,
  parseVolume,
} from '../types.js';
import { stubProvider } from './stub.js';

/** @type {import('../types.js').MetadataProvider} */
export const googleBooksProvider = {
  id: 'googlebooks',
  label: 'Google Books',
  requiresApiKey: true,
  freeLabel: 'Clé API requise',
  helpText:
    'Active l’API Books dans Google Cloud Console, crée une clé API (quota gratuit). Stockée localement uniquement.',
  helpUrl: 'https://console.cloud.google.com/apis/library/books.googleapis.com',
  helpLinkLabel: 'Obtenir une clé',

  async search(query, { apiKey, signal } = {}) {
    const q = String(query || '').trim();
    if (!q) return [];

    if (!apiKey) {
      return withNote(
        await stubProvider.search(q),
        'Google Books : clé API manquante — ajoute-la dans Paramètres.',
      );
    }

    try {
      const pageSize = metadataSearchLimit('googlebooks');
      const results = await collectSearchPages({
        pageSize,
        fetchPage: async ({ offset, limit }) => {
          const url = new URL('https://www.googleapis.com/books/v1/volumes');
          url.searchParams.set('q', q);
          url.searchParams.set('maxResults', String(limit));
          url.searchParams.set('startIndex', String(offset));
          url.searchParams.set('printType', 'books');
          url.searchParams.set('key', apiKey);

          const data = await fetchJson(url, {
            signal,
            headers: { 'User-Agent': USER_AGENT },
          });

          const rows = data.items || [];
          const totalRaw = data.totalItems;
          const total =
            totalRaw != null && Number.isFinite(Number(totalRaw))
              ? Number(totalRaw)
              : null;
          return {
            items: rows.map(mapItem),
            total,
            hasMore: total != null ? offset + rows.length < total : null,
          };
        },
      });

      return results.length ? results : stubProvider.search(q);
    } catch (err) {
      console.warn('[VDR] Google Books search failed:', err.message);
      return withNote(
        await stubProvider.search(q),
        `Google Books indisponible: ${err.message}`,
      );
    }
  },
};

/**
 * @param {object} item volume Google Books
 * @returns {import('../types.js').MetadataResult}
 */
export function mapGoogleBooksItem(item) {
  return mapItem(item);
}

/**
 * Extrait série / tome depuis un titre Google Books.
 * @param {string|null|undefined} title
 * @returns {{ series: string|null, volume: number|null }}
 */
export function parseGoogleBookTitle(title) {
  const raw = String(title || '').trim();
  if (!raw) return { series: null, volume: null };

  // Retire le suffixe éditeur fréquent : (comic), (novel), (manga)…
  const core = raw.replace(/\s*\([^)]*\)\s*$/u, '').trim();

  // « Solo Leveling, Vol. 9 » / « Title Volume 3 » / « Title Tome 02 »
  let m = core.match(
    /^(.*?)(?:,)?\s+(?:vol\.?|volume|tome|tomes)\s*0*(\d{1,4})$/iu,
  );
  if (m) {
    const series = cleanPart(m[1]);
    return { series: series || null, volume: Number(m[2]) };
  }

  // « Solo Leveling 04 » / « Solo Leveling 1 »
  m = core.match(/^(.*\S)\s+0*(\d{1,3})$/u);
  if (m) {
    const series = cleanPart(m[1]);
    if (series && series.length >= 2 && !/^\d+$/u.test(series)) {
      return { series, volume: Number(m[2]) };
    }
  }

  // « Solo Leveling - Dæmongrotten » → série = partie gauche
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
  if (!url) return null;
  let u = String(url).trim();
  if (!u) return null;
  if (/^http:\/\//i.test(u)) u = `https://${u.slice(7)}`;
  if (!/^https:\/\//i.test(u)) return null;
  // Coin « curl » décoratif — inutile pour une jacket catalogue
  u = u.replace(/([?&])edge=curl&?/i, '$1').replace(/[?&]$/, '');
  // Prefer a larger edge when Google Books returns zoom=1 thumbnails
  if (/zoom=\d/i.test(u)) u = u.replace(/zoom=\d/i, 'zoom=3');
  else u += (u.includes('?') ? '&' : '?') + 'zoom=3';
  return u;
}

function mapItem(item) {
  const info = item?.volumeInfo || {};
  const title = String(info.title || '').trim() || 'Book';
  const seriesInfo = info.seriesInfo || null;
  const fromTitle = parseGoogleBookTitle(title);

  const volumeFromSeries = parseVolume(seriesInfo?.bookDisplayNumber);
  const volume =
    volumeFromSeries != null ? volumeFromSeries : fromTitle.volume;

  const series = resolveSeries(title, seriesInfo, fromTitle);

  return {
    id: `googlebooks:${item.id}`,
    title,
    series,
    volume,
    author: Array.isArray(info.authors) ? info.authors[0] || null : null,
    year: extractYear(info.publishedDate),
    description: info.description
      ? String(info.description).replace(/\s+/g, ' ').trim().slice(0, 600)
      : null,
    coverUrl: pickGoogleCover(info.imageLinks),
    source: 'googlebooks',
    confidence: 0.75,
  };
}

/**
 * seriesInfo.shortSeriesBookTitle est souvent le titre complet (« Solo
 * Leveling, Vol. 3 (comic) ») — inutile. subtitle ≠ série. On préfère
 * bookDisplayNumber + parse titre.
 * @param {string} title
 * @param {object|null} seriesInfo
 * @param {{ series: string|null, volume: number|null }} fromTitle
 */
function resolveSeries(title, seriesInfo, fromTitle) {
  const short = String(seriesInfo?.shortSeriesBookTitle || '').trim();
  if (short && short !== title) {
    const fromShort = parseGoogleBookTitle(short);
    if (fromShort.series) return fromShort.series;
    // short distinct mais sans Vol. — garder tel quel si raisonnable
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

function withNote(results, note) {
  return results.map((r) => ({
    ...r,
    description: `${r.description || ''} (${note})`.trim(),
  }));
}
