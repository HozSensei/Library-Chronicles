/**
 * Vérifie l’ancrage zoom au centre du viewport (formule + câblage store/CSS).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  panForZoomToCenter,
  panForZoomToPoint,
} from '../src/shared/zoom-anchor.js';

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

function nearly(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

// --- Formule centre (focus 0,0) : newPan = oldPan * (to/from) ---
{
  const a = panForZoomToCenter(0, 0, 1, 1.15);
  assert(nearly(a.panX, 0) && nearly(a.panY, 0), 'pan=0 : reste 0 (centre fixe)');
}

{
  const a = panForZoomToCenter(100, -40, 1, 2);
  assert(nearly(a.panX, 200) && nearly(a.panY, -80), 'pan*(2/1) quand zoom ×2');
}

{
  const a = panForZoomToCenter(200, -80, 2, 1);
  assert(nearly(a.panX, 100) && nearly(a.panY, -40), 'dézoom restaure pan');
}

{
  const a = panForZoomToCenter(50, 50, 1, 1);
  assert(nearly(a.panX, 50) && nearly(a.panY, 50), 'même scale : pan inchangé');
}

// Point générique (focus ≠ centre)
{
  const a = panForZoomToPoint(10, 20, 1, 2, 100, 100);
  // new = focus - (focus - pan) * 2 = 100 - (100-10)*2 = 100 - 180 = -80
  assert(nearly(a.panX, -80) && nearly(a.panY, -60), 'zoom-to-point générique');
}

// Composition frame à frame ≡ ancre depuis départ
{
  let panX = 80;
  let panY = -30;
  let scale = 1;
  const target = 1.15;
  for (const s of [1.05, 1.1, 1.15]) {
    const next = panForZoomToCenter(panX, panY, scale, s);
    panX = next.panX;
    panY = next.panY;
    scale = s;
  }
  const direct = panForZoomToCenter(80, -30, 1, target);
  assert(
    nearly(panX, direct.panX) && nearly(panY, direct.panY),
    'composition incrémentale = ancre directe',
  );
}

// --- Câblage store / vue ---
const store = readFileSync(join(root, 'src/renderer/src/stores/reader.js'), 'utf8');
const view = readFileSync(join(root, 'src/renderer/src/views/ReaderView.vue'), 'utf8');

assert(store.includes('panForZoomToCenter'), 'store importe panForZoomToCenter');
assert(store.includes('applyScaleAtCenter'), 'store applyScaleAtCenter');
assert(
  /animateScaleTo[\s\S]*?panForZoomToCenter/.test(store),
  'animateScaleTo ancre via panForZoomToCenter',
);
assert(
  /zoomBy\(\s*steps\s*\)\s*\{[\s\S]*?animateScaleTo/.test(store) &&
    !/zoomBy\(\s*steps\s*\)\s*\{[\s\S]*?fitMode\s*=\s*['"]custom['"]/.test(store),
  'zoomBy ne bascule plus en fitMode custom (évite saut taille naturelle)',
);
assert(
  store.includes("transformOrigin: 'center center'") ||
    store.includes('transformOrigin: "center center"'),
  'imageStyle transformOrigin center center',
);
assert(
  view.includes('transform-origin: center center'),
  'CSS page transform-origin center center',
);
assert(
  /\.reader__stage\s*\{[\s\S]*?overflow:\s*hidden/.test(view),
  'stage overflow hidden (pas de scroll parasite)',
);
assert(
  /\.reader__stage\s*\{[\s\S]*?overscroll-behavior:\s*none/.test(view),
  'stage overscroll-behavior none',
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll zoom-anchor checks passed.');
