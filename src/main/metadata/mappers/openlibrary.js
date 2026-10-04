/**
 * Mapper Open Library : doc search.json brut → NormalizedMeta.
 */

import { extractYear } from '../types.js';
import { createNormalizedMeta } from '../../../shared/normalized-meta.js';

/**
 * @param {object|null|undefined} doc
 * @param {{ index?: number, fallbackTitle?: string }} [opts]
 * @returns {import('../../../shared/normalized-meta.js').NormalizedMeta}
 */
export function mapOpenLibraryDoc(doc, opts = {}) {
  const coverId = doc?.cover_i;
  const seriesRaw = Array.isArray(doc?.series) ? doc.series[0] : doc?.series;
  const series =
    seriesRaw != null && String(seriesRaw).trim()
      ? String(seriesRaw).trim()
      : null;
  const authors = Array.isArray(doc?.author_name)
    ? doc.author_name.map((a) => String(a || '').trim()).filter(Boolean)
    : [];
  const key = doc?.key != null ? String(doc.key) : null;
  const providerId = key || (opts.index != null ? String(opts.index) : null);

  return createNormalizedMeta({
    title: doc?.title || opts.fallbackTitle || 'Book',
    series,
    volume: null,
    authors,
    year: extractYear(doc?.first_publish_year),
    synopsis: doc?.subtitle || null,
    // -L = large (meilleur pour jacket catalogue que -M medium)
    coverUrl: coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : null,
    provider: 'openlibrary',
    providerId,
    confidence: 0.7,
  });
}
