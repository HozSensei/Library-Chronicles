/**
 * Bibliothèque — focus nav header + section Continuer (plus de hero/watching).
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

assert(store.includes("focusZone: 'continue'"), 'focusZone défaut continue');
assert(store.includes("focusZone === 'nav'"), 'zone nav dans moveCatalog / selected');
assert(store.includes('focusNav('), 'action focusNav');
assert(store.includes('focusContinue('), 'action focusContinue');
assert(store.includes('enterCatalogContent'), '↓ depuis nav → contenu');
assert(store.includes('headerNav'), 'headerNav tabs + tools');
assert(store.includes('isContinueBook'), 'critère livres Continuer');
assert(!store.includes("focusZone: 'hero'"), 'plus de focusZone hero par défaut');
assert(!store.includes("focusZone = 'watching'"), 'plus de zone watching');
assert(!store.includes('focusHero'), 'plus de focusHero');
assert(!store.includes('heroSlides'), 'plus de heroSlides');

assert(view.includes('Continuer'), 'section Continuer label');
assert(view.includes('continue-section'), 'section Continuer markup');
assert(view.includes("focusZone === 'continue'"), 'focus visuel continue');
assert(view.includes('navFocused'), 'focus visuel header');
assert(view.includes("is-focused': navFocused"), 'classes focus nav/tools');
assert(view.includes('coverTags'), 'tags overlay Non lu / Nouveau');
assert(view.includes('poster__tag'), 'markup tag jaquette');
assert(view.includes('poster__tags'), 'container tags jaquette');
assert(view.includes('line-clamp'), 'titres line-clamp');
assert(view.includes('openRecentEntry'), 'clic Nouveautés → openRecentEntry');
assert(view.includes('openBook(book)'), 'clic rails → openBook');
assert(!view.includes('poster__meta'), 'plus de labels statut sous jaquette');
assert(!view.includes('catalog__hero-row'), 'plus de hero row');
assert(!view.includes('class="watching"'), 'plus de sidebar watching');
assert(!view.includes('focusHero'), 'vue sans focusHero');

assert(pad.includes("focusZone === 'nav'"), 'useGamepad gère confirm sur nav');
assert(pad.includes('selectedHeaderNav'), 'A sur header via selectedHeaderNav');
assert(pad.includes('clearProfileSelected'), 'profil depuis nav header');
assert(pad.includes('bookDetailLocation(target.bookId'), 'A récents → fiche livre');
assert(!pad.includes("name: 'book', params: { id: String(target.bookId) }"), 'plus de route book orpheline');

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nlibrary-nav-continue OK');
