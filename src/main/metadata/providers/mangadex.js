/**
 * MangaDex API v5 — manga. Gratuit, sans clé pour la recherche publique.
 * Docs: https://api.mangadex.org/docs/
 */

import { fetchJson } from '../fetch.js';
import { USER_AGENT, METADATA_SEARCH_LIMIT, extractYear } from '../types.js';
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
      const url = new URL('https://api.mangadex.org/manga');
      url.searchParams.set('title', q);
      url.searchParams.set('limit', String(METADATA_SEARCH_LIMIT));
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

      const results = (data.data || []).map((item) => {
        const attrs = item.attributes || {};
        const titles = attrs.title || {};
        const title =
          titles.en ||
          titles.ja ||
          titles['ja-ro'] ||
          Object.values(titles)[0] ||
          q;
        const alt = attrs.altTitles || [];
        const series =
          titles['ja-ro'] || titles.en || titles.ja || title;

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
      });

      return results.length ? results : softFallback(q, 'MangaDex : aucun résultat');
    } catch (err) {
      console.warn('[VDR] MangaDex search failed:', err.message);
      return softFallback(q, `MangaDex indisponible: ${err.message}`);
    }
  },
};

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
