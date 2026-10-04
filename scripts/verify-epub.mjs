/**
 * Smoke EPUB : archive minimale + pagination liseuse + thème encre/papier.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import {
  openEpub,
  parseContainerXml,
  parseOpf,
  resolveZipHref,
  rewriteEpubHtml,
} from '../src/main/extractors/epub.js';
import { detectFormat, openBook } from '../src/main/extractors/index.js';
import { SUPPORTED } from '../src/main/library/scanner.js';
import {
  READING_MODE,
  isEpubFormat,
  resolveReadingMode,
  supportsEpubReading,
  supportsPageReading,
  supportsStripReading,
} from '../src/shared/reading-mode.js';
import {
  EPUB_INK,
  EPUB_PAD_X,
  EPUB_PAPER_BG,
  buildEpubThemeCss,
  clampScreenIndex,
  computeScreenCount,
  remapScreenIndex,
  resolveEpubPageGeometry,
  resolveEpubPageStep,
  screenOffsetX,
  stickToEpubPageWhich,
} from '../src/shared/epub-pagination.js';
import {
  applyEpubReaderAction,
  applyEpubStickPage,
  isEpubZoomNoop,
  resetEpubStickPageClock,
} from '../src/shared/reader-epub-controls.js';

function tinyPng(r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.from([0, r, g, b]);
  const compressed = zlib.deflateSync(raw);

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i += 1) {
      c ^= buf[i];
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

assert.equal(resolveZipHref('OEBPS/', 'chap/c1.xhtml'), 'OEBPS/chap/c1.xhtml');
assert.equal(resolveZipHref('OEBPS/chap', '../images/a.png'), 'OEBPS/images/a.png');
assert.equal(resolveZipHref('OEBPS', 'https://x.test/a.png'), null);

const container = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
assert.equal(parseContainerXml(container).fullPath, 'OEBPS/content.opf');

const opf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Demo EPUB</dc:title>
    <dc:creator>VDR Tester</dc:creator>
    <meta name="cover" content="cover-img"/>
  </metadata>
  <manifest>
    <item id="cover-img" href="images/cover.png" media-type="image/png"/>
    <item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="styles/book.css" media-type="text/css"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="c1"/>
    <itemref idref="c2"/>
  </spine>
</package>`;
const parsed = parseOpf(opf, 'OEBPS');
assert.equal(parsed.title, 'Demo EPUB');
assert.equal(parsed.creator, 'VDR Tester');
assert.equal(parsed.spine.length, 2);
assert.equal(parsed.coverHref, 'OEBPS/images/cover.png');
assert.equal(parsed.spine[0].href, 'OEBPS/text/ch1.xhtml');

assert.equal(SUPPORTED.has('.epub'), true);
assert.equal(detectFormat('/lib/book.epub'), 'epub');
assert.equal(isEpubFormat('epub'), true);
assert.equal(supportsEpubReading('epub'), true);
assert.equal(supportsEpubReading('cbz'), false);
assert.equal(supportsPageReading('cbz'), true);
assert.equal(supportsPageReading('epub'), false);
assert.equal(supportsStripReading('epub'), false);
assert.equal(supportsStripReading('cbz'), true);
assert.equal(resolveReadingMode('epub', 'strip'), READING_MODE.EPUB);
assert.equal(resolveReadingMode('cbz', 'strip'), READING_MODE.STRIP);
assert.equal(isEpubZoomNoop('fit-width'), true);

// ——— Pagination pure ————————————————————————————————————————————————
assert.equal(computeScreenCount(3240, 1080), 3);
assert.equal(computeScreenCount(1080, 1080), 1);
assert.equal(computeScreenCount(0, 1080), 1);
// Sous-pixel / pad résiduel : ne pas inventer une page blanche.
assert.equal(computeScreenCount(1080 + 0.5, 1080), 1);
assert.equal(computeScreenCount(2160 + 12, 1080), 2);
assert.equal(clampScreenIndex(5, 3), 2);
assert.equal(clampScreenIndex(-1, 3), 0);
assert.equal(clampScreenIndex(99, 1), 0);
assert.equal(clampScreenIndex(2.9, 3), 2);
assert.equal(screenOffsetX(2, 1080), 2160);
assert.equal(remapScreenIndex(1, 4, 8), 2);
assert.equal(remapScreenIndex(0, 1, 5), 0);

// Colonne + gap = stride = largeur stage (viewport local pré-rotate).
{
  const geo = resolveEpubPageGeometry({
    pageWidth: 1080,
    pageHeight: 1920,
  });
  assert.equal(geo.pageWidth, 1080);
  assert.equal(geo.pageHeight, 1920);
  assert.equal(geo.padX, EPUB_PAD_X);
  assert.equal(geo.colW + geo.columnGap, geo.pageWidth, 'colonne+gap = stage');
  assert.equal(geo.stride, geo.pageWidth, 'stride = clientWidth local');
  assert.equal(geo.columnGap, 2 * geo.padX);
  // Portrait Ally local (plane 100vh×100vw avant +90°)
  const ally = resolveEpubPageGeometry({ pageWidth: 1080, pageHeight: 1920 });
  assert.equal(ally.stride, 1080);
  assert.notEqual(ally.pageWidth, ally.pageHeight);
  // Pas de confusion width/height : stride suit pageWidth, pas height.
  const swapped = resolveEpubPageGeometry({ pageWidth: 1920, pageHeight: 1080 });
  assert.equal(swapped.stride, 1920);
  assert.equal(swapped.colW + swapped.columnGap, 1920);
}

{
  const mid = resolveEpubPageStep({
    screenIndex: 1,
    screenCount: 3,
    which: 'next',
  });
  assert.deepEqual(mid, { type: 'screen', index: 2 });
  const end = resolveEpubPageStep({
    screenIndex: 2,
    screenCount: 3,
    which: 'next',
  });
  assert.deepEqual(end, { type: 'chapter', which: 'next', landOn: 'start' });
  const start = resolveEpubPageStep({
    screenIndex: 0,
    screenCount: 3,
    which: 'prev',
  });
  assert.deepEqual(start, { type: 'chapter', which: 'prev', landOn: 'end' });
  const rtl = resolveEpubPageStep({
    screenIndex: 0,
    screenCount: 2,
    which: 'next',
    rtl: true,
  });
  assert.equal(rtl.type, 'chapter');
  assert.equal(rtl.which, 'prev');
}

assert.equal(stickToEpubPageWhich(0.8, 0.1), 'next');
assert.equal(stickToEpubPageWhich(-0.8, 0.1), 'prev');
assert.equal(stickToEpubPageWhich(0.1, 0.9), 'next');
assert.equal(stickToEpubPageWhich(0.1, -0.9), 'prev');
assert.equal(stickToEpubPageWhich(0.1, 0.1), null);

{
  const css = buildEpubThemeCss({
    fontPct: 120,
    pageWidth: 1080,
    pageHeight: 1920,
  });
  const geo = resolveEpubPageGeometry({ pageWidth: 1080, pageHeight: 1920 });
  assert.match(css, new RegExp(`color:\\s*${EPUB_INK}`));
  assert.match(css, new RegExp(`background:\\s*${EPUB_PAPER_BG}`));
  assert.match(css, new RegExp(`column-width:\\s*${geo.colW}px`));
  assert.match(css, new RegExp(`column-gap:\\s*${geo.columnGap}px`));
  assert.match(css, /width:\s*auto/);
  assert.match(css, /font-size:\s*120%/);
  assert.doesNotMatch(css, /var\(--paper/);
  assert.doesNotMatch(css, /sepia|brightness\(|contrast\(/);
  // Invariant rendu : une fenêtre = exactement le viewport local.
  assert.equal(geo.colW + geo.columnGap, 1080);
}

{
  const calls = [];
  const reader = {
    resetFontSize: () => calls.push('reset'),
    adjustFontSize: (n) => calls.push(`font:${n}`),
    stepPage: (w) => calls.push(`page:${w}`),
  };
  resetEpubStickPageClock();
  assert.equal(applyEpubReaderAction(reader, 'fit-width'), true);
  assert.equal(applyEpubReaderAction(reader, 'reset-zoom'), true);
  assert.equal(applyEpubReaderAction(reader, 'zoom-in'), true);
  assert.equal(applyEpubReaderAction(reader, 'page-next'), true);
  assert.equal(
    applyEpubReaderAction(reader, 'pan', { x: 0, y: 1 }, null),
    true,
  );
  assert.ok(calls.includes('page:next'), 'stick page-tourne');
  // Deuxième stick immédiat = cooldown (consommé, pas de 2e step)
  const before = calls.filter((c) => c.startsWith('page:')).length;
  assert.equal(applyEpubStickPage(reader, 0, 1, Date.now()), true);
  assert.equal(
    calls.filter((c) => c.startsWith('page:')).length,
    before,
    'cooldown stick',
  );
  assert.deepEqual(
    calls.filter((c) => !c.startsWith('page:') || c === 'page:next').slice(0, 3),
    ['reset', 'font:1', 'page:next'],
  );
}

// Stage : pas de filter manga, pagination flag, géométrie locale
{
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const stage = fs.readFileSync(
    path.join(root, 'src/renderer/src/components/EpubReaderStage.vue'),
    'utf8',
  );
  assert.match(stage, /data-epub-paginated/);
  assert.match(stage, /buildEpubThemeCss|epub-pagination/);
  assert.match(stage, /resolveEpubPageGeometry/);
  assert.match(stage, /filter:\s*none/);
  assert.match(stage, /clientWidth/);
  assert.doesNotMatch(stage, /getBoundingClientRect/);
  assert.doesNotMatch(stage, /reader\.filterCss/);
  assert.doesNotMatch(stage, /color:\s*var\(--paper/);
}

async function buildFixture() {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', container);
  zip.file('OEBPS/content.opf', opf);
  zip.file('OEBPS/styles/book.css', 'body { color: #111; } p { margin: 0.5em 0; }');
  zip.file('OEBPS/images/cover.png', tinyPng(180, 40, 40));
  zip.file(
    'OEBPS/text/ch1.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapitre 1</title>
<link rel="stylesheet" type="text/css" href="../styles/book.css"/>
</head>
<body><h1>Chapitre 1</h1><p>Bonjour EPUB.</p>
<img src="../images/cover.png" alt="cover"/>
</body></html>`,
  );
  zip.file(
    'OEBPS/text/ch2.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapitre 2</title></head>
<body><h1>Chapitre 2</h1><p>Suite.</p></body></html>`,
  );
  return zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' });
}

const buf = await buildFixture();
const tmp = path.join(os.tmpdir(), `vdr-epub-${Date.now()}.epub`);
fs.writeFileSync(tmp, buf);

try {
  const book = await openEpub(tmp);
  assert.equal(book.format, 'epub');
  assert.equal(book.pageCount, 2);
  assert.equal(book.title, 'Demo EPUB');
  assert.equal(book.author, 'VDR Tester');
  assert.ok(book.chapters.length >= 2);

  const page0 = await book.getPage(0);
  assert.ok(page0.buffer?.length);
  assert.match(page0.mime, /text\/html/);
  const html = page0.buffer.toString('utf8');
  assert.match(html, /Chapitre 1/);
  assert.match(html, /data:image\/png;base64,/);
  assert.match(html, /data-vdr-epub-css|color:\s*#111/);

  const page1 = await book.getPage(1);
  assert.match(page1.buffer.toString('utf8'), /Chapitre 2/);

  const cover = await book.getCoverBuffer();
  assert.ok(cover.length > 20);
  assert.equal(cover[0], 0x89);

  await book.close();

  const viaIndex = await openBook(tmp);
  assert.equal(viaIndex.format, 'epub');
  assert.equal(viaIndex.pageCount, 2);
  await viaIndex.close();

  const zip2 = await JSZip.loadAsync(buf);
  const rewritten = await rewriteEpubHtml(
    '<img src="../images/cover.png"/>',
    'OEBPS/text',
    zip2,
    new Map(),
  );
  assert.match(rewritten, /data:image\/png;base64,/);
} finally {
  fs.unlinkSync(tmp);
}

console.log(
  'OK  EPUB extracteur + pagination viewport (colonne=stage) + thème encre/papier',
);
