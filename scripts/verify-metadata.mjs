/**
 * Tests unitaires providers métadonnées (parse + search mock, offline).
 */
import assert from 'assert';
import { detectFromFilename } from '../src/main/metadata/parse-filename.js';
import {
  parseVolume,
  extractYear,
  slug,
  stripHtml,
  normalizeMetadataQuery,
  prepareMetadataSearchQuery,
  METADATA_SEARCH_LIMIT,
  METADATA_SEARCH_LIMITS,
  METADATA_SEARCH_MAX_TOTAL,
  metadataSearchLimit,
  collectSearchPages,
} from '../src/main/metadata/types.js';
import { stubProvider } from '../src/main/metadata/providers/stub.js';
import { comicvineProvider } from '../src/main/metadata/providers/comicvine.js';
import { openLibraryProvider } from '../src/main/metadata/providers/openlibrary.js';
import { anilistProvider } from '../src/main/metadata/providers/anilist.js';
import { mangadexProvider } from '../src/main/metadata/providers/mangadex.js';
import { googleBooksProvider } from '../src/main/metadata/providers/googlebooks.js';
import {
  mapGoogleBooksItem,
  parseGoogleBookTitle,
  upgradeGoogleCover,
} from '../src/main/metadata/mappers/index.js';

// --- helpers ---
{
  const p1 = parseGoogleBookTitle('Solo Leveling, Vol. 9 (comic)');
  assert.equal(p1.series, 'Solo Leveling');
  assert.equal(p1.volume, 9);
  const p2 = parseGoogleBookTitle('Solo Leveling, Vol. 1 (novel)');
  assert.equal(p2.series, 'Solo Leveling');
  assert.equal(p2.volume, 1);
  const p3 = parseGoogleBookTitle('Solo Leveling 04');
  assert.equal(p3.series, 'Solo Leveling');
  assert.equal(p3.volume, 4);
  const p4 = parseGoogleBookTitle('Solo Leveling - Dæmongrotten');
  assert.equal(p4.series, 'Solo Leveling');
  assert.equal(p4.volume, null);
  assert.equal(parseGoogleBookTitle('Akira').series, null);

  const cover = upgradeGoogleCover(
    'http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api',
  );
  assert.ok(cover.startsWith('https://'), 'cover http→https');
  assert.ok(/zoom=3/i.test(cover), 'cover zoom↑');
  assert.ok(!/edge=curl/i.test(cover), 'cover sans edge=curl');
  assert.equal(upgradeGoogleCover(null), null);

  const mapped = mapGoogleBooksItem({
    id: 'o1wVEQAAQBAJ',
    volumeInfo: {
      title: 'Solo Leveling, Vol. 9 (comic)',
      publishedDate: '2024-08-20',
      description: 'Jinwoo returns.',
      seriesInfo: {
        bookDisplayNumber: '9',
        volumeSeries: [{ seriesId: 'SYwsGwAAABBklM', orderNumber: 9 }],
      },
      imageLinks: {
        smallThumbnail:
          'http://books.google.com/books/content?id=o1wVEQAAQBAJ&printsec=frontcover&img=1&zoom=5&edge=curl&source=gbs_api',
        thumbnail:
          'http://books.google.com/books/content?id=o1wVEQAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api',
      },
    },
  });
  assert.equal(mapped.source, 'googlebooks');
  assert.equal(mapped.series, 'Solo Leveling');
  assert.equal(mapped.volume, 9);
  assert.ok(mapped.coverUrl?.startsWith('https://'));
  assert.ok(/zoom=3/i.test(mapped.coverUrl));
  assert.ok(!mapped.coverUrl.includes('edge=curl'));

  // sans imageLinks → pas de cover fabriquée (placeholder Google)
  const noCover = mapGoogleBooksItem({
    id: 'nocover',
    volumeInfo: { title: 'Solo Leveling 04', authors: ['Chugong'] },
  });
  assert.equal(noCover.coverUrl, null);
  assert.equal(noCover.series, 'Solo Leveling');
  assert.equal(noCover.volume, 4);
  assert.equal(noCover.author, 'Chugong');

  // shortSeriesBookTitle = titre complet → ignorer, parser le titre
  const shortDup = mapGoogleBooksItem({
    id: 'WCU6',
    volumeInfo: {
      title: 'Solo Leveling, Vol. 3 (comic)',
      seriesInfo: {
        shortSeriesBookTitle: 'Solo Leveling, Vol. 3 (comic)',
        bookDisplayNumber: '3',
      },
      imageLinks: {
        thumbnail:
          'https://books.google.com/books/content?id=WCU6&printsec=frontcover&img=1&zoom=1&source=gbs_api',
      },
    },
  });
  assert.equal(shortDup.series, 'Solo Leveling');
  assert.equal(shortDup.volume, 3);
}

