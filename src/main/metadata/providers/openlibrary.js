/**
 * Open Library — livres / BD parfois. Gratuit, sans clé.
 * Docs: https://openlibrary.org/dev/docs/api/search
 */

import { fetchJson } from '../fetch.js';
import { USER_AGENT, METADATA_SEARCH_LIMIT, extractYear } from '../types.js';
import { stubProvider } from './stub.js';

/** @type {import('../types.js').MetadataProvider} */
export const openLibraryProvider = {
  id: 'openlibrary',
  label: 'Open Library',
  requiresApiKey: false,
  freeLabel: 'Gratuit — aucune clé',
  helpText: 'Catalogue public Internet Archive. Utile pour livres et certaines BD ; pas besoin de clé.',
  helpUrl: 'https://openlibrary.org/developers/api',
  helpLinkLabel: 'Documentation',

  async search(query, { signal } = {}) {
    const q = String(query || '').trim();
    if (!q) return [];

    try {
      const url = new URL('https://openlibrary.org/search.json');
      url.searchParams.set('q', q);
      url.searchParams.set('limit', String(METADATA_SEARCH_LIMIT));
      url.searchParams.set(
        'fields',
        'key,title,author_name,first_publish_year,cover_i,subtitle,number_of_pages_median',
      );

      const data = await fetchJson(url, {
        signal,
        headers: { 'User-Agent': USER_AGENT },
      });

      const results = (data.docs || []).map((doc, i) => {
        const coverId = doc.cover_i;
        return {
          id: `openlibrary:${doc.key || i}`,
          title: doc.title || q,
          series: null,
          volume: null,
          author: Array.isArray(doc.author_name) ? doc.author_name[0] : null,
          year: extractYear(doc.first_publish_year),
          description: doc.subtitle || null,
          coverUrl: coverId
            ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
            : null,
          source: 'openlibrary',
          confidence: 0.7,
        };
      });

      return results.length ? results : softFallback(q, 'Open Library : aucun résultat');
    } catch (err) {
      console.warn('[VDR] Open Library search failed:', err.message);
      return softFallback(q, `Open Library indisponible: ${err.message}`);
    }
  },
};

async function softFallback(q, note) {
  const stub = await stubProvider.search(q);
  return stub.map((r) => ({
    ...r,
    description: `${r.description || ''} (${note})`.trim(),
  }));
}
