/**
 * Open Library — livres / BD parfois. Gratuit, sans clé.
 * Docs: https://openlibrary.org/dev/docs/api/search
 * Pagination : page (1-based) ou offset + limit (max raisonnable 100).
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
      const pageSize = metadataSearchLimit('openlibrary');
      const results = await collectSearchPages({
        pageSize,
        fetchPage: async ({ page, limit }) => {
          const url = new URL('https://openlibrary.org/search.json');
          url.searchParams.set('q', q);
          url.searchParams.set('limit', String(limit));
          url.searchParams.set('page', String(page));
          url.searchParams.set(
            'fields',
            'key,title,author_name,first_publish_year,cover_i,subtitle,number_of_pages_median',
          );

          const data = await fetchJson(url, {
            signal,
            headers: { 'User-Agent': USER_AGENT },
          });

          const docs = data.docs || [];
          const totalRaw = data.numFound ?? data.num_found;
          const total =
            totalRaw != null && Number.isFinite(Number(totalRaw))
              ? Number(totalRaw)
              : null;
          return {
            items: docs.map((doc, i) => mapDoc(doc, i, q)),
            total,
            hasMore: total != null ? (page - 1) * limit + docs.length < total : null,
          };
        },
      });

      return results.length ? results : softFallback(q, 'Open Library : aucun résultat');
    } catch (err) {
      console.warn('[VDR] Open Library search failed:', err.message);
      return softFallback(q, `Open Library indisponible: ${err.message}`);
    }
  },
};

function mapDoc(doc, i, q) {
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
}

async function softFallback(q, note) {
  const stub = await stubProvider.search(q);
  return stub.map((r) => ({
    ...r,
    description: `${r.description || ''} (${note})`.trim(),
  }));
}
