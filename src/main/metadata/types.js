/**
 * Types et helpers partagés pour les providers de métadonnées.
 */

/** @typedef {{
 *   id: string,
 *   title: string,
 *   series?: string|null,
 *   volume?: number|null,
 *   author?: string|null,
 *   year?: number|null,
 *   description?: string|null,
 *   coverUrl?: string|null,
 *   source: string,
 *   confidence: number
 * }} MetadataResult */

/** @typedef {{
 *   id: string,
 *   label: string,
 *   requiresApiKey: boolean,
 *   freeLabel: string,
 *   helpText?: string|null,
 *   helpUrl?: string|null,
 *   helpLinkLabel?: string|null,
 *   search: (query: string, opts?: { apiKey?: string|null, signal?: AbortSignal }) => Promise<MetadataResult[]>
 * }} MetadataProvider */

export const USER_AGENT = 'VerticalDeckReader/0.1 (Library-Chronicles; +https://github.com/HozSensei/Library-Chronicles)';

/**
 * Plafonds techniques par provider (limites API documentées — pas une coupe UX).
 * - AniList Page.perPage max 50
 * - MangaDex `limit` max 100
 * - Open Library `limit` : 100 (défaut / page raisonnable)
 * - Google Books `maxResults` max 40
 * - ComicVine `limit` max 100
 *
 * Chaque provider ne demande qu’une page à la fois ; `collectSearchPages`
 * enchaîne les pages jusqu’à `METADATA_SEARCH_MAX_TOTAL`.
 */
export const METADATA_SEARCH_LIMITS = Object.freeze({
  anilist: 50,
  mangadex: 100,
  openlibrary: 100,
  googlebooks: 40,
  comicvine: 100,
  stub: 50,
});

/**
 * Plafond de sécurité global (toutes pages confondues).
 * Évite le spam API tout en récupérant bien plus qu’une seule page.
 */
export const METADATA_SEARCH_MAX_TOTAL = 250;

/** Alias du plafond AniList (50) — préférer `metadataSearchLimit(id)`. */
export const METADATA_SEARCH_LIMIT = METADATA_SEARCH_LIMITS.anilist;

/**
 * @param {string} [providerId]
 * @returns {number}
 */
export function metadataSearchLimit(providerId) {
  const id = String(providerId || '').trim();
  if (id && Object.prototype.hasOwnProperty.call(METADATA_SEARCH_LIMITS, id)) {
    return METADATA_SEARCH_LIMITS[id];
  }
  return METADATA_SEARCH_LIMIT;
}

/**
 * Enchaîne les pages d’une API de recherche jusqu’au plafond global.
 *
 * @template T
 * @param {{
 *   pageSize: number,
 *   maxTotal?: number,
 *   fetchPage: (ctx: { page: number, offset: number, limit: number }) =>
 *     Promise<{ items: T[], hasMore?: boolean|null, total?: number|null }>
 * }} opts
 * @returns {Promise<T[]>}
 */
export async function collectSearchPages({
  pageSize,
  maxTotal = METADATA_SEARCH_MAX_TOTAL,
  fetchPage,
}) {
  const limit = Math.max(1, Number(pageSize) || 1);
  const cap = Math.max(1, Number(maxTotal) || METADATA_SEARCH_MAX_TOTAL);
  const maxPages = Math.ceil(cap / limit) + 1;
  /** @type {T[]} */
  const out = [];
  const seen = new Set();
  let page = 1;
  let offset = 0;

  for (let i = 0; i < maxPages && out.length < cap; i += 1) {
    const batchLimit = Math.min(limit, cap - out.length);
    let payload;
    try {
      payload = await fetchPage({ page, offset, limit: batchLimit });
    } catch (err) {
      // Page 2+ en échec : conserver les hits déjà collectés (ne pas stubber).
      if (out.length) {
        console.warn(
          '[VDR] metadata pagination stopped early:',
          err?.message || err,
        );
        break;
      }
      throw err;
    }
    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (!items.length) break;

    for (const item of items) {
      const key =
        item && typeof item === 'object' && 'id' in item && item.id != null
          ? String(item.id)
          : null;
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      out.push(item);
      if (out.length >= cap) break;
    }

    if (out.length >= cap) break;

    const total =
      payload?.total != null && Number.isFinite(Number(payload.total))
        ? Number(payload.total)
        : null;
    if (payload?.hasMore === false) break;
    if (total != null && out.length >= total) break;
    // Page incomplète → dernière page (sauf hasMore forcé à true).
    if (items.length < batchLimit && payload?.hasMore !== true) break;

    page += 1;
    offset += items.length;
  }

  return out.slice(0, cap);
}

export function parseVolume(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function extractYear(v) {
  if (!v) return null;
  const m = String(v).match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

export function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function stripHtml(html) {
  if (!html) return null;
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600) || null;
}

// Réexports : logique query partagée (préfill vs query manuelle).
export {
  normalizeMetadataQuery,
  prepareMetadataSearchQuery,
} from '../../shared/metadata-query.js';
