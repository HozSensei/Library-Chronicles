/**
 * AniList GraphQL — manga. Gratuit, sans clé pour les requêtes publiques.
 * Docs: https://docs.anilist.co/
 * Pagination : Page(page, perPage) + pageInfo.hasNextPage (perPage max 50).
 */

import { fetchJson } from '../fetch.js';
import {
  USER_AGENT,
  metadataSearchLimit,
  collectSearchPages,
  stripHtml,
} from '../types.js';
import { stubProvider } from './stub.js';

const ENDPOINT = 'https://graphql.anilist.co';

const SEARCH_QUERY = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
      perPage
    }
    media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
      id
      title { romaji english native }
      volumes
      chapters
      startDate { year }
      description(asHtml: false)
      coverImage { large medium }
      staff(sort: RELEVANCE, perPage: 4) {
        edges {
          role
          node { name { full } }
        }
      }
    }
  }
}
`;

/** @type {import('../types.js').MetadataProvider} */
export const anilistProvider = {
  id: 'anilist',
  label: 'AniList',
  requiresApiKey: false,
  freeLabel: 'Gratuit — aucune clé',
  helpText: 'API GraphQL publique (manga). Idéale pour titres manga ; aucune clé pour les recherches.',
  helpUrl: 'https://docs.anilist.co/',
  helpLinkLabel: 'Documentation',

  async search(query, { signal } = {}) {
    const q = String(query || '').trim();
    if (!q) return [];

    try {
      const pageSize = metadataSearchLimit('anilist');
      const results = await collectSearchPages({
        pageSize,
        fetchPage: async ({ page, limit }) => {
          const data = await fetchJson(ENDPOINT, {
            method: 'POST',
            signal,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'User-Agent': USER_AGENT,
            },
            body: JSON.stringify({
              query: SEARCH_QUERY,
              variables: {
                search: q,
                page,
                perPage: limit,
              },
            }),
          });

          if (data.errors?.length) {
            throw new Error(data.errors[0]?.message || 'Erreur GraphQL');
          }

          const pageData = data.data?.Page || {};
          const media = pageData.media || [];
          const pageInfo = pageData.pageInfo || {};
          return {
            items: media.map(mapMedia),
            hasMore: Boolean(pageInfo.hasNextPage),
            total:
              pageInfo.total != null && Number.isFinite(Number(pageInfo.total))
                ? Number(pageInfo.total)
                : null,
          };
        },
      });

      return results.length ? results : softFallback(q, 'AniList : aucun résultat');
    } catch (err) {
      console.warn('[VDR] AniList search failed:', err.message);
      return softFallback(q, `AniList indisponible: ${err.message}`);
    }
  },
};

function mapMedia(item) {
  const title =
    item.title?.english || item.title?.romaji || item.title?.native || 'Manga';
  const author = pickAuthor(item.staff?.edges);
  return {
    id: `anilist:${item.id}`,
    title,
    series: item.title?.romaji || item.title?.english || title,
    volume: item.volumes ?? null,
    author,
    year: item.startDate?.year || null,
    description: stripHtml(item.description),
    coverUrl: item.coverImage?.large || item.coverImage?.medium || null,
    source: 'anilist',
    confidence: 0.85,
  };
}

function pickAuthor(edges) {
  if (!Array.isArray(edges) || !edges.length) return null;
  const story = edges.find((e) => /story|author|écrivain|manga/i.test(e.role || ''));
  const edge = story || edges[0];
  return edge?.node?.name?.full || null;
}

async function softFallback(q, note) {
  const stub = await stubProvider.search(q);
  return stub.map((r) => ({
    ...r,
    description: `${r.description || ''} (${note})`.trim(),
  }));
}
