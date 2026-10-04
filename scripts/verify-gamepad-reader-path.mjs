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
  actionForBinding(bindings, 'reader', 'dpad:up') === 'zoom-in',
  'D-Pad ↑ logique → zoom-in',
);
assert(
  actionForBinding(bindings, 'reader', 'dpad:down') === 'zoom-out',
  'D-Pad ↓ logique → zoom-out',
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
assert(
  actionForBinding(bindings, 'reader', `button:${GamepadButtons.L3}`) ===
    'reset-zoom',
  'L3 → reset-zoom (page entière)',
);
assert(
  actionForBinding(bindings, 'reader', `button:${GamepadButtons.R3}`) ===
    'reset-zoom',
  'R3 → reset-zoom',
);
assert(
  DEFAULT_KEY_BINDINGS.reader[`button:${GamepadButtons.L3}`] === 'reset-zoom',
  'défaut L3 = reset-zoom (pas toggle fit)',
);

const migrated = resolveKeyBindings({
  reader: { [`button:${GamepadButtons.L3}`]: 'toggle-zoom' },
});
assert(
  actionForBinding(migrated, 'reader', `button:${GamepadButtons.L3}`) ===
    'reset-zoom',
  'remap legacy toggle-zoom → reset-zoom',
);

const gamepadSrc = gamepad;
assert(
  gamepadSrc.includes("action === 'reset-zoom'") &&
    gamepadSrc.includes('reader.resetZoom()'),
  'dispatch reader : reset-zoom → resetZoom()',
);
assert(
  !gamepadSrc.includes('reader.toggleZoom()'),
  'dispatch reader : plus d’appel toggleZoom()',
);
// Mode page : L3 / zoom / pan hors branche strip (pas de gate isStripMode sur l’appel).
{
  const pageBranch = gamepadSrc.slice(
    gamepadSrc.indexOf('// Mode page — contrôles identiques'),
  );
  assert(
    pageBranch.includes('reader.resetZoom()') &&
      !pageBranch.slice(0, pageBranch.indexOf('reader.resetZoom()')).includes(
        'isStripMode',
      ),
    'mode page : resetZoom() non conditionné par isStripMode',
  );
  assert(
    pageBranch.includes('reader.zoomBy(1)') &&
      pageBranch.includes('reader.zoomBy(-1)'),
    'mode page : D-Pad zoomBy ±1',
  );
  assert(
    pageBranch.includes('reader.pan(stickLocal.x, stickLocal.y)'),
    'mode page : stick → reader.pan (clamp bords)',
  );
}
assert(
  gamepadSrc.includes('applyStickToStripScroll') &&
    gamepadSrc.includes('visualPanToLocal'),
  'strip + page : même mapping visualPanToLocal ; strip scroll via helper',
);
assert(
  !/scrollTop\s*\+=\s*local\.y\s*\*\s*28/.test(gamepadSrc) &&
    !/scrollLeft\s*\+=\s*local\.x\s*\*\s*10/.test(gamepadSrc),
  'plus de scroll strip asymétrique y*28 / x*10',
);

const store = readFileSync(
  join(root, 'src/renderer/src/stores/reader.js'),
  'utf8',
);
assert(store.includes('resetZoom()'), 'store expose resetZoom()');
assert(
  /resetZoom\(\)\s*\{[\s\S]*?animateScaleTo\(1\)/.test(store),
  'resetZoom → scale 1 (fit stage)',
);
assert(
  /resetZoom\(\)\s*\{[\s\S]*?this\.panX\s*=\s*0[\s\S]*?this\.panY\s*=\s*0/.test(
    store,
  ),
  'resetZoom recentre le pan',
);
{
  const m = store.match(/resetZoom\(\)\s*\{([^}]*)\}/);
  assert(
    m && !/fitMode\s*=/.test(m[1]),
    'resetZoom ne bascule pas fitMode',
  );
}
assert(
  !/fitMode\s*=\s*this\.fitMode\s*===\s*'fit-width'\s*\?\s*'fit-height'/.test(
    store,
  ),
  'plus de toggle Fit Height ↔ Fit Width dans le store',
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
