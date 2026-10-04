/**
 * Garde-fous chemin manette lecture — évite la régression « manette morte ».
 *
 * Cause historique : dans tick(), `reader.hudVisible` lisait une variable hors
 * scope (pas destructurée depuis handlers) → ReferenceError dès route=reader
 * avec pad connecté → requestAnimationFrame non replanifié → contrôles morts.
 *
 * Dual-path : PageReader (`reader-page-controls`) vs StripReader
 * (`reader-strip-controls`) — D-Pad zoom/page no-op en strip.
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
  applyPageReaderAction,
  isPageDpadAction,
} from '../src/shared/reader-page-controls.js';
import {
  applyStripReaderAction,
  isStripDpadNoop,
  isStripZoomNoop,
} from '../src/shared/reader-strip-controls.js';
import { applyStickToStripScroll } from '../src/shared/reader-stick.js';

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
const pageControls = readFileSync(
  join(root, 'src/shared/reader-page-controls.js'),
  'utf8',
);
const stripControls = readFileSync(
  join(root, 'src/shared/reader-strip-controls.js'),
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

// --- Dual-path modules branchés ------------------------------------------
assert(
  gamepad.includes('applyPageReaderAction') &&
    gamepad.includes('reader-page-controls'),
  'useGamepad importe applyPageReaderAction (chemin page)',
);
assert(
  gamepad.includes('applyStripReaderAction') &&
    gamepad.includes('reader-strip-controls'),
  'useGamepad importe applyStripReaderAction (chemin strip)',
);
assert(
  !gamepad.includes('applyStickToStripScroll'),
  'scroll strip délégué au module strip-controls (plus d’inline)',
);
assert(
  pageControls.includes('reader.zoomBy(1)') &&
    pageControls.includes('reader.resetZoom()') &&
    pageControls.includes('reader.pan('),
  'reader-page-controls : zoom + L3 + pan',
);
assert(
  pageControls.includes("action === 'page-prev'") &&
    pageControls.includes("stepPage('prev')"),
  'reader-page-controls : D-Pad ← → stepPage',
);
assert(
  stripControls.includes('isStripDpadNoop') &&
    stripControls.includes('applyStickToStripScroll'),
  'reader-strip-controls : D-Pad no-op + stick scroll',
);
assert(
  !/stepPage\('prev'\)/.test(stripControls) &&
    !/zoomBy\(/.test(stripControls),
  'strip-controls : aucun stepPage / zoomBy (D-Pad no-op)',
);

// Runtime : page zoom path
{
  const calls = [];
  const reader = {
    resetZoom: () => calls.push('reset'),
    setFitWidth: () => calls.push('fit'),
    zoomBy: (n) => calls.push(`zoom:${n}`),
    stepPage: (w) => calls.push(`page:${w}`),
    pan: (x, y) => calls.push(`pan:${x},${y}`),
  };
  // Débordement présent → le stick pan (pas de page tournée par accident).
  reader.stickIntent = () => 'pan';
  assert(isPageDpadAction('zoom-in'), 'zoom-in est action D-Pad page');
  assert(applyPageReaderAction(reader, 'zoom-in'), 'page zoom-in consommé');
  assert(applyPageReaderAction(reader, 'zoom-out'), 'page zoom-out consommé');
  assert(applyPageReaderAction(reader, 'reset-zoom'), 'page reset-zoom consommé');
  assert(applyPageReaderAction(reader, 'page-prev'), 'page page-prev consommé');
  assert(
    applyPageReaderAction(reader, 'pan', { x: 1, y: -1 }),
    'page stick pan consommé',
  );
  assert(
    calls.join('|') === 'zoom:1|zoom:-1|reset|page:prev|pan:1,-1',
    'page path : zoom±, reset, page, pan (ordre)',
  );
}

// Runtime : strip D-Pad no-op, stick scroll
{
  assert(isStripDpadNoop('zoom-in') && isStripDpadNoop('page-next'), 'strip D-Pad no-op');
  assert(isStripZoomNoop('reset-zoom') && isStripZoomNoop('fit-width'), 'strip zoom no-op');
  const el = { scrollLeft: 10, scrollTop: 20 };
  const reader = {
    resetZoom: () => {
      throw new Error('resetZoom ne doit pas être appelé en strip');
    },
    zoomBy: () => {
      throw new Error('zoomBy ne doit pas être appelé en strip');
    },
    stepPage: () => {
      throw new Error('stepPage ne doit pas être appelé en strip (D-Pad)');
    },
    pan: () => {
      throw new Error('pan ne doit pas être appelé en strip');
    },
  };
  assert(
    applyStripReaderAction(reader, 'zoom-in') === true,
    'strip zoom-in = no-op consommé',
  );
  assert(
    applyStripReaderAction(reader, 'page-prev') === true,
    'strip page-prev = no-op consommé',
  );
  assert(
    applyStripReaderAction(reader, 'reset-zoom') === true,
    'strip reset-zoom = no-op consommé',
  );
  assert(
    applyStripReaderAction(reader, 'pan', { x: 1, y: 0 }, el) === true,
    'strip stick scroll consommé',
  );
  assert(el.scrollLeft !== 10 || el.scrollTop !== 20, 'strip stick a scrollé');
  // Helper direct toujours disponible
  const el2 = { scrollLeft: 0, scrollTop: 0 };
  applyStickToStripScroll(el2, 0, 1);
  assert(el2.scrollTop < 0 || el2.scrollTop === -14, 'stick helper speed 14');
}

const store = readFileSync(
  join(root, 'src/renderer/src/stores/reader.js'),
  'utf8',
);
assert(store.includes('resetZoom()'), 'store expose resetZoom()');
assert(
  /resetZoom\(\)\s*\{[\s\S]*?applyView\(resetView\(\)\)/.test(store),
  'resetZoom → page entière centrée (zoom 1, offset 0)',
);
assert(
  /zoomBy\(steps\)\s*\{[\s\S]*?isStripMode[\s\S]*?return/.test(store),
  'zoomBy guard isStripMode (no-op strip)',
);
assert(
  /pan\(dx,\s*dy[\s\S]*?isStripMode[\s\S]*?return false/.test(store),
  'pan guard isStripMode (no-op strip)',
);
assert(
  store.includes('stickIntent(stickLocal)'),
  'store expose stickIntent (stick = pan ou none)',
);
{
  const m = store.match(
    /async stepPage\(which\)\s*\{([\s\S]*?)\n\s*async stepChapter/,
  );
  assert(
    m && !m[1].includes('resetTransform'),
    'store stepPage : zoom persisté (pas de resetTransform)',
  );
}

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
