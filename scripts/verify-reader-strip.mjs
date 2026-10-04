/**
 * Strip vertical optionnel : fenêtre ~4–5 pages + prefetch, ouvert via
 * readingMode=strip (fiche « Lire en continu »). Mode page reste le défaut.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STRIP_AHEAD,
  STRIP_BEHIND,
  STRIP_PREFETCH,
  stripPrefetchRange,
  stripWindowRange,
  stripWindowSize,
} from '../src/shared/reader-strip.js';
import {
  READING_MODE,
  normalizeReadingMode,
  supportsStripReading,
} from '../src/shared/reading-mode.js';
import {
  READER_STICK_SPEED,
  applyStickToStripScroll,
} from '../src/shared/reader-stick.js';
import { visualPanToLocal } from '../src/shared/portrait-remap.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Fenêtre : page 10 / 100 → indices 9..13 = 5 pages
assert.deepEqual(stripWindowRange(10, 100), { start: 9, end: 13 });
assert.equal(stripWindowSize(10, 100), STRIP_BEHIND + 1 + STRIP_AHEAD);
assert.equal(stripWindowSize(10, 100), 5);

// Début de livre : 4 pages (0..3)
assert.deepEqual(stripWindowRange(0, 100), { start: 0, end: 3 });
assert.equal(stripWindowSize(0, 100), 4);

// Fin de livre
assert.deepEqual(stripWindowRange(99, 100), { start: 98, end: 99 });

// Prefetch élargit hors fenêtre
assert.deepEqual(stripPrefetchRange(10, 100), {
  start: 9 - STRIP_PREFETCH,
  end: 13 + STRIP_PREFETCH,
});
assert.equal(STRIP_PREFETCH, 2);

assert.equal(normalizeReadingMode('strip'), READING_MODE.STRIP);
assert.equal(normalizeReadingMode('page'), READING_MODE.PAGE);
assert.equal(normalizeReadingMode(''), READING_MODE.PAGE);
assert.equal(supportsStripReading('cbz'), true);
assert.equal(supportsStripReading('CBR'), true);
assert.equal(supportsStripReading('pdf'), true);
assert.equal(supportsStripReading('zip'), true);
assert.equal(supportsStripReading('epub'), false);
assert.equal(supportsStripReading('txt'), false);
assert.equal(supportsStripReading(null), false);

const store = readFileSync(join(root, 'src/renderer/src/stores/reader.js'), 'utf8');
const view = readFileSync(join(root, 'src/renderer/src/views/ReaderView.vue'), 'utf8');
const book = readFileSync(
  join(root, 'src/renderer/src/views/BookDetailView.vue'),
  'utf8',
);
const gamepad = readFileSync(
  join(root, 'src/renderer/src/composables/useGamepad.js'),
  'utf8',
);
const i18n = readFileSync(join(root, 'src/shared/i18n.js'), 'utf8');
const keys = readFileSync(join(root, 'src/shared/key-bindings.js'), 'utf8');
const hud = readFileSync(
  join(root, 'src/renderer/src/components/ReaderHud.vue'),
  'utf8',
);

assert.match(store, /stripWindowRange/);
assert.match(store, /loadStripWindow/);
assert.match(store, /setPageFromStripScroll/);
assert.match(store, /stripScrollToken/);
assert.match(store, /readingMode/);
assert.match(store, /isStripMode/);
assert.doesNotMatch(store, /this\.webtoonMode/);
assert.doesNotMatch(store, /toggleWebtoon/);
assert.doesNotMatch(keys, /toggle-webtoon/);
assert.doesNotMatch(hud, /Mode webtoon/);
assert.doesNotMatch(gamepad, /toggle-webtoon/);
assert.doesNotMatch(gamepad, /webtoonMode/);

assert.match(view, /data-strip/);
assert.match(view, /reader__strip/);
assert.match(view, /setPageFromStripScroll/);
assert.match(view, /normalizeReadingMode/);
assert.match(view, /query\.mode/);

assert.match(book, /BOOK_FOCUS\.READ_STRIP/);
assert.match(book, /supportsStripReading/);
assert.match(book, /mode:\s*READING_MODE\.STRIP|mode = READING_MODE\.STRIP|query\.mode/);
assert.match(book, /readStrip/);
assert.match(i18n, /readStrip:/);
assert.match(i18n, /readStripUnsupported:/);
assert.match(i18n, /Lire en continu/);
assert.match(i18n, /Read continuously/);

assert.match(gamepad, /reader\.isStripMode/);
assert.match(gamepad, /reader__strip/);
assert.match(gamepad, /applyStickToStripScroll/);
assert.match(
  gamepad,
  /isStripMode[\s\S]*zoom-in[\s\S]*stepPage\('prev'\)/,
);
// Mode page : zoom / L3 / pan toujours présents (branche else dédiée).
assert.match(gamepad, /Mode page — contrôles identiques/);
assert.match(gamepad, /reader\.resetZoom\(\)/);
assert.match(gamepad, /reader\.zoomBy\(1\)/);
assert.match(gamepad, /reader\.pan\(stickLocal\.x,\s*stickLocal\.y\)/);
{
  const m = view.match(
    /const stripStyle = computed\(\(\) => \(\{([\s\S]*?)\}\)\)/,
  );
  assert.ok(m, 'stripStyle computed défini');
  assert.match(m[1], /filter:\s*reader\.filterCss/);
  assert.doesNotMatch(m[1], /panX|panY|translate3d/);
}
assert.match(store, /READER_STICK_SPEED/);
assert.match(
  store,
  /readingMode !== undefined && readingMode !== null/,
);

// Parité stick : même mapping local, vitesse égale X/Y, signe inverse translate.
assert.equal(READER_STICK_SPEED, 14);
{
  const localUp = visualPanToLocal(0, -1); // physique haut → local (+1, 0)
  assert.ok(Math.abs(localUp.x - 1) < 1e-9 && Math.abs(localUp.y) < 1e-9);
  const el = { scrollLeft: 100, scrollTop: 200 };
  applyStickToStripScroll(el, localUp.x, localUp.y);
  assert.equal(el.scrollLeft, 100 - READER_STICK_SPEED);
  assert.equal(el.scrollTop, 200);
}
{
  const localLeft = visualPanToLocal(-1, 0); // physique gauche → local (0, −1)
  assert.ok(Math.abs(localLeft.x) < 1e-9 && Math.abs(localLeft.y + 1) < 1e-9);
  const el = { scrollLeft: 50, scrollTop: 80 };
  applyStickToStripScroll(el, localLeft.x, localLeft.y);
  assert.equal(el.scrollLeft, 50);
  assert.equal(el.scrollTop, 80 - localLeft.y * READER_STICK_SPEED);
}

console.log('verify-reader-strip: ok');
