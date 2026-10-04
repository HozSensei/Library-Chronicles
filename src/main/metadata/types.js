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
 */
export const METADATA_SEARCH_LIMITS = Object.freeze({
  anilist: 50,
  mangadex: 100,
  openlibrary: 100,
  googlebooks: 40,
  comicvine: 100,
  stub: 50,
});

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