assert.equal(parseVolume('03'), 3);
assert.equal(parseVolume('Vol. 12'), 12);
assert.equal(parseVolume(null), null);
assert.equal(extractYear('2019-05-01'), 2019);
assert.equal(extractYear(1998), 1998);
assert.equal(slug('One Piece!!'), 'one-piece');
assert.equal(stripHtml('<p>Hello <b>world</b></p>'), 'Hello world');
// Préremplissage auto : strip tome/vol (filename → série)
assert.equal(
  normalizeMetadataQuery('Solo Leveling Tome 1'),
  'Solo Leveling',
);
assert.equal(normalizeMetadataQuery('One Piece - Vol. 03'), 'One Piece');
assert.equal(normalizeMetadataQuery('Naruto T01'), 'Naruto');
assert.equal(normalizeMetadataQuery('Akira'), 'Akira');
assert.equal(
  normalizeMetadataQuery('Solo Leveling Tome 44'),
  'Solo Leveling',
);

// Query manuelle : conserve « Tome N » (intent utilisateur)
assert.equal(
  prepareMetadataSearchQuery('Solo Leveling Tome 44'),
  'Solo Leveling Tome 44',
);
assert.equal(
  prepareMetadataSearchQuery('  Solo Leveling   Tome 1  '),
  'Solo Leveling Tome 1',
);
assert.equal(prepareMetadataSearchQuery('One Piece Vol. 03'), 'One Piece Vol. 03');
assert.equal(METADATA_SEARCH_LIMITS.anilist, 50);
assert.equal(METADATA_SEARCH_LIMITS.mangadex, 100);
assert.equal(METADATA_SEARCH_LIMITS.openlibrary, 100);
assert.equal(METADATA_SEARCH_LIMITS.googlebooks, 40);
assert.equal(METADATA_SEARCH_LIMITS.comicvine, 100);
assert.equal(METADATA_SEARCH_LIMIT, 50);
assert.equal(METADATA_SEARCH_MAX_TOTAL, 250);
assert.equal(metadataSearchLimit('anilist'), 50);
assert.equal(metadataSearchLimit('mangadex'), 100);
assert.equal(metadataSearchLimit('googlebooks'), 40);
assert.equal(metadataSearchLimit('unknown'), METADATA_SEARCH_LIMIT);

// collectSearchPages : multi-pages + plafond + dédup + arrêt page 2+ en erreur
{
  const calls = [];
  const paged = await collectSearchPages({
    pageSize: 2,
    maxTotal: 5,
    fetchPage: async ({ page, offset, limit }) => {
      calls.push({ page, offset, limit });
      const start = offset;
      return {
        items: [
          { id: `x:${start}`, n: start },
          { id: `x:${start + 1}`, n: start + 1 },
        ],
        total: 10,
        hasMore: true,
      };
    },
  });
  assert.equal(paged.length, 5);
  assert.equal(paged[0].id, 'x:0');
  assert.equal(paged[4].id, 'x:4');
  assert.ok(calls.length >= 3, 'au moins 3 pages pour atteindre le plafond 5');

  const deduped = await collectSearchPages({
    pageSize: 2,
    maxTotal: 10,
    fetchPage: async () => ({
      items: [
        { id: 'same', n: 1 },
        { id: 'same', n: 2 },
      ],
      hasMore: false,
    }),
  });
  assert.equal(deduped.length, 1);

  let page2Throws = 0;
  const partial = await collectSearchPages({
    pageSize: 2,
    maxTotal: 20,
    fetchPage: async ({ page }) => {
      if (page === 1) {
        return { items: [{ id: 'a' }, { id: 'b' }], hasMore: true, total: 4 };
      }
      page2Throws += 1;
      throw new Error('page2 boom');
    },
  });
  assert.equal(partial.length, 2);
  assert.equal(page2Throws, 1);
}

