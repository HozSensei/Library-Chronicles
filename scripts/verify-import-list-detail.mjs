/**
 * Garde-fous UX Import liste → fiche détail + bindings Y/A.
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
  IMPORT_LIST_ACTIONS,
  clampDetailFieldFocus,
  importFieldDomId,
  normalizeImportFocusZone,
} from '../src/shared/import-focus.js';

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

const bindings = resolveKeyBindings(null);
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
  DEFAULT_KEY_BINDINGS.import[`button:${GamepadButtons.Y}`] === 'import-all',
  'défaut Y = import-all',
);

assert(IMPORT_DETAIL_FIELDS.SEARCH === 8, 'SEARCH index');
assert(IMPORT_DETAIL_ACTIONS.COMMIT === 0, 'COMMIT index');
assert(IMPORT_LIST_ACTIONS.BACK === 1, 'BACK liste');
assert(clampDetailFieldFocus(99) === IMPORT_DETAIL_FIELDS.MAX, 'clamp field');
assert(importFieldDomId(IMPORT_DETAIL_FIELDS.QUERY) === 'query', 'dom id query');
assert(normalizeImportFocusZone('results') === 'results', 'zone results');
assert(normalizeImportFocusZone('nope') === 'list', 'zone fallback');

assert(store.includes("viewMode: 'list'"), 'store viewMode');
assert(store.includes('searchQuery'), 'store searchQuery');
assert(store.includes('async openDetail'), 'store openDetail');
assert(store.includes('closeDetail'), 'store closeDetail');
assert(store.includes('window.vdr.metadata.search'), 'store search IPC');
assert(store.includes('commitAll'), 'store commitAll');
assert(store.includes('applyEnrichResult'), 'store apply résultat');

assert(view.includes('Détail / méta'), 'hint A détail');
assert(view.includes('Tout importer'), 'hint Y tout importer');
assert(view.includes('Importer ce tome'), 'CTA fiche');
assert(view.includes('Retour liste'), 'retour liste');
assert(view.includes('Mots-clés recherche'), 'champ query');
assert(view.includes('data-import-field="query"'), 'data-field query');
assert(view.includes('shell-scroll'), 'shell-scroll');
assert(!view.includes('import__pick'), 'plus de multi-select checkbox');
assert(!view.includes('Importer sélection'), 'plus Importer sélection');

assert(gamepad.includes('imp.openDetail'), 'gamepad A → openDetail');
assert(gamepad.includes("action === 'import-all'"), 'gamepad import-all');
assert(gamepad.includes('imp.commitAll'), 'gamepad Y → commitAll liste');
assert(gamepad.includes('imp.isDetail'), 'branche détail');
assert(gamepad.includes('imp.enrich()'), 'recherche API détail');
assert(gamepad.includes('applyEnrichCursor'), 'appliquer résultat');
assert(gamepad.includes('focusTextInputForEdit'), 'clavier virtuel champs');
assert(!gamepad.includes('footerMax = 4'), 'plus footer 5 boutons');

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nimport-list-detail OK');
