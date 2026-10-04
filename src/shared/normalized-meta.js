/**
 * Contrat strict NormalizedMeta — sortie garantie de chaque mapper provider.
 *
 * Schéma JSON : docs/metadata/normalized-meta.schema.json
 * Index providers : docs/metadata/README.md
 *
 * coverUrl : https absolu ou null (jamais http, jamais relatif, jamais data:).
 * authors  : tableau (éventuellement vide) — `author` = premier élément (compat UI/DB).
 * synopsis : texte long — `description` alias (compat UI/DB).
 * provider / providerId : identité source ; `id` = `${provider}:${providerId}`.
 * source   : alias de provider (compat import / pastilles).
 */

import { normalizeRemoteCoverUrl } from './cover-url.js';

/** @typedef {'googlebooks'|'anilist'|'mangadex'|'openlibrary'|'comicvine'|'stub'} MetaProviderId */

/**
 * @typedef {{
 *   title: string,
 *   series: string|null,
 *   volume: number|null,
 *   authors: string[],
 *   year: number|null,
 *   synopsis: string|null,
 *   coverUrl: string|null,
 *   provider: string,
 *   providerId: string|null,
 *   confidence: number,
 *   id: string,
 *   author: string|null,
 *   description: string|null,
 *   source: string,
 * }} NormalizedMeta
 */

/**
 * Normalise une URL jacket vers https absolu, ou null.
 * Accepte http:// et //host/path ; rejette data:, relatif, ftp, etc.
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function absoluteHttpsCoverUrl(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith('//')) s = `https:${s}`;
  const url = normalizeRemoteCoverUrl(s);
  return url || null;
}

/**
 * Construit un NormalizedMeta strict (tous les champs présents).
 * @param {{
 *   title?: string|null,
 *   series?: string|null,
 *   volume?: number|null,
 *   authors?: string[]|string|null,
 *   author?: string|null,
 *   year?: number|null,
 *   synopsis?: string|null,
 *   description?: string|null,
 *   coverUrl?: string|null,
 *   provider: string,
 *   providerId?: string|null|number,
 *   confidence?: number,
 * }} input
 * @returns {NormalizedMeta}
 */
export function createNormalizedMeta(input) {
  const provider = String(input?.provider || 'stub').trim() || 'stub';
  const providerId =
    input?.providerId != null && String(input.providerId).trim() !== ''
      ? String(input.providerId).trim()
      : null;

  const authors = normalizeAuthors(input?.authors, input?.author);
  const synopsis = normalizeSynopsis(input?.synopsis ?? input?.description);
  const coverUrl = absoluteHttpsCoverUrl(input?.coverUrl);
  const title = String(input?.title || '').trim() || 'Untitled';
  const seriesRaw = String(input?.series || '').trim();
  const series = seriesRaw || null;
  const volume = normalizeVolume(input?.volume);
  const year = normalizeYear(input?.year);
  const confidence = clampConfidence(input?.confidence);

  return {
    title,
    series,
    volume,
    authors,
    year,
    synopsis,
    coverUrl,
    provider,
    providerId,
    confidence,
    id: providerId ? `${provider}:${providerId}` : `${provider}:unknown`,
    author: authors[0] || null,
    description: synopsis,
    source: provider,
  };
}

/**
 * Garantit qu’un objet quelconque respecte le contrat (re-normalise coverUrl).
 * @param {object|null|undefined} value
 * @returns {NormalizedMeta|null}
 */
export function ensureNormalizedMeta(value) {
  if (!value || typeof value !== 'object') return null;
  if (!value.provider && !value.source) return null;
  return createNormalizedMeta({
    title: value.title,
    series: value.series,
    volume: value.volume,
    authors: value.authors,
    author: value.author,
    year: value.year,
    synopsis: value.synopsis ?? value.description,
    coverUrl: value.coverUrl,
    provider: value.provider || value.source,
    providerId: value.providerId ?? extractProviderId(value.id, value.provider || value.source),
    confidence: value.confidence,
  });
}

/**
 * @param {string|null|undefined} id
 * @param {string|null|undefined} provider
 */
function extractProviderId(id, provider) {
  const raw = String(id || '').trim();
  if (!raw) return null;
  const prefix = `${String(provider || '').trim()}:`;
  if (prefix.length > 1 && raw.startsWith(prefix)) {
    return raw.slice(prefix.length) || null;
  }
  return raw;
}

/**
 * @param {string[]|string|null|undefined} authors
 * @param {string|null|undefined} author
 * @returns {string[]}
 */
function normalizeAuthors(authors, author) {
  /** @type {string[]} */
  const out = [];
  const push = (v) => {
    const s = String(v || '').trim();
    if (s && !out.includes(s)) out.push(s);
  };
  if (Array.isArray(authors)) {
    for (const a of authors) push(a);
  } else if (authors != null && authors !== '') {
    push(authors);
  }
  if (!out.length) push(author);
  return out;
}

/**
 * @param {string|null|undefined} text
 * @returns {string|null}
 */
function normalizeSynopsis(text) {
  if (text == null) return null;
  const s = String(text).replace(/\s+/g, ' ').trim().slice(0, 600);
  return s || null;
}

/**
 * @param {unknown} v
 * @returns {number|null}
 */
function normalizeVolume(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} v
 * @returns {number|null}
 */
function normalizeYear(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const y = Math.trunc(n);
  if (y < 1000 || y > 2100) return null;
  return y;
}

/**
 * @param {unknown} v
 * @returns {number}
 */
function clampConfidence(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}
