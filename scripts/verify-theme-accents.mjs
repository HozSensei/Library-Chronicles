/**
 * Vérifie accents / thème (normalisation + grille setup).
 */
import {
  ACCENTS,
  ACCENT_IDS,
  DEFAULT_ACCENT,
  DEFAULT_THEME,
  accentFocusIds,
  accentLabel,
  normalizeAccent,
  normalizeTheme,
} from '../src/shared/theme-accents.js';
import { setupFocusRows, moveSetupFocus, setupFocusables } from '../src/shared/setup-focus.js';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else {
    console.log('OK  ', msg);
  }
}

assert(DEFAULT_THEME === 'dark', 'thème défaut sombre');
assert(DEFAULT_ACCENT === 'amber', 'accent défaut laiton');
assert(ACCENT_IDS.length >= 6, 'au moins 6 accents');
assert(
  ['blue', 'orange', 'green', 'amber', 'rose', 'violet'].every((id) =>
    ACCENT_IDS.includes(id),
  ),
  'accents attendus présents',
);
assert(normalizeAccent('violet') === 'violet', 'normalize violet');
assert(normalizeAccent('STEAM') === DEFAULT_ACCENT, 'inconnu → défaut');
assert(normalizeTheme('light') === 'light', 'normalize light');
assert(normalizeTheme('cyan') === 'dark', 'thème invalide → dark');
assert(accentLabel('rose') === 'Rose', 'label rose');
assert(
  ACCENTS.every((a) => /^#[0-9a-f]{6}$/i.test(a.swatch)),
  'swatches hex',
);
assert(
  !ACCENTS.some((a) => /#1a9fff|#66c0f4|#3d9be9/i.test(a.swatch)),
  'pas de cyan Steam Deck dans les swatches',
);

const prefs = setupFocusRows(1);
assert(prefs.length === 4, 'prefs : mode + accents + langue + next');
assert(prefs[0].join(',') === 'theme-dark,theme-light', 'mode côte à côte');
assert(prefs[1].join(',') === accentFocusIds().join(','), 'rangée accents');
let idx = moveSetupFocus(prefs, 0, 'down');
assert(setupFocusables(1)[idx] === 'accent-blue', '↓ mode → premier accent');
idx = moveSetupFocus(prefs, idx, 'right');
assert(setupFocusables(1)[idx] === 'accent-orange', '←→ accents');
idx = moveSetupFocus(prefs, idx, 'right');
assert(setupFocusables(1)[idx] === 'accent-green', '←→ vert');

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\ntheme-accents OK');
