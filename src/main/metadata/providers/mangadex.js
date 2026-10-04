/**
 * MangaDex API v5 — manga. Gratuit, sans clé pour la recherche publique.
 * Docs: https://api.mangadex.org/docs/
 * Pagination : offset + limit (max 100), `total` dans la réponse.
 */

import { fetchJson } from '../fetch.js';
import {
  USER_AGENT,
  metadataSearchLimit,
  collectSearchPages,
} from '../types.js';
import { stubProvider } from './stub.js';
import { mapMangadexItem } from '../mappers/mangadex.js';

/** @type {import('../types.js').MetadataProvider} */
export const mangadexProvider = {
  id: 'mangadex',
  label: 'MangaDex',
  requiresApiKey: false,
  freeLabel: 'Gratuit — aucune clé',
  helpText: 'API publique MangaDex. Recherche manga sans clé ; couvertures via CDN.',
  helpUrl: 'https://api.mangadex.org/docs/',
  helpLinkLabel: 'Documentation',

  async search(query, { signal } = {}) {
    const q = String(query || '').trim();
    if (!q) return [];

    try {
      const pageSize = metadataSearchLimit('mangadex');
      const results = await collectSearchPages({
        pageSize,
        fetchPage: async ({ offset, limit }) => {
          const url = new URL('https://api.mangadex.org/manga');
          url.searchParams.set('title', q);
          url.searchParams.set('limit', String(limit));
          url.searchParams.set('offset', String(offset));
          url.searchParams.append('includes[]', 'author');
          url.searchParams.append('includes[]', 'artist');
          url.searchParams.append('includes[]', 'cover_art');
          url.searchParams.append('contentRating[]', 'safe');
          url.searchParams.append('contentRating[]', 'suggestive');
          url.searchParams.append('order[relevance]', 'desc');

          const data = await fetchJson(url, {
            signal,
            headers: {
              'User-Agent': USER_AGENT,
              Accept: 'application/json',
            },
          });

          const rows = data.data || [];
          const total =
            data.total != null && Number.isFinite(Number(data.total))
              ? Number(data.total)
              : null;
          return {
            items: rows.map(mapMangadexItem),
            total,
            hasMore: total != null ? offset + rows.length < total : null,
          };
        },
      });

      return results.length ? results : softFallback(q, 'MangaDex : aucun résultat');
    } catch (err) {
      console.warn('[VDR] MangaDex search failed:', err.message);
      return softFallback(q, `MangaDex indisponible: ${err.message}`);
    }
  },
};

async function softFallback(q, note) {
  const stub = await stubProvider.search(q);
  return stub.map((r) => ({
    ...r,
    description: `${r.description || ''} (${note})`.trim(),
    synopsis: `${r.synopsis || r.description || ''} (${note})`.trim(),
  }));
}
