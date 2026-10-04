/**
 * ComicVine — BD/comics. Clé API requise.
 * Docs: https://comicvine.gamespot.com/api/
 * Pagination : offset + limit (max 100), number_of_total_results.
 */

import { fetchJson } from '../fetch.js';
import {
  USER_AGENT,
  metadataSearchLimit,
  collectSearchPages,
  parseVolume,
  extractYear,
  stripHtml,
} from '../types.js';
import { stubProvider } from './stub.js';

/** @type {import('../types.js').MetadataProvider} */
export const comicvineProvider = {
  id: 'comicvine',
  label: 'ComicVine',
  requiresApiKey: true,
  freeLabel: 'Clé API requise',
  helpText: 'Compte ComicVine gratuit, puis génère une clé API sur la page développeurs.',
  helpUrl: 'https://comicvine.gamespot.com/api/',
  helpLinkLabel: 'Obtenir une clé',

  async search(query, { apiKey, signal } = {}) {
    const q = String(query || '').trim();
    if (!q) return [];

    if (!apiKey) {
      return withNote(
        await stubProvider.search(q),
        'ComicVine : clé API manquante — ajoute-la dans Paramètres.',
      );
    }

    try {
      const pageSize = metadataSearchLimit('comicvine');
      const results = await collectSearchPages({
        pageSize,
        fetchPage: async ({ offset, limit }) => {
          const url = new URL('https://comicvine.gamespot.com/api/search/');
          url.searchParams.set('api_key', apiKey);
          url.searchParams.set('format', 'json');
          url.searchParams.set('resources', 'volume,issue');
          url.searchParams.set('query', q);
          url.searchParams.set('limit', String(limit));
          url.searchParams.set('offset', String(offset));

          const data = await fetchJson(url, {
            signal,
            headers: { 'User-Agent': USER_AGENT },
          });

          const rows = data.results || [];
          const totalRaw = data.number_of_total_results;
          const total =
            totalRaw != null && Number.isFinite(Number(totalRaw))
              ? Number(totalRaw)
              : null;
          return {
            items: rows.map((item, i) => mapItem(item, i, q)),
            total,
            hasMore: total != null ? offset + rows.length < total : null,
          };
        },
      });

      return results.length ? results : stubProvider.search(q);
    } catch (err) {
      console.warn('[VDR] ComicVine search failed:', err.message);
      return withNote(
        await stubProvider.search(q),
        `ComicVine indisponible: ${err.message}`,
      );
    }
  },
};

function mapItem(item, i, q) {
  return {
    id: `comicvine:${item.id || i}`,
    title: item.name || item.volume?.name || q,
    series: item.volume?.name || item.name || null,
    volume: parseVolume(item.issue_number || item.count_of_issues),
    author: null,
    year: extractYear(item.start_year || item.cover_date),
    description: stripHtml(item.deck || item.description),
    coverUrl: item.image?.thumb_url || item.image?.small_url || null,
    source: 'comicvine',
    confidence: 0.8,
  };
}

function withNote(results, note) {
  return results.map((r) => ({
    ...r,
    description: `${r.description || ''} (${note})`.trim(),
  }));
}
