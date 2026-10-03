/**
 * Fiches série / tome — routes, store Récents dédup, navigation A.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else {
    console.log('OK  ', msg);
  }
}

const store = readFileSync(
  join(root, 'src/renderer/src/stores/library.js'),
  'utf8',
);
const router = readFileSync(
  join(root, 'src/renderer/src/router/index.js'),
  'utf8',
);
const view = readFileSync(
  join(root, 'src/renderer/src/views/LibraryView.vue'),
  'utf8',
);
const seriesView = readFileSync(
  join(root, 'src/renderer/src/views/SeriesDetailView.vue'),
  'utf8',
);
const pad = readFileSync(
  join(root, 'src/renderer/src/composables/useGamepad.js'),
  'utf8',
);
const shared = readFileSync(join(root, 'src/shared/series.js'), 'utf8');
const ux = readFileSync(join(root, 'docs/UX.md'), 'utf8');

assert(shared.includes('export function listRecentSeries'), 'listRecentSeries partagé');
assert(shared.includes('seriesCoverBookId'), 'cover premier tome');
assert(store.includes('listRecentSeries'), 'store importe listRecentSeries');
assert(store.includes('recentSeries'), 'getter recentSeries');
assert(store.includes('resolveRecentOpen'), 'resolveRecentOpen');
assert(store.includes('resolveSeriesOpen'), 'resolveSeriesOpen');
assert(store.includes('getSeriesById'), 'getSeriesById');

assert(router.includes("path: '/series/:seriesId'"), 'route /series/:seriesId');
assert(router.includes("name: 'series'"), 'name series');
assert(router.includes("path: '/book/:id'"), 'route /book/:id conservée');
assert(router.includes('SeriesDetailView'), 'SeriesDetailView branchée');

assert(view.includes('openSeries'), 'LibraryView openSeries');
assert(view.includes('openRecentEntry'), 'LibraryView openRecentEntry');
assert(view.includes('library.recentSeries'), 'template recentSeries');
assert(view.includes('openSeries(group.seriesId)'), 'onglet Séries → fiche série');
assert(!view.includes('nextUnreadForSelected().then'), 'plus d’ouverture directe nextUnread sur Séries');

assert(seriesView.includes('series-detail'), 'SeriesDetailView markup');
assert(seriesView.includes("name: 'book'"), 'série → fiche tome');
assert(seriesView.includes('volumes'), 'liste tomes');

assert(pad.includes("route === 'series'"), 'useGamepad route series');
assert(pad.includes('resolveSeriesOpen'), 'A séries → resolveSeriesOpen');
assert(pad.includes('resolveRecentOpen'), 'A récents → resolveRecentOpen');
assert(pad.includes("name: 'series'"), 'push fiche série');

assert(ux.includes('listRecentSeries') || ux.includes('une entrée par série'), 'docs UX récents');
assert(ux.includes('/series/:seriesId') || ux.includes('Fiche série'), 'docs UX fiche série');

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nseries-tome-fiches OK');
