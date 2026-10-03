/**
 * Garde-fous UX Import : liste → fiche Infos/Recherche + bindings A/X/Y/B + pastilles.
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
  DEFAULT_KEY_BINDINGS.import[`button:${GamepadButtons.X}`] === 'import-one',
  'défaut X = import-one',
);
assert(
  DEFAULT_KEY_BINDINGS.import[`button:${GamepadButtons.Y}`] === 'import-all',
  'défaut Y = import-all',
);

assert(IMPORT_DETAIL_TABS.INFOS === 'infos', 'tab infos');
assert(IMPORT_DETAIL_TABS.SEARCH === 'search', 'tab search');
assert(IMPORT_INFOS_FIELDS.SYNOPSIS === 5, 'SYNOPSIS index');
assert(IMPORT_SEARCH_FIELDS.RUN === 2, 'RUN search index');
assert(IMPORT_DETAIL_FIELDS.SEARCH === 8, 'alias SEARCH index');
assert(IMPORT_DETAIL_ACTIONS.COMMIT === 0, 'COMMIT index');
assert(IMPORT_LIST_ACTIONS.BACK === 1, 'BACK liste');
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
    detailTab: 'infos',
    zone: 'actions',
    focusIndex: IMPORT_DETAIL_ACTIONS.COMMIT,
  }) === 'commit-one',
  'Infos A CTA Importer → commit-one',
);
assert(
  resolveImportConfirmAction({
    isDetail: true,
    detailTab: 'infos',
    zone: 'actions',
    focusIndex: IMPORT_DETAIL_ACTIONS.BACK,
  }) === 'close-detail',
  'Infos A CTA Retour → close-detail',
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
    focusIndex: IMPORT_SEARCH_FIELDS.RUN,
  }) === 'run-search',
  'Recherche A Lancer → run-search',
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
assert(
  resolveImportBackAction({
    isDetail: true,
    detailTab: 'search',
    zone: 'actions',
  }) === 'to-list',
  'Recherche B sur footer → liste',
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

assert(view.includes('ouvrir fiche'), 'hint A ouvrir fiche');
assert(view.includes('Importer ce tome'), 'hint X importer ce tome');
assert(view.includes('Tout importer'), 'hint Y tout importer');
assert(view.includes("key: 'X'"), 'hint key X');
assert(view.includes('import__dot'), 'pastille CSS');
assert(view.includes('import__dot--detected'), 'pastille bleu/détecté');
assert(view.includes('import__dot--empty'), 'pastille rouge/vide');
assert(view.includes('import__dot--selected'), 'pastille vert/sélection');
assert(view.includes('Retour liste'), 'retour liste');
assert(view.includes('Mots-clés'), 'champ query');
assert(view.includes('data-import-field="query"'), 'data-field query');
assert(view.includes('Source API'), 'select source API');
assert(view.includes('Lancer recherche'), 'bouton lancer recherche');
assert(view.includes('import__tabs'), 'onglets fiche');
assert(view.includes('Infos'), 'onglet Infos');
assert(view.includes('Recherche'), 'onglet Recherche');
assert(view.includes('shell-scroll'), 'shell-scroll');
assert(!view.includes('import__pick'), 'plus de multi-select checkbox');
assert(!view.includes('Importer sélection'), 'plus Importer sélection');

assert(gamepad.includes('imp.openDetail'), 'gamepad A → openDetail');
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
assert(gamepad.includes('focusTextInputForEdit'), 'clavier virtuel champs');
assert(!gamepad.includes('footerMax = 4'), 'plus footer 5 boutons');

assert(focusSrc.includes('resolveImportConfirmAction'), 'focus resolve A');
assert(focusSrc.includes('n’importe/ne ferme PAS'), 'doc bindings Infos');

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nimport-list-detail OK');
