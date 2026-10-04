/**
 * Garde-fous UX Import : liste → fiche Infos/Recherche + bindings A/X/Y/B/LB/RB + pastilles.
 * Pas de boutons footer (hints manette comme Bibliothèque).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_KEY_BINDINGS,
  actionForBinding,
  resolveKeyBindings,
} from '../src/shared/key-bindings.js';
import { GamepadButtons } from '../src/shared/gamepad-codes.js';
import {
  IMPORT_DETAIL_ACTIONS,
  IMPORT_DETAIL_FIELDS,
  IMPORT_DETAIL_TABS,
  IMPORT_INFOS_FIELDS,
  IMPORT_LIST_ACTIONS,
  IMPORT_SEARCH_FIELDS,
  clampInfosFieldFocus,
  clampSearchFieldFocus,
  importFieldDomId,
  normalizeImportDetailTab,
  normalizeImportFocusZone,
  resolveImportBackAction,
  resolveImportConfirmAction,
} from '../src/shared/import-focus.js';
import {
  META_SOURCE,
  computeMetaSource,
  hasDetectedMeta,
  metaSourceLabel,
  resolveItemMetadata,
} from '../src/shared/import-meta.js';

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

const view = readFileSync(
  join(root, 'src/renderer/src/views/ImportView.vue'),
  'utf8',
);
const store = readFileSync(
  join(root, 'src/renderer/src/stores/import.js'),
  'utf8',
);
const gamepad = readFileSync(
  join(root, 'src/renderer/src/composables/useGamepad.js'),
  'utf8',
);
const focusSrc = readFileSync(
  join(root, 'src/shared/import-focus.js'),
  'utf8',
);
const keys = readFileSync(
  join(root, 'src/shared/key-bindings.js'),
  'utf8',
);
const importMain = readFileSync(
  join(root, 'src/main/library/import.js'),
  'utf8',
);
const booksDb = readFileSync(
  join(root, 'src/main/database/books.js'),
  'utf8',
);

const bindings = resolveKeyBindings(null);
assert(
  actionForBinding(bindings, 'import', `button:${GamepadButtons.X}`) ===
    'import-one',
  'X → import-one',
);
assert(
  actionForBinding(bindings, 'import', `button:${GamepadButtons.Y}`) ===
    'import-all',
  'Y → import-all',
);
assert(
  actionForBinding(bindings, 'import', `button:${GamepadButtons.A}`) ===
    'confirm',
  'A → confirm',
);
assert(
  actionForBinding(bindings, 'import', `button:${GamepadButtons.B}`) ===
    'back',
  'B → back',
);
assert(
  actionForBinding(bindings, 'import', `button:${GamepadButtons.LB}`) ===
    'tab-prev',
  'LB → tab-prev (onglets méta)',
);
assert(
  actionForBinding(bindings, 'import', `button:${GamepadButtons.RB}`) ===
    'tab-next',
  'RB → tab-next (onglets méta)',
);
assert(
  DEFAULT_KEY_BINDINGS.import[`button:${GamepadButtons.X}`] === 'import-one',
  'défaut X = import-one',
);
assert(
  DEFAULT_KEY_BINDINGS.import[`button:${GamepadButtons.Y}`] === 'import-all',
  'défaut Y = import-all',
);
assert(
  DEFAULT_KEY_BINDINGS.import[`button:${GamepadButtons.LB}`] === 'tab-prev',
  'défaut LB = tab-prev',
);
assert(
  DEFAULT_KEY_BINDINGS.import[`button:${GamepadButtons.RB}`] === 'tab-next',
  'défaut RB = tab-next',
);

assert(IMPORT_DETAIL_TABS.INFOS === 'infos', 'tab infos');
assert(IMPORT_DETAIL_TABS.SEARCH === 'search', 'tab search');
assert(IMPORT_INFOS_FIELDS.SYNOPSIS === 5, 'SYNOPSIS index');
assert(IMPORT_SEARCH_FIELDS.QUERY === 0, 'QUERY index');
assert(IMPORT_SEARCH_FIELDS.PROVIDER === 1, 'PROVIDER index');
assert(IMPORT_SEARCH_FIELDS.MAX === 1, 'search fields sans bouton Lancer');
assert(IMPORT_DETAIL_FIELDS.SEARCH === 8, 'alias SEARCH index');
assert(IMPORT_DETAIL_ACTIONS.COMMIT === 0, 'COMMIT index (legacy)');
assert(IMPORT_LIST_ACTIONS.BACK === 1, 'BACK liste (legacy)');
assert(clampInfosFieldFocus(99) === IMPORT_INFOS_FIELDS.MAX, 'clamp infos');
assert(clampSearchFieldFocus(99) === IMPORT_SEARCH_FIELDS.MAX, 'clamp search');
assert(
  importFieldDomId(IMPORT_SEARCH_FIELDS.QUERY, 'search') === 'query',
  'dom id query',
);
assert(
  importFieldDomId(IMPORT_INFOS_FIELDS.TITLE, 'infos') === 'title',
  'dom id title',
);
assert(normalizeImportFocusZone('results') === 'results', 'zone results');
assert(normalizeImportFocusZone('actions') === 'list', 'zone actions → list');
assert(normalizeImportFocusZone('nope') === 'list', 'zone fallback');
assert(normalizeImportDetailTab('search') === 'search', 'tab normalize');
assert(normalizeImportDetailTab(null) === 'infos', 'tab fallback infos');

// Guards A — ne ferme / n’importe pas hors CTA
assert(
  resolveImportConfirmAction({ isDetail: false, zone: 'list' }) ===
    'open-detail',
  'liste A → open-detail',
);
assert(
  resolveImportConfirmAction({
    isDetail: true,
    detailTab: 'infos',
    zone: 'fields',
    focusIndex: 0,
  }) === 'edit-field',
  'Infos A champ → edit-field (pas close)',
);
assert(
  resolveImportConfirmAction({
    isDetail: true,
    detailTab: 'search',
    zone: 'results',
    focusIndex: 0,
    resultCount: 3,
  }) === 'apply-result',
  'Recherche A résultat → apply-result',
);
assert(
  resolveImportConfirmAction({
    isDetail: true,
    detailTab: 'search',
    zone: 'results',
    focusIndex: 0,
    resultCount: 0,
  }) === 'noop',
  'Recherche A sans résultat → noop',
);
assert(
  resolveImportConfirmAction({
    isDetail: true,
    detailTab: 'search',
    zone: 'fields',
    focusIndex: IMPORT_SEARCH_FIELDS.QUERY,
  }) === 'edit-query',
  'Recherche A query → edit-query',
);
assert(
  resolveImportConfirmAction({
    isDetail: true,
    detailTab: 'infos',
    zone: 'list',
    focusIndex: 0,
  }) === 'noop',
  'zone list en fiche → noop (pas close)',
);

// Guards B
assert(
  resolveImportBackAction({ isDetail: false }) === 'library',
  'liste B → library',
);
assert(
  resolveImportBackAction({
    isDetail: true,
    detailTab: 'search',
    zone: 'fields',
  }) === 'to-infos',
  'Recherche B champs → Infos',
);
assert(
  resolveImportBackAction({
    isDetail: true,
    detailTab: 'search',
    zone: 'results',
  }) === 'to-infos',
  'Recherche B résultats → Infos',
);
assert(
  resolveImportBackAction({
    isDetail: true,
    detailTab: 'infos',
    zone: 'fields',
  }) === 'to-list',
  'Infos B → liste',
);

// metaSource helpers
assert(META_SOURCE.SELECTED === 'selected', 'META_SOURCE.selected');
assert(META_SOURCE.DETECTED === 'detected', 'META_SOURCE.detected');
assert(META_SOURCE.EMPTY === 'empty', 'META_SOURCE.empty');
assert(!hasDetectedMeta(null), 'hasDetectedMeta null');
assert(!hasDetectedMeta({ title: 'foo' }), 'title seul ≠ détecté utile');
assert(hasDetectedMeta({ series: 'One Piece' }), 'series = détecté');
assert(hasDetectedMeta({ volume: 3 }), 'volume = détecté');
assert(
  computeMetaSource({ selectedMeta: { title: 'A' } }) === 'selected',
  'source selected',
);
assert(
  computeMetaSource({ detected: { series: 'OP', title: 'T1' } }) === 'detected',
  'source detected',
);
assert(
  computeMetaSource({ detected: { title: 'seul' } }) === 'empty',
  'source empty',
);
assert(
  resolveItemMetadata({
    name: 'file.cbz',
    selectedMeta: { title: 'API', series: 'S' },
    detected: { title: 'Det', series: 'D' },
  }).title === 'API',
  'resolve préfère selectedMeta',
);
assert(
  resolveItemMetadata({
    name: 'file.cbz',
    detected: { title: 'Det', series: 'D' },
  }).series === 'D',
  'resolve fallback detected',
);
assert(
  resolveItemMetadata(
    { name: 'file.cbz', selectedMeta: { title: 'API' } },
    { draft: { title: 'Draft' }, preferDraft: true },
  ).title === 'Draft',
  'resolve preferDraft',
);
assert(
  resolveItemMetadata({
    name: 'file.cbz',
    selectedMeta: {
      title: 'API',
      coverUrl: 'https://cdn.example/j.jpg',
      source: 'anilist',
    },
  }).coverUrl === 'https://cdn.example/j.jpg',
  'resolve propage coverUrl API',
);
assert(metaSourceLabel('selected').includes('API'), 'label selected');
assert(metaSourceLabel('empty').includes('Aucune'), 'label empty');

assert(store.includes("viewMode: 'list'"), 'store viewMode');
assert(store.includes("detailTab: 'infos'"), 'store detailTab');
assert(store.includes('setDetailTab'), 'store setDetailTab');
assert(store.includes('searchQuery'), 'store searchQuery');
assert(store.includes('async openDetail'), 'store openDetail');
assert(store.includes('closeDetail'), 'store closeDetail');
assert(store.includes('window.vdr.metadata.search'), 'store search IPC');
assert(store.includes('commitAll'), 'store commitAll');
assert(store.includes('commitSelected'), 'store commitSelected');
assert(store.includes('applyEnrichResult'), 'store apply résultat');
assert(store.includes('metaSource'), 'store metaSource');
assert(store.includes('selectedMeta'), 'store selectedMeta');
assert(store.includes('resolveItemMetadata'), 'store resolveItemMetadata');
assert(store.includes('META_SOURCE.SELECTED'), 'store flag selected');
assert(store.includes('previewCoverFromUrl'), 'store proxy jacket CSP');
assert(store.includes('resolveCoverPreview'), 'store resolveCoverPreview');
assert(store.includes('enrichCoverPreviews'), 'store jaquettes résultats');
assert(store.includes('loadEnrichCoverPreviews'), 'store charge jackets résultats');

assert(view.includes('ouvrir fiche'), 'hint A ouvrir fiche');
assert(view.includes('Importer ce tome'), 'hint X importer ce tome (liste)');
assert(view.includes('Importer le livre'), 'CTA / hint X fiche brouillon');
assert(view.includes('Tout importer'), 'hint Y tout importer');
assert(view.includes('Importer des méta'), 'CTA Importer des méta');
assert(view.includes("key: 'X'"), 'hint key X');
assert(view.includes("key: 'LB/RB'"), 'hint LB/RB onglets recherche');
assert(view.includes('import__dot'), 'pastille CSS');
assert(view.includes('import__dot--detected'), 'pastille bleu/détecté');
assert(view.includes('import__dot--empty'), 'pastille rouge/vide');
assert(view.includes('import__dot--selected'), 'pastille vert/sélection');
assert(view.includes('Mots-clés'), 'champ query');
assert(view.includes('data-import-field="query"'), 'data-field query');
assert(view.includes('Source API'), 'select source API');
assert(view.includes('@submit.prevent="doSearch"'), 'form submit recherche');
assert(view.includes('onSearchQueryKeydown'), 'keydown Enter recherche');
assert(view.includes('enterkeyhint="search"'), 'enterkeyhint search OSK');
assert(view.includes('import__tabs'), 'onglets recherche');
assert(view.includes('Recherche'), 'onglet Recherche');
assert(view.includes('import__sheet'), 'fiche brouillon style BookDetail');
assert(view.includes('import__sheet-hero'), 'hero cover + méta');
assert(view.includes('import__sheet-headline'), 'titre formulaire');
assert(view.includes('import__sheet-actions'), 'footer actions fiche');
assert(view.includes('openMetaSearch'), 'ouvrir recherche méta');
assert(view.includes('existingBookId'), 'route vers BookDetail si importé');
assert(view.includes("from: 'import'"), 'query from=import');
assert(view.includes('import__enrich-cover'), 'carte résultat jaquette');
assert(view.includes('import__enrich-title'), 'carte résultat titre');
assert(view.includes('import__enrich-series'), 'carte résultat série');
assert(view.includes('import__enrich-volume'), 'carte résultat tome');
assert(view.includes('enrichVolumeLabel'), 'libellé Tome N');
assert(view.includes('Série ·'), 'libellé série résultat');
assert(view.includes('shell-scroll'), 'shell-scroll');
assert(view.includes('import__done'), 'marqueur ✓ importé');
assert(view.includes('alreadyInLibrary'), 'flag alreadyInLibrary');
assert(!view.includes('import__pick'), 'plus de multi-select checkbox');
assert(!view.includes('Importer sélection'), 'plus Importer sélection');
assert(!view.includes('import__actions'), 'plus ancien footer import__actions');
assert(!view.includes('Rescanner'), 'plus bouton Rescanner');
assert(!view.includes('Lancer recherche'), 'plus bouton Lancer recherche');
assert(!view.includes('Retour biblio</span>'), 'plus bouton Retour biblio');
assert(!view.includes('conf.'), 'plus clutter confiance résultat');
assert(view.includes('ControlHint'), 'footer = ControlHint');

assert(gamepad.includes('imp.openDetail'), 'gamepad A → openDetail (brouillon)');
assert(
  gamepad.includes('existingBookId'),
  'gamepad A → BookDetail si déjà importé',
);
assert(gamepad.includes("from: 'import'"), 'gamepad query from=import');
assert(gamepad.includes("action === 'import-one'"), 'gamepad import-one');
assert(gamepad.includes("action === 'import-all'"), 'gamepad import-all');
assert(gamepad.includes('imp.commitSelected'), 'gamepad X → commitSelected');
assert(gamepad.includes('imp.commitAll'), 'gamepad Y → commitAll liste');
assert(gamepad.includes('imp.isDetail'), 'branche détail');
assert(gamepad.includes('imp.enrich()'), 'recherche API détail');
assert(gamepad.includes('applyEnrichCursor'), 'appliquer résultat');
assert(gamepad.includes('resolveImportConfirmAction'), 'guards confirm A');
assert(gamepad.includes('resolveImportBackAction'), 'guards back B');
assert(gamepad.includes('IMPORT_DETAIL_TABS'), 'onglets manette');
assert(gamepad.includes("action === 'tab-prev'"), 'LB/RB tab-prev handler');
assert(gamepad.includes('focusTextInputForEdit'), 'clavier virtuel champs');
assert(!gamepad.includes('footerMax = 4'), 'plus footer 5 boutons');
assert(!gamepad.includes('IMPORT_LIST_ACTIONS'), 'plus nav footer liste');
assert(!gamepad.includes('IMPORT_DETAIL_ACTIONS'), 'plus nav footer détail');

assert(focusSrc.includes('resolveImportConfirmAction'), 'focus resolve A');
assert(focusSrc.includes('jamais import'), 'doc bindings Infos');
assert(keys.includes("GamepadButtons.LB}`]: 'tab-prev'"), 'keys LB import');

assert(
  importMain.includes('findBookForImportSource'),
  'scan utilise findBookForImportSource',
);
assert(
  booksDb.includes('export function findBookForImportSource'),
  'DB findBookForImportSource',
);
assert(booksDb.includes('sourcePath'), 'match metadata.sourcePath');

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nimport-list-detail OK');
