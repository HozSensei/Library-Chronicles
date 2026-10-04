/**
 * Garde-fous chemin manette lecture — évite la régression « manette morte ».
 *
 * Cause historique : dans tick(), `reader.hudVisible` lisait une variable hors
 * scope (pas destructurée depuis handlers) → ReferenceError dès route=reader
 * avec pad connecté → requestAnimationFrame non replanifié → contrôles morts.
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

const gamepad = readFileSync(
  join(root, 'src/renderer/src/composables/useGamepad.js'),
  'utf8',
);
const library = readFileSync(
  join(root, 'src/renderer/src/views/LibraryView.vue'),
  'utf8',
);
const lazyCover = readFileSync(
  join(root, 'src/renderer/src/components/LazyCover.vue'),
  'utf8',
);

// --- Scope tick / reader -------------------------------------------------
assert(
  /function tick\(\)[\s\S]*?const\s*\{\s*ui\s*,\s*reader\s*\}\s*=\s*handlers/.test(
    gamepad,
  ) ||
    /function tick\(\)[\s\S]*?const\s*\{\s*reader\s*,\s*ui\s*\}\s*=\s*handlers/.test(
      gamepad,
    ),
  'tick() destructure { ui, reader } depuis handlers',
);

const tickBody = gamepad.slice(gamepad.indexOf('function tick()'));
const beforeRaf = tickBody.slice(0, tickBody.indexOf('requestAnimationFrame(tick)'));
assert(
  beforeRaf.includes('try {') && beforeRaf.includes('catch'),
  'tick() try/catch pour ne pas tuer la boucle rAF',
);
assert(
  beforeRaf.includes('reader.hudVisible'),
  'tick() lit reader.hudVisible (modal pause stick)',
);
assert(
  gamepad.includes("route === 'reader'") && gamepad.includes('toggle-pause'),
  'dispatch reader gère toggle-pause (Select modal)',
);
assert(
  gamepad.includes('page-prev') &&
    gamepad.includes('page-next') &&
    gamepad.includes('zoom-in') &&
    gamepad.includes('close-book'),
  'dispatch reader expose pages / zoom / B',
);

// --- Bindings reader intacts ---------------------------------------------
const bindings = resolveKeyBindings(null);
assert(
  actionForBinding(bindings, 'reader', `button:${GamepadButtons.SELECT}`) ===
    'toggle-pause',
  'Select → toggle-pause',
);
assert(
  actionForBinding(bindings, 'reader', `button:${GamepadButtons.B}`) ===
    'close-book',
  'B → close-book',
);
assert(
  actionForBinding(bindings, 'reader', 'dpad:left') === 'page-prev',
  'D-Pad ← logique → page-prev',
);
assert(
  actionForBinding(bindings, 'reader', 'dpad:right') === 'page-next',
  'D-Pad → logique → page-next',
);
assert(
  actionForBinding(bindings, 'reader', 'dpad:up') === 'zoom-out',
  'D-Pad ↑ logique → zoom-out',
);
assert(
  actionForBinding(bindings, 'reader', 'dpad:down') === 'zoom-in',
  'D-Pad ↓ logique → zoom-in',
);
assert(
  actionForBinding(bindings, 'reader', 'stick:left') === 'pan',
  'stick:left → pan',
);
assert(
  DEFAULT_KEY_BINDINGS.reader[`button:${GamepadButtons.A}`] ===
    'toggle-direction',
  'A reader → toggle-direction',
);

// --- Covers grille / rails uniformes -------------------------------------
assert(
  /\.poster\s*\{[\s\S]*?width:\s*140px/.test(library),
  'poster largeur fixe 140px',
);
assert(
  /\.poster\s*\{[\s\S]*?max-width:\s*140px/.test(library),
  'poster max-width 140px (titre long ne gonfle pas)',
);
assert(
  /\.poster\s*\{[\s\S]*?min-width:\s*0/.test(library),
  'poster min-width 0 (flex min-content)',
);
assert(
  /\.poster__art\s*\{[\s\S]*?aspect-ratio:\s*2\s*\/\s*3/.test(library),
  'poster__art aspect-ratio 2/3',
);
assert(
  lazyCover.includes('object-fit: cover') &&
    lazyCover.includes('max-width: 100%') &&
    lazyCover.includes('overflow: hidden'),
  'LazyCover borné object-fit + overflow',
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll gamepad reader path + cover checks passed.');
