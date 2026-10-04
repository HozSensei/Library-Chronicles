/**
 * Google Books API — livres/BD. Quota gratuit mais clé API requise.
 * Docs: https://developers.google.com/books/docs/v1/using
 * Pagination : startIndex (0-based) + maxResults (max 40), totalItems.
 *
 * Mapping → contrat NormalizedMeta via mappers/googlebooks.js.
 */

import { fetchJson } from '../fetch.js';
import {
  USER_AGENT,
  metadataSearchLimit,
  collectSearchPages,
} from '../types.js';
import { stubProvider } from './stub.js';
import {
  mapGoogleBooksItem,
  parseGoogleBookTitle,
  upgradeGoogleCover,
} from '../mappers/googlebooks.js';

export { mapGoogleBooksItem, parseGoogleBookTitle, upgradeGoogleCover };

/** @type {import('../types.js').MetadataProvider} */
export const googleBooksProvider = {
  id: 'googlebooks',
  label: 'Google Books',
  requiresApiKey: true,
  freeLabel: 'Clé API requise',
  helpText:
    'Active l’API Books dans Google Cloud Console, crée une clé API (quota gratuit). Stockée localement uniquement.',
  helpUrl: 'https://console.cloud.google.com/apis/library/books.googleapis.com',
  helpLinkLabel: 'Obtenir une clé',

  async search(query, { apiKey, signal } = {}) {
    const q = String(query || '').trim();
    if (!q) return [];

    if (!apiKey) {
      return withNote(
        await stubProvider.search(q),
        'Google Books : clé API manquante — ajoute-la dans Paramètres.',
      );
    }

    try {
      const pageSize = metadataSearchLimit('googlebooks');
      const results = await collectSearchPages({
        pageSize,
        fetchPage: async ({ offset, limit }) => {
          const url = new URL('https://www.googleapis.com/books/v1/volumes');
          url.searchParams.set('q', q);
          url.searchParams.set('maxResults', String(limit));
          url.searchParams.set('startIndex', String(offset));
          url.searchParams.set('printType', 'books');
          url.searchParams.set('key', apiKey);

          const data = await fetchJson(url, {
            signal,
            headers: { 'User-Agent': USER_AGENT },
          });

          const rows = data.items || [];
          const totalRaw = data.totalItems;
          const total =
            totalRaw != null && Number.isFinite(Number(totalRaw))
              ? Number(totalRaw)
              : null;
          return {
            items: rows.map(mapGoogleBooksItem),
            total,
            hasMore: total != null ? offset + rows.length < total : null,
          };
        },
      });

      return results.length ? results : stubProvider.search(q);
    } catch (err) {
      console.warn('[VDR] Google Books search failed:', err.message);
      return withNote(
        await stubProvider.search(q),
        `Google Books indisponible: ${err.message}`,
      );
    }
  },
};

function withNote(results, note) {
  return results.map((r) => ({
    ...r,
    description: `${r.description || ''} (${note})`.trim(),
    synopsis: `${r.synopsis || r.description || ''} (${note})`.trim(),
  }));
}