const parsed = detectFromFilename('/lib/One Piece - Tome 03 (2019).cbz');
assert.equal(parsed.series, 'One Piece');
assert.equal(parsed.volume, 3);
assert.equal(parsed.year, 2019);

// --- stub offline ---
const stubResults = await stubProvider.search('One Piece');
assert.ok(stubResults.length >= 1);
assert.equal(stubResults[0].source, 'stub');
assert.ok(stubResults[0].title.includes('One Piece') || stubResults[0].series === 'One Piece');

// --- requiresApiKey flags ---
assert.equal(stubProvider.requiresApiKey, false);
assert.equal(openLibraryProvider.requiresApiKey, false);
assert.equal(anilistProvider.requiresApiKey, false);
assert.equal(mangadexProvider.requiresApiKey, false);
assert.equal(comicvineProvider.requiresApiKey, true);
assert.equal(googleBooksProvider.requiresApiKey, true);
assert.ok(comicvineProvider.helpUrl.includes('comicvine.gamespot.com'));
assert.ok(googleBooksProvider.helpUrl.includes('console.cloud.google.com'));

// ComicVine / Google Books sans clé → fallback stub annoté
const cvNoKey = await comicvineProvider.search('Batman', { apiKey: null });
assert.ok(cvNoKey.length >= 1);
assert.ok(String(cvNoKey[0].description).includes('clé API manquante'));

const gbNoKey = await googleBooksProvider.search('Sandman', { apiKey: null });
assert.ok(gbNoKey.length >= 1);
assert.ok(String(gbNoKey[0].description).includes('clé API manquante'));

// --- mock fetch pour parsers réseau ---
const originalFetch = globalThis.fetch;

/** Captures last request payloads to assert query + limit / pagination. */
const seen = {
  openlibrary: null,
  anilist: null,
  mangadex: null,
  googlebooks: null,
  comicvine: null,
};
const pageHits = {
  openlibrary: [],
  anilist: [],
  mangadex: [],
  googlebooks: [],
  comicvine: [],
};

