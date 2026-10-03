/**
 * Bibliothèque vide — pas d’onglets / Continuer / Récents, CTA Import seul.
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
const view = readFileSync(
  join(root, 'src/renderer/src/views/LibraryView.vue'),
  'utf8',
);

assert(store.includes('isEmpty: (s) => !s.books.length'), 'getter isEmpty');
assert(store.includes('focusEmptyImport'), 'action focusEmptyImport');
assert(
  store.includes('if (!this.books.length) return;') ||
    /cycleCatalogTab[\s\S]*!this\.books\.length/.test(store),
  'cycleCatalogTab no-op si vide',
);
assert(
  /headerNav\(\)\s*\{[\s\S]*!this\.books\.length/.test(store),
  'headerNav sans onglets si bibliothèque vide',
);
assert(
  /enterBoardContent\(\)\s*\{[\s\S]*!this\.books\.length[\s\S]*focusEmptyImport/.test(
    store,
  ),
  'enterBoardContent → Import si vide',
);

assert(view.includes('catalog__empty--solo'), 'empty solo markup');
assert(view.includes('v-if="!library.isEmpty"'), 'nav onglets masquée si vide');
assert(
  view.includes('v-else-if="!library.isEmpty"'),
  'sections catalogue derrière !isEmpty',
);
assert(view.includes('goImport'), 'helper goImport');
assert(view.includes('catalog__header--empty'), 'header layout empty');
assert(
  /isEmpty[\s\S]*importer/.test(view) || view.includes("label: 'importer'"),
  'hints manette simplifiés si vide',
);

const emptySoloStart = view.indexOf('catalog__empty--solo');
const emptySoloEnd = view.indexOf('v-else-if="!library.isEmpty"');
assert(emptySoloStart >= 0 && emptySoloEnd > emptySoloStart, 'borne empty solo');
const emptySoloBlock = view.slice(emptySoloStart, emptySoloEnd);
assert(emptySoloBlock.includes('Importer'), 'CTA Importer dans empty solo');
assert(!emptySoloBlock.includes('continue-section'), 'empty solo sans section Continuer');
assert(!emptySoloBlock.includes('aria-label="Récents"'), 'empty solo sans rail Récents');

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nlibrary-empty OK');
