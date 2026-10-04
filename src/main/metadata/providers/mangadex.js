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
  extractYear,
} from '../types.js';
import { stubProvider } from './stub.js';

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
            items: rows.map(mapManga),
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

function mapManga(item) {
  const attrs = item.attributes || {};
  const titles = attrs.title || {};
  const title =
    titles.en ||
    titles.ja ||
    titles['ja-ro'] ||
    Object.values(titles)[0] ||
    'Manga';
  const series = titles['ja-ro'] || titles.en || titles.ja || title;

  return {
    id: `mangadex:${item.id}`,
    title,
    series,
    volume: null,
    author: findAuthor(item.relationships),
    year: extractYear(attrs.year),
    description: pickDescription(attrs.description),
    coverUrl: coverUrl(item.id, item.relationships),
    source: 'mangadex',
    confidence: 0.8,
  };
}

function pickDescription(desc) {
  if (!desc || typeof desc !== 'object') return null;
  const text = desc.en || desc.fr || Object.values(desc)[0];
  if (!text) return null;
  return String(text).replace(/\s+/g, ' ').trim().slice(0, 600);
}

function findAuthor(relationships) {
  if (!Array.isArray(relationships)) return null;
  const author = relationships.find((r) => r.type === 'author');
  return author?.attributes?.name || null;
}

function coverUrl(mangaId, relationships) {
  if (!Array.isArray(relationships)) return null;
  const cover = relationships.find((r) => r.type === 'cover_art');
  const fileName = cover?.attributes?.fileName;
  if (!fileName) return null;
  return `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.256.jpg`;
}

async function softFallback(q, note) {
  const stub = await stubProvider.search(q);
  return stub.map((r) => ({
    ...r,
    description: `${r.description || ''} (${note})`.trim(),
  }));
}