globalThis.fetch = async (url, opts = {}) => {
  const href = String(url);

  if (href.includes('openlibrary.org/search.json')) {
    const u = new URL(href);
    const offset = Number(u.searchParams.get('offset') || '0');
    const limit = Number(u.searchParams.get('limit') || '100');
    seen.openlibrary = {
      q: u.searchParams.get('q'),
      limit: u.searchParams.get('limit'),
      offset: u.searchParams.get('offset'),
    };
    pageHits.openlibrary.push(offset);
    if (u.searchParams.get('q') === 'MultiPageOL') {
      const docs = Array.from({ length: Math.min(limit, 150 - offset) }, (_, i) => ({
        key: `/works/OL${offset + i}W`,
        title: `OL Hit ${offset + i}`,
        author_name: ['A'],
        first_publish_year: 2000,
      }));
      return jsonResponse({ docs, numFound: 150 });
    }
    return jsonResponse({
      docs: [
        {
          key: '/works/OL1W',
          title: 'Akira',
          author_name: ['Katsuhiro Otomo'],
          first_publish_year: 1984,
          cover_i: 123,
          subtitle: 'Tome 1',
        },
      ],
      numFound: 1,
    });
  }

  if (href.includes('graphql.anilist.co')) {
    const body = JSON.parse(opts.body || '{}');
    const vars = body.variables || {};
    seen.anilist = vars;
    pageHits.anilist.push(Number(vars.page || 1));
    if (vars.search === 'MultiPageAL') {
      const page = Number(vars.page || 1);
      const media =
        page === 1
          ? Array.from({ length: 50 }, (_, i) => ({
              id: 1000 + i,
              title: { romaji: `AL ${i}`, english: `AL ${i}`, native: null },
              volumes: null,
              startDate: { year: 2010 },
              description: 'x',
              coverImage: { large: null, medium: null },
              staff: { edges: [] },
            }))
          : Array.from({ length: 10 }, (_, i) => ({
              id: 2000 + i,
              title: { romaji: `AL p2 ${i}`, english: `AL p2 ${i}`, native: null },
              volumes: null,
              startDate: { year: 2011 },
              description: 'y',
              coverImage: { large: null, medium: null },
              staff: { edges: [] },
            }));
      return jsonResponse({
        data: {
          Page: {
            pageInfo: {
              total: 60,
              currentPage: page,
              lastPage: 2,
              hasNextPage: page < 2,
              perPage: vars.perPage,
            },
            media,
          },
        },
      });
    }
    return jsonResponse({
      data: {
        Page: {
          pageInfo: {
            total: 1,
            currentPage: 1,
            lastPage: 1,
            hasNextPage: false,
            perPage: vars.perPage,
          },
          media: [
            {
              id: 30013,
              title: { romaji: 'One Piece', english: 'One Piece', native: 'ワンピース' },
              volumes: 100,
              startDate: { year: 1997 },
              description: 'Pirates.',
              coverImage: { large: 'https://example.com/op.jpg' },
              staff: {
                edges: [{ role: 'Story & Art', node: { name: { full: 'Eiichiro Oda' } } }],
              },
            },
          ],
        },
      },
    });
  }

  if (href.includes('api.mangadex.org/manga')) {
    const u = new URL(href);
    const offset = Number(u.searchParams.get('offset') || '0');
    seen.mangadex = {
      title: u.searchParams.get('title'),
      limit: u.searchParams.get('limit'),
      offset: u.searchParams.get('offset'),
    };
    pageHits.mangadex.push(offset);
    if (u.searchParams.get('title') === 'MultiPageMD') {
      const rows =
        offset === 0
          ? Array.from({ length: 100 }, (_, i) => ({
              id: `md-${i}`,
              attributes: {
                title: { en: `MD ${i}` },
                altTitles: [],
                year: 2001,
                description: { en: 'x' },
              },
              relationships: [],
            }))
          : Array.from({ length: 20 }, (_, i) => ({
              id: `md-${100 + i}`,
              attributes: {
                title: { en: `MD ${100 + i}` },
                altTitles: [],
                year: 2002,
                description: { en: 'y' },
              },
              relationships: [],
            }));
      return jsonResponse({
        data: rows,
        total: 120,
        offset,
        limit: Number(u.searchParams.get('limit')),
      });
    }
    return jsonResponse({
      data: [
        {
          id: 'md-1',
          attributes: {
            title: { en: 'Fullmetal Alchemist' },
            altTitles: [],
            year: 2001,
            description: { en: 'Alchemy.' },
          },
          relationships: [
            { type: 'author', attributes: { name: 'Hiromu Arakawa' } },
            { type: 'cover_art', attributes: { fileName: 'cover.jpg' } },
          ],
        },
      ],
      total: 1,
      offset: 0,
      limit: Number(u.searchParams.get('limit')),
    });
  }

  if (href.includes('googleapis.com/books')) {
    const u = new URL(href);
    const startIndex = Number(u.searchParams.get('startIndex') || '0');
    seen.googlebooks = {
      q: u.searchParams.get('q'),
      maxResults: u.searchParams.get('maxResults'),
      startIndex: u.searchParams.get('startIndex'),
    };
    pageHits.googlebooks.push(startIndex);
    if (u.searchParams.get('q') === 'MultiPageGB') {
      const rows =
        startIndex === 0
          ? Array.from({ length: 40 }, (_, i) => ({
              id: `gb-${i}`,
              volumeInfo: { title: `GB ${i}`, authors: ['A'], publishedDate: '2000' },
            }))
          : Array.from({ length: 40 }, (_, i) => ({
              id: `gb-${40 + i}`,
              volumeInfo: { title: `GB ${40 + i}`, authors: ['A'], publishedDate: '2001' },
            }));
      return jsonResponse({ items: rows, totalItems: 80 });
    }
    return jsonResponse({
      items: [
        {
          id: 'gb1',
          volumeInfo: {
            title: 'Watchmen',
            authors: ['Alan Moore'],
            publishedDate: '1987',
            description: 'Heroes.',
            imageLinks: {
              thumbnail:
                'http://books.google.com/books/content?id=gb1&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api',
            },
          },
        },
      ],
      totalItems: 1,
    });
  }

  if (href.includes('comicvine.gamespot.com')) {
    const u = new URL(href);
    const offset = Number(u.searchParams.get('offset') || '0');
    seen.comicvine = {
      query: u.searchParams.get('query'),
      limit: u.searchParams.get('limit'),
      offset: u.searchParams.get('offset'),
    };
    pageHits.comicvine.push(offset);
    if (u.searchParams.get('query') === 'MultiPageCV') {
      const rows =
        offset === 0
          ? Array.from({ length: 100 }, (_, i) => ({
              id: 1000 + i,
              name: `CV ${i}`,
              start_year: '2000',
              deck: 'x',
            }))
          : Array.from({ length: 30 }, (_, i) => ({
              id: 2000 + i,
              name: `CV ${100 + i}`,
              start_year: '2001',
              deck: 'y',
            }));
      return jsonResponse({
        results: rows,
        number_of_total_results: 130,
        number_of_page_results: rows.length,
        offset,
        limit: Number(u.searchParams.get('limit')),
      });
    }
    return jsonResponse({
      results: [
        {
          id: 42,
          name: 'Batman',
          start_year: '1939',
          deck: 'The Dark Knight',
          image: {
            thumb_url: 'http://example.com/b-thumb.jpg',
            medium_url: 'https://example.com/b.jpg',
          },
        },
      ],
      number_of_total_results: 1,
      number_of_page_results: 1,
      offset: 0,
      limit: Number(u.searchParams.get('limit')),
    });
  }

  throw new Error(`Unexpected fetch: ${href}`);
};

