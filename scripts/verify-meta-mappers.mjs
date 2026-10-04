/**
 * Tests unitaires mappers NormalizedMeta (fixtures JSON réelles/minimales).
 * Focus couverture : https absolu, jamais http/relatif.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createNormalizedMeta,
  absoluteHttpsCoverUrl,
  ensureNormalizedMeta,
} from '../src/shared/normalized-meta.js';
import { normalizeRemoteCoverUrl } from '../src/shared/cover-url.js';
import {
  mapGoogleBooksItem,
  parseGoogleBookTitle,
  upgradeGoogleCover,
  mapAnilistItem,
  mapMangadexItem,
  mapOpenLibraryDoc,
  mapComicVineItem,
} from '../src/main/metadata/mappers/index.js';
import { metadataPatchFromEnrichResult } from '../src/shared/import-meta.js';
import {
  defaultMetaApplySelection,
  filterMetaPatchBySelection,
} from '../src/shared/meta-apply-fields.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(root, 'src/main/metadata/fixtures');

function loadFixture(name) {
  return JSON.parse(readFileSync(join(fixtures, name), 'utf8'));
}

function assertContract(meta, label) {
  assert.equal(typeof meta.title, 'string', `${label} title`);
  assert.ok(Array.isArray(meta.authors), `${label} authors[]`);
  assert.ok(
    meta.coverUrl === null || /^https:\/\//i.test(meta.coverUrl),
    `${label} coverUrl https|null`,
  );
  if (meta.coverUrl) {
    assert.ok(!/^http:\/\//i.test(meta.coverUrl), `${label} pas de http`);
    assert.ok(!meta.coverUrl.startsWith('//'), `${label} pas de //`);
  }
  assert.equal(typeof meta.provider, 'string', `${label} provider`);
  assert.equal(meta.source, meta.provider, `${label} source=provider`);
  assert.equal(meta.author, meta.authors[0] || null, `${label} author alias`);
  assert.equal(meta.description, meta.synopsis, `${label} description=synopsis`);
  assert.ok(meta.id.startsWith(`${meta.provider}:`), `${label} id prefix`);
  assert.ok(
    typeof meta.confidence === 'number' &&
      meta.confidence >= 0 &&
      meta.confidence <= 1,
    `${label} confidence`,
  );
}

// --- helpers contrat ---
{
  assert.equal(absoluteHttpsCoverUrl(null), null);
  assert.equal(absoluteHttpsCoverUrl('ftp://x'), null);
  assert.equal(
    absoluteHttpsCoverUrl('http://cdn.example/a.jpg'),
    'https://cdn.example/a.jpg',
  );
  assert.equal(
    absoluteHttpsCoverUrl('//cdn.example/a.jpg'),
    'https://cdn.example/a.jpg',
  );
  assert.equal(
    normalizeRemoteCoverUrl('//cdn.example/b.jpg'),
    'https://cdn.example/b.jpg',
  );

  const m = createNormalizedMeta({
    title: 'Test',
    authors: ['A', 'B'],
    coverUrl: 'http://cdn.example/c.jpg',
    provider: 'stub',
    providerId: '1',
    synopsis: 'Hello',
  });
  assertContract(m, 'create');
  assert.equal(m.coverUrl, 'https://cdn.example/c.jpg');
  assert.deepEqual(m.authors, ['A', 'B']);
  assert.equal(m.author, 'A');
}

// --- Google Books ---
{
  const raw = loadFixture('googlebooks-solo-leveling-vol9.json');
  const meta = mapGoogleBooksItem(raw);
  assertContract(meta, 'googlebooks');
  assert.equal(meta.provider, 'googlebooks');
  assert.equal(meta.providerId, 'o1wVEQAAQBAJ');
  assert.equal(meta.series, 'Solo Leveling');
  assert.equal(meta.volume, 9);
  assert.equal(meta.authors[0], 'Chugong');
  assert.ok(meta.coverUrl?.startsWith('https://'));
  assert.ok(/zoom=3/i.test(meta.coverUrl));
  assert.ok(!/edge=curl/i.test(meta.coverUrl));

  const noCover = mapGoogleBooksItem({
    id: 'nocover',
    volumeInfo: { title: 'Solo Leveling 04', authors: ['Chugong'] },
  });
  assert.equal(noCover.coverUrl, null);
  assert.equal(noCover.volume, 4);

  const p1 = parseGoogleBookTitle('Solo Leveling, Vol. 9 (comic)');
  assert.equal(p1.series, 'Solo Leveling');
  assert.equal(p1.volume, 9);
  const cover = upgradeGoogleCover(
    'http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api',
  );
  assert.ok(cover.startsWith('https://'));
  assert.ok(/zoom=3/i.test(cover));
  assert.ok(!/edge=curl/i.test(cover));
}

// --- AniList ---
{
  const raw = loadFixture('anilist-one-piece.json');
  const meta = mapAnilistItem(raw);
  assertContract(meta, 'anilist');
  assert.equal(meta.provider, 'anilist');
  assert.equal(meta.providerId, '101759');
  assert.equal(meta.title, 'One Piece');
  assert.equal(meta.volume, null, 'AniList volumes ≠ tome courant');
  assert.equal(meta.author, 'Eiichiro Oda');
  assert.equal(
    meta.coverUrl,
    'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-ulXRn0sWLBl0.jpg',
  );

  // cover protocol-relative → https
  const proto = mapAnilistItem({
    ...raw,
    id: 1,
    coverImage: { large: '//s4.anilist.co/file/cover.jpg' },
  });
  assert.equal(proto.coverUrl, 'https://s4.anilist.co/file/cover.jpg');
}

// --- MangaDex ---
{
  const raw = loadFixture('mangadex-solo-leveling.json');
  const meta = mapMangadexItem(raw);
  assertContract(meta, 'mangadex');
  assert.equal(meta.provider, 'mangadex');
  assert.ok(meta.coverUrl?.includes('uploads.mangadex.org'));
  assert.ok(meta.coverUrl?.endsWith('.512.jpg'));
  assert.equal(meta.authors[0], 'Chugong');
}

// --- Open Library ---
{
  const raw = loadFixture('openlibrary-akira.json');
  const meta = mapOpenLibraryDoc(raw);
  assertContract(meta, 'openlibrary');
  assert.equal(meta.provider, 'openlibrary');
  assert.equal(meta.title, 'Akira');
  assert.equal(meta.series, 'Akira');
  assert.equal(
    meta.coverUrl,
    'https://covers.openlibrary.org/b/id/8234151-L.jpg',
  );
  assert.equal(meta.author, 'Katsuhiro Otomo');
}

// --- ComicVine ---
{
  const raw = loadFixture('comicvine-batman-1.json');
  const meta = mapComicVineItem(raw);
  assertContract(meta, 'comicvine');
  assert.equal(meta.provider, 'comicvine');
  assert.equal(meta.volume, 1);
  assert.equal(meta.series, 'Batman');
  assert.ok(meta.coverUrl?.startsWith('https://'));
  assert.ok(meta.coverUrl?.includes('scale_medium'));
}

// --- apply pipeline : coverUrl contrat → patch modal ---
{
  const gb = mapGoogleBooksItem(loadFixture('googlebooks-solo-leveling-vol9.json'));
  const patch = filterMetaPatchBySelection(
    metadataPatchFromEnrichResult(gb, {
      title: 'file.cbz',
      series: 'ParentFolder',
      volume: 9,
      coverUrl: null,
    }),
    defaultMetaApplySelection(),
  );
  assert.ok(patch.coverUrl?.startsWith('https://'), 'apply patch cover https');
  assert.equal(patch.series, 'Solo Leveling');
  assert.equal(patch.source, 'googlebooks');

  const onlyCover = filterMetaPatchBySelection(patch, {
    ...defaultMetaApplySelection(),
    title: false,
    series: false,
    volume: false,
    author: false,
    year: false,
    synopsis: false,
    cover: true,
  });
  assert.ok(onlyCover.coverUrl, 'modal jaquette seule');
}

// --- ensureNormalizedMeta re-normalise ---
{
  const raw = {
    title: 'X',
    source: 'anilist',
    id: 'anilist:99',
    coverUrl: 'http://cdn.example/z.jpg',
    author: 'A',
    description: 'D',
  };
  const n = ensureNormalizedMeta(raw);
  assert.equal(n.coverUrl, 'https://cdn.example/z.jpg');
  assert.equal(n.provider, 'anilist');
  assert.equal(n.providerId, '99');
  assert.equal(n.synopsis, 'D');
}

console.log('meta-mappers OK');
