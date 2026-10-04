/**
 * Vérifie navigation tome précédent / suivant en fin de lecture (série).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { findAdjacentVolume } from '../src/shared/series.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

const store = read('src/renderer/src/stores/reader.js');
const view = read('src/renderer/src/views/ReaderView.vue');
const hud = read('src/renderer/src/components/ReaderHud.vue');
const gamepad = read('src/renderer/src/composables/useGamepad.js');
const bindings = read('src/shared/key-bindings.js');

assert.match(store, /findAdjacentVolume/, 'store importe findAdjacentVolume');
assert.match(store, /prevVolumeOffer/, 'store prevVolumeOffer');
assert.match(store, /showEndSeriesNav/, 'getter showEndSeriesNav');
assert.match(store, /checkAdjacentVolumes/, 'checkAdjacentVolumes');
assert.match(store, /openPrevVolume/, 'openPrevVolume');
assert.match(store, /openAdjacentVolume/, 'openAdjacentVolume');
assert.match(
  store,
  /open\(offer\.filePath,\s*\{\s*resume:\s*false(?:,\s*readingMode:\s*mode)?\s*\}\)/,
  'ouverture adjacent sans reprise milieu',
);
assert.doesNotMatch(
  store,
  /library\.nextUnread/,
  'fin de tome n’utilise plus nextUnread',
);

assert.match(view, /showEndSeriesNav/, 'overlay fin si showEndSeriesNav');
assert.match(view, /data-end-focus/, 'boutons fin focusables manette');
assert.match(view, /Tome précédent|reader\.prevVolume|t\('reader\.prevVolume'\)/, 'libellé Tome précédent');
assert.match(view, /Tome suivant|reader\.nextVolume|t\('reader\.nextVolume'\)/, 'libellé Tome suivant');
assert.match(view, /endFocusId\('prev-volume'\)/, 'focus prev overlay');
assert.match(view, /endFocusId\('next-volume'\)/, 'focus next overlay');

assert.match(hud, /prevVolumeOffer/, 'HUD bouton précédent');
assert.match(hud, /t\('reader\.prevVolume'\)|Tome précédent/, 'HUD libellé précédent');
assert.match(hud, /openAdjacent\(-1\)/, 'HUD ouvre précédent');

assert.match(gamepad, /showEndSeriesNav/, 'gamepad gère overlay fin');
assert.match(gamepad, /moveEndFocus/, 'gamepad moveEndFocus');
assert.match(gamepad, /prev-volume/, 'action prev-volume');
assert.match(gamepad, /openPrevVolume/, 'gamepad openPrevVolume');

assert.match(bindings, /prev-volume/, 'binding prev-volume déclarée');
assert.match(
  bindings,
  /Tome suivant \(série\)/,
  'label next-volume = adjacent série',
);

const books = [
  { id: 1, seriesId: 'op', volume: 1, title: 'T1' },
  { id: 2, seriesId: 'op', volume: 2, title: 'T2' },
  { id: 3, seriesId: 'op', volume: 4, title: 'T4' },
];
assert.equal(
  findAdjacentVolume(books, { seriesId: 'op', volume: 2, bookId: 2, delta: 1 }),
  null,
  'pas de volume 3 → suivant masqué',
);
assert.equal(
  findAdjacentVolume(books, { seriesId: 'op', volume: 2, bookId: 2, delta: -1 })
    ?.id,
  1,
);
assert.equal(
  findAdjacentVolume(books, {
    seriesId: 'op',
    volume: null,
    bookId: 2,
    delta: 1,
  })?.id,
  3,
  'fallback index si volume absent',
);

console.log('verify-reader-adjacent-tome: OK');
