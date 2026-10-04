/**
 * Mapper MangaDex : manga API v5 brut → NormalizedMeta.
 *
 * Raw typique : `{ id, attributes: { title, year, description }, relationships }`.
 * Cover : uploads.mangadex.org/covers/{id}/{fileName}.512.jpg
 * Doc : docs/metadata/mangadex.md — fixture mangadex-solo-leveling.json
 */

import { extractYear } from '../types.js';
import { createNormalizedMeta } from '../../../shared/normalized-meta.js';

/**
 * @param {object|null|undefined} item manga MangaDex
 * @returns {import('../../../shared/normalized-meta.js').NormalizedMeta}
 */
export function mapMangadexItem(item) {
  const attrs = item?.attributes || {};
  const titles = attrs.title || {};
  const title =
    titles.en ||
    titles.ja ||
    titles['ja-ro'] ||
    Object.values(titles)[0] ||
    'Manga';
  const series = titles['ja-ro'] || titles.en || titles.ja || title;

  return createNormalizedMeta({
    title,
    series,
    volume: null,
    authors: findAuthors(item?.relationships),
    year: extractYear(attrs.year),
    synopsis: pickDescription(attrs.description),
    coverUrl: buildCoverUrl(item?.id, item?.relationships),
    provider: 'mangadex',
    providerId: item?.id != null ? String(item.id) : null,
    confidence: 0.8,
  });
}

/**
 * @param {object|null|undefined} desc
 * @returns {string|null}
 */
function pickDescription(desc) {
  if (!desc || typeof desc !== 'object') return null;
  const text = desc.en || desc.fr || Object.values(desc)[0];
  if (!text) return null;
  return String(text).replace(/\s+/g, ' ').trim().slice(0, 600);
}

/**
 * @param {Array|null|undefined} relationships
 * @returns {string[]}
 */
function findAuthors(relationships) {
  if (!Array.isArray(relationships)) return [];
  /** @type {string[]} */
  const out = [];
  for (const r of relationships) {
    if (r?.type !== 'author' && r?.type !== 'artist') continue;
    const name = String(r?.attributes?.name || '').trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * @param {string|null|undefined} mangaId
 * @param {Array|null|undefined} relationships
 * @returns {string|null}
 */
function buildCoverUrl(mangaId, relationships) {
  if (!Array.isArray(relationships) || !mangaId) return null;
  const cover = relationships.find((r) => r.type === 'cover_art');
  const fileName = cover?.attributes?.fileName;
  if (!fileName) return null;
  return `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.512.jpg`;
}
