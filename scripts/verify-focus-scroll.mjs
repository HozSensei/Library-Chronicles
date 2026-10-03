/**
 * Vérifie l’API focus-scroll (scrollIntoView nearest pour manette).
 */
import {
  focusRootForRoute,
  scrollFocusedIntoView,
  scheduleScrollFocusedIntoView,
} from '../src/shared/focus-scroll.js';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else {
    console.log('OK  ', msg);
  }
}

assert(focusRootForRoute('library') === '.catalog', 'root library');
assert(focusRootForRoute('book') === '.book-detail', 'root book');
assert(focusRootForRoute('setup') === '.setup', 'root setup');
assert(focusRootForRoute('profiles') === '.profiles', 'root profiles');
assert(focusRootForRoute('import') === '.import', 'root import');
assert(focusRootForRoute('settings') === '.settings', 'root settings');
assert(focusRootForRoute('boot') === '.boot', 'root boot');
assert(focusRootForRoute('reader') === '.reader', 'root reader');
assert(focusRootForRoute('unknown') === '', 'root inconnu');

// Hors DOM (node) : no-op sûr
assert(scrollFocusedIntoView('.catalog') === false, 'scroll sans document → false');
assert(typeof scheduleScrollFocusedIntoView === 'function', 'schedule exporté');

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nfocus-scroll OK');
