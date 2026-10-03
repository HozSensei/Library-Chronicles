/**
 * Onglet catalogue « Tous les livres » — grille dense + cycle LB/RB.
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
const pad = readFileSync(
  join(root, 'src/renderer/src/composables/useGamepad.js'),
  'utf8',
);
const keys = readFileSync(join(root, 'src/shared/key-bindings.js'), 'utf8');

assert(store.includes("'all'"), 'catalogTab inclut all');
assert(
  /const tabs = \['board', 'all', 'recent', 'series'\]/.test(store),
  'cycleCatalogTab : board → all → recent → series',
);
assert(store.includes("tab === 'all'"), 'setCatalogTab gère all');
assert(store.includes("this.catalogTab === 'all'"), 'moveCatalog branche all');
assert(store.includes("focusZone = 'grid'"), 'focusZone grid');
assert(store.includes('focusGrid(index'), 'action focusGrid');
assert(store.includes('dy * cols'), 'nav grille par colonnes');

assert(view.includes("id: 'all'"), 'navItems onglet all');
assert(view.includes('Tous les livres'), 'label Tous les livres');
assert(view.includes("catalogTab === 'all'"), 'template branche all');
assert(view.includes('book-grid'), 'grille book-grid');
assert(view.includes('poster--grid'), 'posters grille');
assert(view.includes("focusZone === 'grid'"), 'focus visuel grille');
assert(view.includes('shell-scroll'), 'shell-scroll catalogue');
assert(view.includes('library.focusGrid(index)'), 'click → focusGrid');

assert(pad.includes('cycleCatalogTab'), 'LB/RB cycleCatalogTab');
assert(keys.includes('tab-prev') && keys.includes('tab-next'), 'bindings tab');
assert(
  keys.includes('Tous') || keys.includes('Bibliothèque / Tous'),
  'commentaire bindings mentionne Tous',
);

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nlibrary-all-tab OK');
