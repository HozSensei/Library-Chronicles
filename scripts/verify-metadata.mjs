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
} from '../src/main/metadata/types.js';
import { stubProvider } from '../src/main/metadata/providers/stub.js';
import { comicvineProvider } from '../src/main/metadata/providers/comicvine.js';
import { openLibraryProvider } from '../src/main/metadata/providers/openlibrary.js';
import { anilistProvider } from '../src/main/metadata/providers/anilist.js';
import { mangadexProvider } from '../src/main/metadata/providers/mangadex.js';
import { googleBooksProvider } from '../src/main/metadata/providers/googlebooks.js';

// --- helpers ---
assert.equal(parseVolume('03'), 3);
assert.equal(parseVolume('Vol. 12'), 12);
assert.equal(parseVolume(null), null);
assert.equal(extractYear('2019-05-01'), 2019);
assert.equal(extractYear(1998), 1998);
assert.equal(slug('One Piece!!'), 'one-piece');
assert.equal(stripHtml('<p>Hello <b>world</b></p>'), 'Hello world');

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

globalThis.fetch = async (url, opts = {}) => {
  const href = String(url);

  if (href.includes('openlibrary.org/search.json')) {
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
    });
  }

  if (href.includes('graphql.anilist.co')) {
    return jsonResponse({
      data: {
        Page: {
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
    });
  }

  if (href.includes('googleapis.com/books')) {
    return jsonResponse({
      items: [
        {
          id: 'gb1',
          volumeInfo: {
            title: 'Watchmen',
            authors: ['Alan Moore'],
            publishedDate: '1987',
            description: 'Heroes.',
            imageLinks: { thumbnail: 'https://example.com/w.jpg' },
          },
        },
      ],
    });
  }

  if (href.includes('comicvine.gamespot.com')) {
    return jsonResponse({
      results: [
        {
          id: 42,
          name: 'Batman',
          start_year: '1939',
          deck: 'The Dark Knight',
          image: { thumb_url: 'https://example.com/b.jpg' },
        },
      ],
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

  const al = await anilistProvider.search('One Piece');
  assert.equal(al.length, 1);
  assert.equal(al[0].source, 'anilist');
  assert.equal(al[0].title, 'One Piece');
  assert.equal(al[0].author, 'Eiichiro Oda');
  assert.equal(al[0].year, 1997);

  const md = await mangadexProvider.search('Fullmetal');
  assert.equal(md.length, 1);
  assert.equal(md[0].source, 'mangadex');
  assert.equal(md[0].title, 'Fullmetal Alchemist');
  assert.equal(md[0].author, 'Hiromu Arakawa');
  assert.ok(md[0].coverUrl.includes('uploads.mangadex.org'));

  const gb = await googleBooksProvider.search('Watchmen', { apiKey: 'test-key' });
  assert.equal(gb.length, 1);
  assert.equal(gb[0].source, 'googlebooks');
  assert.equal(gb[0].title, 'Watchmen');
  assert.equal(gb[0].author, 'Alan Moore');

  const cv = await comicvineProvider.search('Batman', { apiKey: 'cv-key' });
  assert.equal(cv.length, 1);
  assert.equal(cv[0].source, 'comicvine');
  assert.equal(cv[0].title, 'Batman');
  assert.equal(cv[0].year, 1939);

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
