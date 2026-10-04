/**
 * Strip vertical défaut + mode page optionnel + zoom/stick restaurés.
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

const store = readFileSync(join(root, 'src/renderer/src/stores/reader.js'), 'utf8');
const view = readFileSync(join(root, 'src/renderer/src/views/ReaderView.vue'), 'utf8');
const hud = readFileSync(join(root, 'src/renderer/src/components/ReaderHud.vue'), 'utf8');
const keys = readFileSync(join(root, 'src/shared/key-bindings.js'), 'utf8');
const gamepad = readFileSync(
  join(root, 'src/renderer/src/composables/useGamepad.js'),
  'utf8',
);
const profiles = readFileSync(join(root, 'src/main/database/profiles.js'), 'utf8');

assert.match(store, /stripWindowRange/);
assert.match(store, /loadStripWindow/);
assert.match(store, /setPageFromStripScroll/);
assert.match(store, /stripScrollToken/);
assert.match(store, /readingMode/);
assert.match(store, /toggleReadingMode/);
assert.match(store, /isStripMode/);
assert.match(store, /zoomBy\(steps\)/);
assert.match(store, /ZOOM_STEP/);
assert.doesNotMatch(store, /toggleWebtoon/);
assert.doesNotMatch(keys, /toggle-webtoon/);
assert.doesNotMatch(hud, /Mode webtoon/);
assert.doesNotMatch(gamepad, /toggle-webtoon/);
assert.match(hud, /Page par page/);
assert.match(hud, /Strip vertical/);
assert.match(hud, /toggleReadingMode/);
assert.match(view, /data-strip/);
assert.match(view, /data-reading-mode/);
assert.match(view, /reader__strip/);
assert.match(view, /reader__stage/);
assert.match(view, /reader__page/);
assert.match(view, /setPageFromStripScroll/);
assert.match(gamepad, /reader__strip/);
assert.match(gamepad, /zoomBy\(1\)/);
assert.match(gamepad, /zoomBy\(-1\)/);
assert.match(gamepad, /isStripMode/);
assert.match(gamepad, /isZoomed/);
assert.match(profiles, /readingMode/);
assert.match(profiles, /readingModeFromRow|readingMode === 'page'/);

console.log('verify-reader-strip: ok');
