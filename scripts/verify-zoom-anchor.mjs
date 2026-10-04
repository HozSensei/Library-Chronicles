/**
 * Vérifie l’ancrage zoom au centre écran (pipeline rotate + fit + scale + pan).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clampPanToPage,
  measureReaderZoomGeometry,
  panForZoomToCenter,
  panForZoomToPoint,
  panForZoomToScreenCenter,
  panLimitsForPage,
  pinReaderOverflow,
  screenToStageLocal,
  stageLocalToScreen,
  stagePointToImageLocal,
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

function nearlyPair(p, x, y, eps = 1e-6) {
  return nearly(p.panX, x, eps) && nearly(p.panY, y, eps);
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

// --- Rotate +90° : screen ↔ stage local ---
{
  // Fenêtre landscape 1920×1080 → plan local 1080×1920, centre fenêtre
  const geom = {
    stageW: 1080,
    stageH: 1920,
    rotate90: true,
    winCX: 960,
    winCY: 540,
  };
  const mid = screenToStageLocal(960, 540, geom);
  assert(
    nearly(mid.x, 540) && nearly(mid.y, 960),
    'rotate+90 : centre écran → centre stage local',
  );

  const back = stageLocalToScreen(mid.x, mid.y, geom);
  assert(
    nearly(back.x, 960) && nearly(back.y, 540),
    'rotate+90 : round-trip centre',
  );

  // Point local à droite du centre (local +X) → bas écran (screen +Y)
  const right = stageLocalToScreen(540 + 100, 960, geom);
  assert(
    nearly(right.x, 960) && nearly(right.y, 540 + 100),
    'rotate+90 : local+X → screen+Y (vertical écran)',
  );

  // Point local bas (local +Y) → gauche écran (screen −X)
  const down = stageLocalToScreen(540, 960 + 100, geom);
  assert(
    nearly(down.x, 960 - 100) && nearly(down.y, 540),
    'rotate+90 : local+Y → screen−X',
  );
}

// --- Cas critique : image NON centrée (overflow fit) sous rotate+90 ---
// Stage 1080×1920, page plus large (overflow local X = vertical écran).
// Sans correction focus, v1 (pan×ratio) laisserait dériver le point sous le centre.
{
  const stageW = 1080;
  const stageH = 1920;
  const imgW = 1400;
  const imgH = 1920;
  // Alignement « start » (safe) : offset X = 0 au lieu de (1080-1400)/2 = -160
  const geom = {
    stageW,
    stageH,
    imgW,
    imgH,
    imgOffsetX: 0,
    imgOffsetY: 0,
    rotate90: true,
    winCX: 960,
    winCY: 540,
  };

  const fromScale = 1;
  const toScale = 2;
  const panX = 0;
  const panY = 0;

  const v2 = panForZoomToScreenCenter(panX, panY, fromScale, toScale, geom);
  const v1 = panForZoomToCenter(panX, panY, fromScale, toScale);

  // focusX = stageW/2 - (0 + imgW/2) = 540 - 700 = -160
  // focusY = stageH/2 - (0 + imgH/2) = 960 - 960 = 0
  // pan2.x = -160 - (-160 - 0)*2 = 160 ; pan2.y = 0
  assert(
    nearly(v2.panX, 160) && nearly(v2.panY, 0),
    'rotate+90 + overflow local-X : panX corrige le focus (axe → vertical écran)',
  );
  assert(nearly(v1.panX, 0) && nearly(v1.panY, 0), 'v1 pan×ratio reste 0 (faux si non centré)');
  assert(
    !nearly(v2.panX, v1.panX) || !nearly(v2.panY, v1.panY),
    'v2 ≠ v1 quand imgOffset ≠ centre (explique le ressenti vertical)',
  );

  // Vérifie que le point image sous le centre écran reste fixe.
  const focusStage = screenToStageLocal(geom.winCX, geom.winCY, geom);
  const pBefore = stagePointToImageLocal(
    focusStage.x,
    focusStage.y,
    panX,
    panY,
    fromScale,
    geom.imgOffsetX,
    geom.imgOffsetY,
    imgW,
    imgH,
  );
  const pAfter = stagePointToImageLocal(
    focusStage.x,
    focusStage.y,
    v2.panX,
    v2.panY,
    toScale,
    geom.imgOffsetX,
    geom.imgOffsetY,
    imgW,
    imgH,
  );
  assert(
    nearly(pBefore.x, pAfter.x) && nearly(pBefore.y, pAfter.y),
    'point image sous centre écran invariant après zoom (overflow +90°)',
  );
}

// Image vraiment centrée + rotate → v2 ≡ v1
{
  const stageW = 1080;
  const stageH = 1920;
  const imgW = 900;
  const imgH = 1600;
  const geom = {
    stageW,
    stageH,
    imgW,
    imgH,
    imgOffsetX: (stageW - imgW) / 2,
    imgOffsetY: (stageH - imgH) / 2,
    rotate90: true,
    winCX: 960,
    winCY: 540,
  };
  const v2 = panForZoomToScreenCenter(40, -20, 1, 1.5, geom);
  const v1 = panForZoomToCenter(40, -20, 1, 1.5);
  assert(
    nearlyPair(v2, v1.panX, v1.panY),
    'image centrée + rotate : v2 ≡ pan×ratio',
  );
}

// Fit-width overflow vertical local (hauteur page >> stage) + rotate
{
  const stageW = 1080;
  const stageH = 1920;
  const imgW = 1080;
  const imgH = 3000;
  // Centré unsafe
  const geom = {
    stageW,
    stageH,
    imgW,
    imgH,
    imgOffsetX: 0,
    imgOffsetY: (stageH - imgH) / 2, // -540
    rotate90: true,
    winCX: 960,
    winCY: 540,
  };
  const v2 = panForZoomToScreenCenter(0, 100, 1, 2, geom);
  // focus = (0,0) car centrée → pan*2
  assert(
    nearly(v2.panX, 0) && nearly(v2.panY, 200),
    'fit-width overflow centré : panY×ratio (axe local Y)',
  );
}

// --- measureReaderZoomGeometry / pinReaderOverflow (mock DOM) ---
{
  const page = {
    offsetWidth: 900,
    offsetHeight: 1600,
    offsetLeft: 90,
    offsetTop: 160,
    offsetParent: null,
  };
  const pan = {
    offsetLeft: 90,
    offsetTop: 160,
    offsetParent: null,
  };
  const stage = {
    clientWidth: 1080,
    clientHeight: 1920,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 1920,
      height: 1080,
    }),
  };
  pan.offsetParent = stage;
  page.offsetParent = pan;
  const reader = {
    getAttribute: (n) => (n === 'data-css-rotate' ? '1' : null),
  };
  const scrollables = [
    { scrollTop: 12, scrollLeft: 3 },
    { scrollTop: 0, scrollLeft: 0 },
  ];
  const fakeDoc = {
    querySelector(sel) {
      if (sel === '.reader') return reader;
      if (sel === '.reader__stage') return stage;
      if (sel === '.reader__pan') return pan;
      if (sel === '.reader__page') return page;
      return null;
    },
    querySelectorAll(sel) {
      if (sel.includes('reader')) return scrollables;
      return [];
    },
  };

  const geom = measureReaderZoomGeometry(fakeDoc);
  assert(geom?.rotate90 === true, 'measure : rotate90 depuis data-css-rotate');
  assert(
    geom?.imgOffsetX === 90 && geom?.imgOffsetY === 160,
    'measure : offset depuis .reader__pan (pas la page)',
  );
  assert(
    nearly(geom.winCX, 960) && nearly(geom.winCY, 540),
    'measure : centre AABB stage = centre écran',
  );

  pinReaderOverflow(fakeDoc);
  assert(
    scrollables[0].scrollTop === 0 && scrollables[0].scrollLeft === 0,
    'pinReaderOverflow remet scroll à 0',
  );
}

// --- Clamp pan aux bords de page ---
{
  // Page centrée 800×1200 dans stage 1080×1920, scale 1 → undersized → pan=0
  const geom = {
    stageW: 1080,
    stageH: 1920,
    imgW: 800,
    imgH: 1200,
    imgOffsetX: (1080 - 800) / 2,
    imgOffsetY: (1920 - 1200) / 2,
  };
  const limits = panLimitsForPage(1, geom);
  assert(
    nearly(limits.minX, 0) &&
      nearly(limits.maxX, 0) &&
      nearly(limits.minY, 0) &&
      nearly(limits.maxY, 0),
    'scale 1 undersized : pan verrouillé à 0',
  );
  const c = clampPanToPage(40, -30, 1, geom);
  assert(nearly(c.panX, 0) && nearly(c.panY, 0), 'clamp ramène pan hors limites → 0');
}

{
  // Zoom ×2 : scaled 1600×2400 > stage → cover limits
  const geom = {
    stageW: 1080,
    stageH: 1920,
    imgW: 800,
    imgH: 1200,
    imgOffsetX: (1080 - 800) / 2,
    imgOffsetY: (1920 - 1200) / 2,
  };
  const s = 2;
  const limits = panLimitsForPage(s, geom);
  // maxX = (scaledW - stageW) / 2 = (1600-1080)/2 = 260
  assert(nearly(limits.maxX, 260) && nearly(limits.minX, -260), 'zoom×2 : ±260 en X');
  // maxY = (2400-1920)/2 = 240
  assert(nearly(limits.maxY, 240) && nearly(limits.minY, -240), 'zoom×2 : ±240 en Y');
  const over = clampPanToPage(999, -999, s, geom);
  assert(
    nearly(over.panX, 260) && nearly(over.panY, -240),
    'clamp coupe le pan hors page',
  );
  const ok = clampPanToPage(100, -50, s, geom);
  assert(nearly(ok.panX, 100) && nearly(ok.panY, -50), 'pan interne inchangé');
}

{
  // Fit-width-like : largeur = stage, hauteur plus petite
  const geom = {
    stageW: 1080,
    stageH: 1920,
    imgW: 1080,
    imgH: 600,
    imgOffsetX: 0,
    imgOffsetY: (1920 - 600) / 2,
  };
  const l1 = panLimitsForPage(1, geom);
  assert(
    nearly(l1.minX, 0) && nearly(l1.maxX, 0) && nearly(l1.minY, 0) && nearly(l1.maxY, 0),
    'fit-width scale1 : pas de pan',
  );
  const l2 = panLimitsForPage(2, geom);
  // scaledW=2160 → ±(2160-1080)/2 = ±540 ; scaledH=1200 < 1920 → Y lock 0
  assert(nearly(l2.maxX, 540) && nearly(l2.minX, -540), 'fit-width zoom : pan X');
  assert(nearly(l2.minY, 0) && nearly(l2.maxY, 0), 'fit-width zoom : Y lock si undersized');
}

// --- Câblage store / vue ---
const store = readFileSync(join(root, 'src/renderer/src/stores/reader.js'), 'utf8');
const view = readFileSync(join(root, 'src/renderer/src/views/ReaderView.vue'), 'utf8');

assert(store.includes('panForZoomToScreenCenter'), 'store importe panForZoomToScreenCenter');
assert(store.includes('clampPanToPage'), 'store importe clampPanToPage');
assert(store.includes('measureReaderZoomGeometry'), 'store mesure la géométrie');
assert(store.includes('pinReaderOverflow'), 'store pin overflow pendant zoom');
assert(store.includes('applyScaleAtCenter'), 'store applyScaleAtCenter');
assert(store.includes('this.clampPan()'), 'store.pan / zoom appellent clampPan');
assert(
  /animateScaleTo[\s\S]*?panForZoomToScreenCenter/.test(store),
  'animateScaleTo ancre via panForZoomToScreenCenter',
);
assert(
  /animateScaleTo[\s\S]*?clampPanToPage/.test(store),
  'animateScaleTo clampe le pan après ancrage',
);
assert(
  /zoomBy\(\s*steps\s*\)\s*\{[\s\S]*?animateScaleTo/.test(store) &&
    !/zoomBy\(\s*steps\s*\)\s*\{[\s\S]*?fitMode\s*=\s*['"]custom['"]/.test(store),
  'zoomBy ne bascule plus en fitMode custom (évite saut taille naturelle)',
);
assert(store.includes('resetZoom()'), 'store resetZoom (L3 page entière)');
{
  const m = store.match(/resetZoom\(\)\s*\{([^}]*)\}/);
  assert(
    m &&
      /animateScaleTo\(1\)/.test(m[1]) &&
      !/fitMode\s*=/.test(m[1]),
    'resetZoom : scale→1 sans changer fitMode',
  );
}
assert(
  !/fitMode\s*=\s*this\.fitMode\s*===\s*'fit-width'\s*\?\s*'fit-height'/.test(
    store,
  ),
  'plus de toggle Fit Height ↔ Fit Width',
);
assert(
  store.includes("transformOrigin: 'center center'") ||
    store.includes('transformOrigin: "center center"'),
  'imageStyle transformOrigin center center',
);
assert(
  store.includes('scale(${s.scale})'),
  'imageStyle = scale seul (pan sur wrapper)',
);
assert(view.includes('reader__pan'), 'vue : wrapper .reader__pan pour le pan');
assert(
  view.includes('place-items: unsafe center') ||
    view.includes('place-items:unsafe center'),
  'CSS stage place-items unsafe center',
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
assert(
  /\.reader__viewport\s*\{[\s\S]*?overflow:\s*hidden/.test(view),
  'viewport overflow hidden',
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll zoom-anchor checks passed.');
