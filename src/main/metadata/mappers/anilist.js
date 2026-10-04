/**
 * Mapper AniList : media GraphQL brut → NormalizedMeta.
 *
 * Raw typique : `{ id, title, volumes, startDate, description, coverImage, staff }`.
 * `volumes` = total série → volume NormalizedMeta reste null.
 * Doc : docs/metadata/anilist.md — fixture anilist-one-piece.json
 */

import { stripHtml } from '../types.js';
import { createNormalizedMeta } from '../../../shared/normalized-meta.js';

/**
 * @param {object|null|undefined} item media AniList
 * @returns {import('../../../shared/normalized-meta.js').NormalizedMeta}
 */
export function mapAnilistItem(item) {
  const title =
    item?.title?.english ||
    item?.title?.romaji ||
    item?.title?.native ||
    'Manga';
  const series =
    item?.title?.romaji || item?.title?.english || title || null;
  const author = pickAuthor(item?.staff?.edges);
  const coverUrl =
    item?.coverImage?.large || item?.coverImage?.medium || null;

  return createNormalizedMeta({
    title,
    series,
    // `volumes` AniList = total de la série, pas le n° de tome courant.
    volume: null,
    authors: author ? [author] : [],
    year: item?.startDate?.year || null,
    synopsis: stripHtml(item?.description),
    coverUrl,
    provider: 'anilist',
    providerId: item?.id != null ? String(item.id) : null,
    confidence: 0.85,
  });
}

/**
 * @param {Array|{role?: string, node?: { name?: { full?: string } }}[]|null|undefined} edges
 */
function pickAuthor(edges) {
  if (!Array.isArray(edges) || !edges.length) return null;
  const story = edges.find((e) =>
    /story|author|écrivain|manga/i.test(e.role || ''),
  );
  const edge = story || edges[0];
  return edge?.node?.name?.full || null;
}
