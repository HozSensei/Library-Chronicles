/**
 * Probe réseau : coverUrl Solo Leveling / Tome 1 pour chaque provider gratuit.
 * Usage : node scripts/probe-solo-leveling-covers.mjs
 */
import { anilistProvider } from '../src/main/metadata/providers/anilist.js';
import { mangadexProvider } from '../src/main/metadata/providers/mangadex.js';
import { openLibraryProvider } from '../src/main/metadata/providers/openlibrary.js';
import { googleBooksProvider } from '../src/main/metadata/providers/googlebooks.js';
import { comicvineProvider } from '../src/main/metadata/providers/comicvine.js';
import { normalizeMetadataQuery } from '../src/main/metadata/types.js';
import { normalizeRemoteCoverUrl } from '../src/shared/cover-url.js';
import { fetchBuffer } from '../src/main/metadata/fetch.js';
import { USER_AGENT } from '../src/main/metadata/types.js';

const queries = ['Solo Leveling', 'Solo Leveling Tome 1'];
const providers = [
  ['anilist', (q) => anilistProvider.search(q)],
  ['mangadex', (q) => mangadexProvider.search(q)],
  ['openlibrary', (q) => openLibraryProvider.search(q)],
  ['googlebooks', (q) => googleBooksProvider.search(q, { apiKey: null })],
  ['comicvine', (q) => comicvineProvider.search(q, { apiKey: null })],
];

console.log('normalizeMetadataQuery("Solo Leveling Tome 1") =', 
  JSON.stringify(normalizeMetadataQuery('Solo Leveling Tome 1')));

for (const q of queries) {
  console.log(`\n======== Query: ${q} ========`);
  for (const [id, search] of providers) {
    const results = await search(q);
    const top = results.slice(0, 2).map((r) => ({
      title: r.title,
      source: r.source,
      coverUrl: r.coverUrl || null,
    }));
    const withCover = top.filter((r) => r.coverUrl);
    console.log(
      `${id.padEnd(12)} covers=${withCover.length}/${top.length}`,
      withCover[0]?.coverUrl
        ? `→ ${withCover[0].coverUrl.slice(0, 90)}…`
        : `(${top[0]?.source || 'none'})`,
    );
  }
}

// Retry path used by searchMetadata
const q = 'Solo Leveling Tome 1';
const normalized = normalizeMetadataQuery(q);
const alRaw = await anilistProvider.search(q);
const alNorm = await anilistProvider.search(normalized);
console.log('\n======== Retry path ========');
console.log('AniList raw « Tome 1 » source=', alRaw[0]?.source, 'cover=', !!alRaw[0]?.coverUrl);
console.log(
  'AniList normalized «',
  normalized,
  '» source=',
  alNorm[0]?.source,
  'cover=',
  alNorm[0]?.coverUrl || null,
);

if (alNorm[0]?.coverUrl) {
  const url = normalizeRemoteCoverUrl(alNorm[0].coverUrl);
  const buf = await fetchBuffer(url, {
    timeoutMs: 12_000,
    headers: { 'User-Agent': USER_AGENT, Accept: 'image/*,*/*;q=0.8' },
  });
  console.log('Download OK bytes=', buf.length, 'jpeg=', buf[0] === 0xff && buf[1] === 0xd8);
}
