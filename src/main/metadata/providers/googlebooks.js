/**
 * Google Books API — livres/BD. Quota gratuit mais clé API requise.
 * Docs: https://developers.google.com/books/docs/v1/using
 */

import { fetchJson } from '../fetch.js';
import { USER_AGENT, extractYear, parseVolume } from '../types.js';
import { stubProvider } from './stub.js';

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
      const url = new URL('https://www.googleapis.com/books/v1/volumes');
      url.searchParams.set('q', q);
      url.searchParams.set('maxResults', '8');
      url.searchParams.set('printType', 'books');
      url.searchParams.set('key', apiKey);

      const data = await fetchJson(url, {
        signal,
        headers: { 'User-Agent': USER_AGENT },
      });

      const results = (data.items || []).map((item) => {
        const info = item.volumeInfo || {};
        const seriesInfo = info.seriesInfo;
        return {
          id: `googlebooks:${item.id}`,
          title: info.title || q,
          series: seriesInfo?.shortSeriesBookTitle || info.subtitle || null,
          volume: parseVolume(seriesInfo?.bookDisplayNumber),
          author: Array.isArray(info.authors) ? info.authors[0] : null,
          year: extractYear(info.publishedDate),
          description: info.description
            ? String(info.description).replace(/\s+/g, ' ').trim().slice(0, 600)
            : null,
          coverUrl:
            info.imageLinks?.thumbnail ||
            info.imageLinks?.smallThumbnail ||
            null,
          source: 'googlebooks',
          confidence: 0.75,
        };
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
  }));
}
