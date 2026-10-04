/**
 * Mapper ComicVine : résultat search brut → NormalizedMeta.
 */

import { parseVolume, extractYear, stripHtml } from '../types.js';
import {
  createNormalizedMeta,
  absoluteHttpsCoverUrl,
} from '../../../shared/normalized-meta.js';

/**
 * @param {object|null|undefined} item
 * @param {{ index?: number, fallbackTitle?: string }} [opts]
 * @returns {import('../../../shared/normalized-meta.js').NormalizedMeta}
 */
export function mapComicVineItem(item, opts = {}) {
  const issueNo = item?.issue_number;
  // count_of_issues = total de la série (volume resource) — pas un n° de tome.
  const volume =
    issueNo != null && String(issueNo).trim() !== ''
      ? parseVolume(issueNo)
      : null;

  return createNormalizedMeta({
    title: item?.name || item?.volume?.name || opts.fallbackTitle || 'Comic',
    series: item?.volume?.name || item?.name || null,
    volume,
    authors: [],
    year: extractYear(item?.start_year || item?.cover_date),
    synopsis: stripHtml(item?.deck || item?.description),
    coverUrl: pickComicVineCover(item?.image),
    provider: 'comicvine',
    providerId:
      item?.id != null
        ? String(item.id)
        : opts.index != null
          ? String(opts.index)
          : null,
    confidence: 0.8,
  });
}

/**
 * @param {object|null|undefined} image
 * @returns {string|null}
 */
export function pickComicVineCover(image) {
  if (!image || typeof image !== 'object') return null;
  const raw =
    image.medium_url ||
    image.small_url ||
    image.thumb_url ||
    image.original_url ||
    null;
  return absoluteHttpsCoverUrl(raw);
}
