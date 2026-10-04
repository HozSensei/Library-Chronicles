/**
 * Probe Google Books (clé via env uniquement — jamais commitée).
 *
 * Usage :
 *   GOOGLE_BOOKS_API_KEY=xxx node scripts/probe-google-books.mjs
 *   GOOGLE_BOOKS_API_KEY=xxx node scripts/probe-google-books.mjs "Solo Leveling"
 */
import { googleBooksProvider } from '../src/main/metadata/providers/googlebooks.js';
import { metadataPatchFromEnrichResult } from '../src/shared/import-meta.js';
import {
  defaultMetaApplySelection,
  filterMetaPatchBySelection,
} from '../src/shared/meta-apply-fields.js';
import { normalizeRemoteCoverUrl } from '../src/shared/cover-url.js';
import { fetchBuffer } from '../src/main/metadata/fetch.js';
import { USER_AGENT } from '../src/main/metadata/types.js';

const apiKey = String(process.env.GOOGLE_BOOKS_API_KEY || '').trim();
const query = String(process.argv[2] || 'Solo Leveling').trim();

if (!apiKey) {
  console.error(
    'Missing GOOGLE_BOOKS_API_KEY. Export it for this shell only — do not commit.',
  );
  process.exit(1);
}

console.log(`Google Books probe · query=${JSON.stringify(query)}`);
const results = await googleBooksProvider.search(query, { apiKey });
console.log(`mapped results: ${results.length}`);

const top = results.slice(0, 8);
for (const r of top) {
  console.log(
    [
      `• ${r.title}`,
      `  series=${r.series || '—'} volume=${r.volume ?? '—'} author=${r.author || '—'}`,
      `  cover=${r.coverUrl ? r.coverUrl.slice(0, 96) + (r.coverUrl.length > 96 ? '…' : '') : '—'}`,
    ].join('\n'),
  );
}

const withCover = results.filter((r) => r.coverUrl);
const withSeries = results.filter((r) => r.series);
const withVol = results.filter((r) => r.volume != null);
console.log(
  `\nstats: cover=${withCover.length}/${results.length} series=${withSeries.length}/${results.length} volume=${withVol.length}/${results.length}`,
);

const sample = withCover[0] || results[0];
if (!sample) {
  console.log('No results.');
  process.exit(0);
}

const patch = filterMetaPatchBySelection(
  metadataPatchFromEnrichResult(sample, {
    title: 'file.cbz',
    series: 'ParentFolder',
    volume: sample.volume ?? 1,
  }),
  defaultMetaApplySelection(),
);
console.log('\napply patch (all fields):');
console.log(
  JSON.stringify(
    {
      title: patch.title,
      series: patch.series,
      volume: patch.volume,
      author: patch.author,
      year: patch.year,
      coverUrl: patch.coverUrl,
      source: patch.source,
    },
    null,
    2,
  ),
);

if (sample.coverUrl) {
  const url = normalizeRemoteCoverUrl(sample.coverUrl);
  const buf = await fetchBuffer(url, {
    timeoutMs: 12_000,
    headers: { 'User-Agent': USER_AGENT, Accept: 'image/*,*/*;q=0.8' },
  });
  const jpeg = buf?.[0] === 0xff && buf?.[1] === 0xd8;
  const png = buf?.[0] === 0x89 && buf?.[1] === 0x50;
  console.log(
    `\nensureCoverFromUrl path OK · bytes=${buf?.length || 0} jpeg=${jpeg} png=${png}`,
  );
}
