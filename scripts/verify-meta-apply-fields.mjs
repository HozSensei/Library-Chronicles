import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  META_APPLY_FIELDS,
  META_APPLY_FIELD_IDS,
  META_APPLY_FOCUS,
  clampMetaApplyFocus,
  defaultMetaApplySelection,
  filterMetaPatchBySelection,
  hasMetaApplySelection,
} from '../src/shared/meta-apply-fields.js';
import { metadataPatchFromEnrichResult } from '../src/shared/import-meta.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL', msg); failed += 1; }
  else console.log('OK  ', msg);
}

assert(META_APPLY_FIELD_IDS.includes('title'), 'field title');
assert(META_APPLY_FIELD_IDS.includes('cover'), 'field cover');
assert(META_APPLY_FIELD_IDS.includes('series'), 'field series');
assert(META_APPLY_FIELD_IDS.includes('volume'), 'field volume');
assert(META_APPLY_FIELD_IDS.includes('synopsis'), 'field synopsis');
assert(META_APPLY_FIELDS.length === 7, '7 champs');
assert(META_APPLY_FOCUS.APPLY === 7, 'focus apply bouton');
const defaults = defaultMetaApplySelection();
assert(META_APPLY_FIELD_IDS.every((id) => defaults[id] === true), 'defaults tous cochés');
assert(hasMetaApplySelection(defaults), 'has selection defaults');
assert(!hasMetaApplySelection({ title: false, cover: false }), 'empty selection');

const full = metadataPatchFromEnrichResult(
  { title: 'API Title', series: 'API Series', author: 'Auteur', year: 2020, description: 'Synopsis', coverUrl: 'https://cdn.example/j.jpg', volume: 9, source: 'anilist' },
  { title: 'File', series: 'Folder', volume: 2 },
);
const onlySeries = filterMetaPatchBySelection(full, { ...defaultMetaApplySelection(), title: false, cover: false, series: true, volume: false, author: false, year: false, synopsis: false });
assert(onlySeries.series === 'API Series', 'filtre série');
assert(onlySeries.title === undefined, 'filtre sans titre');
assert(onlySeries.coverUrl === undefined, 'filtre sans cover');
const onlyCover = filterMetaPatchBySelection(full, { title: false, cover: true, series: false, volume: false, author: false, year: false, synopsis: false });
assert(onlyCover.coverUrl === 'https://cdn.example/j.jpg', 'filtre jaquette');
assert(onlyCover.source === 'anilist', 'source suit jaquette');

// Apply Google Books : coverUrl écrit quand « Jaquette » cochée
const gbFull = metadataPatchFromEnrichResult(
  {
    title: 'Solo Leveling, Vol. 9 (comic)',
    series: 'Solo Leveling',
    volume: 9,
    authors: ['Chugong'],
    synopsis: 'Jinwoo returns.',
    coverUrl:
      'https://books.google.com/books/content?id=o1wVEQAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api',
    provider: 'googlebooks',
    providerId: 'o1wVEQAAQBAJ',
    source: 'googlebooks',
  },
  { title: 'file', series: 'folder', volume: 9 },
);
assert(gbFull.author === 'Chugong', 'authors[0] → author dans patch');
assert(gbFull.description === 'Jinwoo returns.', 'synopsis → description');
assert(
  gbFull.coverUrl?.startsWith('https://'),
  'coverUrl https depuis contrat',
);
const gbCover = filterMetaPatchBySelection(gbFull, {
  ...defaultMetaApplySelection(),
  title: false,
  series: false,
  volume: false,
  author: false,
  year: false,
  synopsis: false,
  cover: true,
});
assert(
  gbCover.coverUrl?.includes('books.google.com'),
  'modal cover écrit coverUrl GB',
);
assert(gbCover.source === 'googlebooks', 'modal cover propage source');
assert(clampMetaApplyFocus(-1) === 0, 'clamp bas');
assert(clampMetaApplyFocus(99) === META_APPLY_FOCUS.MAX, 'clamp haut');

const store = readFileSync(join(root, 'src/renderer/src/stores/import.js'), 'utf8');
assert(store.includes('beginApplyEnrichResult'), 'store begin modal');
assert(store.includes('confirmApplyEnrich'), 'store confirm modal');
assert(store.includes('filterMetaPatchBySelection'), 'store filtre champs');
assert(store.includes('pendingApplyResult'), 'store pending');
assert(store.includes('applyFieldSelection'), 'store selection');
assert(store.includes('hydrateDraftFromSelected'), 'hydrate draft sans empty flash');
assert(store.includes('loadCoverForSelected'), 'cover reload idempotent');

const view = readFileSync(join(root, 'src/renderer/src/views/ImportView.vue'), 'utf8');
assert(view.includes('import__apply-modal'), 'modal DOM');
assert(view.includes('Appliquer les métadonnées'), 'titre modal');
assert(view.includes('confirmApplyModal'), 'handler confirm');
assert(view.includes('metaApplyFields'), 'liste champs');
assert(view.includes('draftReady'), 'fiche gated tant que draft non hydraté');

const gamepad = readFileSync(join(root, 'src/renderer/src/composables/useGamepad.js'), 'utf8');
assert(gamepad.includes('isApplyModalOpen'), 'gamepad modal branch');
assert(gamepad.includes('confirmApplyEnrich'), 'gamepad confirm apply');
assert(gamepad.includes('toggleApplyField'), 'gamepad toggle field');
assert(gamepad.includes('META_APPLY_FOCUS'), 'gamepad focus apply');

if (failed) { console.error(`\n${failed} échec(s)`); process.exit(1); }
console.log('\nmeta-apply-fields OK');