try {
  const ol = await openLibraryProvider.search('Akira');
  assert.equal(ol.length, 1);
  assert.equal(ol[0].source, 'openlibrary');
  assert.equal(ol[0].title, 'Akira');
  assert.equal(ol[0].author, 'Katsuhiro Otomo');
  assert.equal(ol[0].year, 1984);
  assert.ok(ol[0].coverUrl.includes('covers.openlibrary.org'));
  assert.ok(ol[0].coverUrl.endsWith('-L.jpg'), 'Open Library cover large');
  assert.equal(seen.openlibrary.q, 'Akira');
  assert.equal(
    seen.openlibrary.limit,
    String(metadataSearchLimit('openlibrary')),
  );

  const al = await anilistProvider.search('One Piece');
  assert.equal(al.length, 1);
  assert.equal(al[0].source, 'anilist');
  assert.equal(al[0].title, 'One Piece');
  assert.equal(al[0].author, 'Eiichiro Oda');
  assert.equal(al[0].year, 1997);
  assert.equal(al[0].volume, null, 'AniList volumes≠n° tome');
  assert.equal(al[0].coverUrl, 'https://example.com/op.jpg');
  assert.equal(seen.anilist.search, 'One Piece');
  assert.equal(seen.anilist.perPage, metadataSearchLimit('anilist'));

  // Query manuelle « Tome 44 » : l’API reçoit encore le tome (pas de strip)
  const typed = prepareMetadataSearchQuery('Solo Leveling Tome 44');
  assert.equal(typed, 'Solo Leveling Tome 44');
  await anilistProvider.search(typed);
  assert.equal(seen.anilist.search, 'Solo Leveling Tome 44');
  assert.equal(seen.anilist.perPage, metadataSearchLimit('anilist'));

  const md = await mangadexProvider.search('Fullmetal');
  assert.equal(md.length, 1);
  assert.equal(md[0].source, 'mangadex');
  assert.equal(md[0].title, 'Fullmetal Alchemist');
  assert.equal(md[0].author, 'Hiromu Arakawa');
  assert.ok(md[0].coverUrl.includes('uploads.mangadex.org'));
  assert.ok(md[0].coverUrl.endsWith('.512.jpg'), 'MangaDex cover 512');
  assert.equal(seen.mangadex.title, 'Fullmetal');
  assert.equal(seen.mangadex.limit, String(metadataSearchLimit('mangadex')));

  const gb = await googleBooksProvider.search('Watchmen', { apiKey: 'test-key' });
  assert.equal(gb.length, 1);
  assert.equal(gb[0].source, 'googlebooks');
  assert.equal(gb[0].title, 'Watchmen');
  assert.equal(gb[0].author, 'Alan Moore');
  assert.ok(gb[0].coverUrl.startsWith('https://books.google.com/'));
  assert.ok(/zoom=3/i.test(gb[0].coverUrl));
  assert.ok(!/edge=curl/i.test(gb[0].coverUrl));
  assert.equal(seen.googlebooks.q, 'Watchmen');
  assert.equal(
    seen.googlebooks.maxResults,
    String(metadataSearchLimit('googlebooks')),
  );

  const cv = await comicvineProvider.search('Batman', { apiKey: 'cv-key' });
  assert.equal(cv.length, 1);
  assert.equal(cv[0].source, 'comicvine');
  assert.equal(cv[0].title, 'Batman');
  assert.equal(cv[0].year, 1939);
  assert.equal(cv[0].coverUrl, 'https://example.com/b.jpg');
  assert.equal(cv[0].volume, null, 'volume resource sans issue_number');
  assert.equal(seen.comicvine.query, 'Batman');
  assert.equal(seen.comicvine.limit, String(metadataSearchLimit('comicvine')));

  // Multi-page : au-delà d’une seule page API
  pageHits.openlibrary = [];
  const olMulti = await openLibraryProvider.search('MultiPageOL');
  assert.equal(olMulti.length, 150);
  assert.ok(pageHits.openlibrary.includes(0) && pageHits.openlibrary.includes(100));

  pageHits.anilist = [];
  const alMulti = await anilistProvider.search('MultiPageAL');
  assert.equal(alMulti.length, 60);
  assert.ok(pageHits.anilist.includes(1) && pageHits.anilist.includes(2));

  pageHits.mangadex = [];
  const mdMulti = await mangadexProvider.search('MultiPageMD');
  assert.equal(mdMulti.length, 120);
  assert.ok(pageHits.mangadex.includes(0) && pageHits.mangadex.includes(100));

  pageHits.googlebooks = [];
  const gbMulti = await googleBooksProvider.search('MultiPageGB', { apiKey: 'test-key' });
  assert.equal(gbMulti.length, 80);
  assert.ok(pageHits.googlebooks.includes(0) && pageHits.googlebooks.includes(40));

  pageHits.comicvine = [];
  const cvMulti = await comicvineProvider.search('MultiPageCV', { apiKey: 'cv-key' });
  assert.equal(cvMulti.length, 130);
  assert.ok(pageHits.comicvine.includes(0) && pageHits.comicvine.includes(100));

  // Timeout / réseau → soft fallback stub
  globalThis.fetch = async () => {
    throw new Error('network down');
  };
  const offlineOl = await openLibraryProvider.search('Naruto');
  assert.ok(offlineOl.length >= 1);
  assert.ok(String(offlineOl[0].description).includes('Open Library indisponible'));
} finally {
  globalThis.fetch = originalFetch;
}

function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    async json() {
      return data;
    },
  };
}

console.log('verify-metadata: OK');
