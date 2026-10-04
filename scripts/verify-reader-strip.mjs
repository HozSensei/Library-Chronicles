/**
 * Strip vertical optionnel : fenêtre ~4–5 pages + prefetch, ouvert via
 * readingMode=strip (fiche « Lire en continu »). Mode page reste le défaut.
 *
 * Dual-path : StripReaderStage + reader-strip-controls (D-Pad no-op).
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
  supportsEpubReading,
  supportsPageReading,
  supportsStripReading,
} from '../src/shared/reading-mode.js';
import {
  READER_STICK_SPEED,
  applyStickToStripScroll,
} from '../src/shared/reader-stick.js';
import {
  applyStripReaderAction,
  isStripDpadNoop,
} from '../src/shared/reader-strip-controls.js';
import { visualPanToLocal } from '../src/shared/portrait-remap.js';
import { PAGE_PAN_SPEED } from '../src/shared/page-view-transform.js';

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
assert.equal(supportsPageReading('cbz'), true);
assert.equal(supportsPageReading('epub'), false);
assert.equal(supportsEpubReading('epub'), true);
assert.equal(supportsEpubReading('pdf'), false);

const store = readFileSync(join(root, 'src/renderer/src/stores/reader.js'), 'utf8');
const view = readFileSync(join(root, 'src/renderer/src/views/ReaderView.vue'), 'utf8');
const pageStage = readFileSync(
  join(root, 'src/renderer/src/components/PageReaderStage.vue'),
  'utf8',
);
const stripStage = readFileSync(
  join(root, 'src/renderer/src/components/StripReaderStage.vue'),
  'utf8',
);
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
const stripControls = readFileSync(
  join(root, 'src/shared/reader-strip-controls.js'),
  'utf8',
);
const pageControls = readFileSync(
  join(root, 'src/shared/reader-page-controls.js'),
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
assert.match(view, /data-reader-path/);
assert.match(view, /StripReaderStage/);
assert.match(view, /PageReaderStage/);
assert.match(view, /EpubReaderStage/);
assert.match(view, /normalizeReadingMode/);
assert.match(view, /query\.mode/);
assert.match(view, /isEpubMode/);
assert.match(stripStage, /reader__strip/);
assert.match(stripStage, /setPageFromStripScroll/);
assert.match(stripStage, /data-reader-path="strip"/);
assert.match(pageStage, /reader__stage/);
assert.match(pageStage, /data-reader-path="page"/);
assert.match(pageStage, /reader__pan/);
assert.match(pageStage, /reader\.pageLayerStyle/);

const epubStage = readFileSync(
  join(root, 'src/renderer/src/components/EpubReaderStage.vue'),
  'utf8',
);
assert.match(epubStage, /data-reader-path="epub"/);
assert.match(epubStage, /reader__epub/);
assert.match(epubStage, /data-epub-paginated/);
assert.match(epubStage, /epubjs|epub-pagination|buildEpubJsThemeRules/);
assert.match(epubStage, /data-epub-engine|data-epub-paginated/);
assert.doesNotMatch(epubStage, /translateX\(|column-width/);
assert.doesNotMatch(epubStage, /reader\.filterCss/);
assert.match(store, /isEpubMode/);
assert.match(store, /adjustFontSize/);
assert.match(store, /epubScreenIndex|setEpubScreens/);
assert.match(store, /resolveReadingMode/);
assert.match(gamepad, /applyEpubReaderAction/);
assert.match(i18n, /hintEpub:/);
assert.match(i18n, /epubScreenOf:/);

assert.match(book, /BOOK_FOCUS\.READ_STRIP/);
assert.match(book, /BOOK_FOCUS\.READ_EPUB/);
assert.match(book, /supportsStripReading/);
assert.match(book, /supportsPageReading/);
assert.match(book, /supportsEpubReading/);
assert.match(book, /mode:\s*READING_MODE\.STRIP|mode = READING_MODE\.STRIP|query\.mode/);
assert.match(book, /readStrip/);
assert.match(book, /readEpub/);
assert.match(book, /readFormatIncompatible/);
assert.match(i18n, /readStrip:/);
assert.match(i18n, /readEpub:/);
assert.match(i18n, /readEpubSub:/);
assert.match(i18n, /readFormatIncompatible:/);
assert.match(i18n, /readStripUnsupported:/);
assert.match(i18n, /Lire en continu/);
assert.match(i18n, /Read continuously/);
assert.match(i18n, /Lire EPUB/);
assert.match(i18n, /Read EPUB/);
assert.match(i18n, /Texte · lecteur basique/);
assert.match(i18n, /Text · basic reader/);
assert.match(i18n, /Format non compatible/);
assert.match(i18n, /Format not compatible/);
assert.match(i18n, /hintStrip:/);
assert.match(i18n, /D-Pad désactivé|D-Pad off/);
assert.match(hud, /hintStrip/);

assert.match(gamepad, /reader\.isStripMode/);
assert.match(gamepad, /applyStripReaderAction/);
assert.match(gamepad, /applyPageReaderAction/);
assert.match(gamepad, /reader__strip/);
// Strip : D-Pad no-op (pas de stepPage sur zoom-in)
assert.match(stripControls, /isStripDpadNoop/);
assert.doesNotMatch(stripControls, /\.stepPage\(|zoomBy\(/);
assert.ok(isStripDpadNoop('zoom-in'));
assert.ok(isStripDpadNoop('page-next'));
assert.equal(applyStripReaderAction({}, 'zoom-out'), true);
// Mode page : zoom / L3 / pan dans module dédié
assert.match(pageControls, /zoomBy\(1\)/);
assert.match(pageControls, /resetZoom\(\)/);
assert.match(pageControls, /reader\.pan\(/);
// Parité de vitesse page / strip sans couplage de modules.
assert.equal(PAGE_PAN_SPEED, READER_STICK_SPEED);
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
