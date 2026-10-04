/**
 * Modèle de transform du lecteur page par page — fonctions pures.
 *
 * Garanties vérifiées ici :
 *  1. `computeFit` = contain (page entière bord à bord), rotation comprise ;
 *  2. zoom borné [1, 4] × fitScale — **jamais** de dézoom sous la page entière ;
 *  3. offset clampé à ±débordement/2, 0 sur un axe qui tient ;
 *  4. reset (L3) = page entière centrée, sans dépendre d’une mesure ;
 *  5. stick = pan tant qu’il y a du débordement, sinon no-op (pas de page) ;
 *  6. stepPage conserve zoom + offset clampé (pas de reset fit) ;
 *  7. câblage store / vue (un seul module, plus d’ancrage ni de clamp dupliqué).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPinia, setActivePinia } from 'pinia';
import {
  EMPTY_FIT,
  PAGE_MAX_ZOOM,
  PAGE_PAN_SPEED,
  PAGE_ZOOM_STEP,
  STICK_INTENT,
  clampOffset,
  clampZoom,
  computeFit,
  hasOverflow,
  offsetLimits,
  overflowFor,
  pageTransform,
  panBy,
  resetView,
  resolveStickIntent,
  scaleForZoom,
  zoomAboutCenter,
  zoomForFitHeight,
  zoomForFitWidth,
  zoomStep,
} from '../src/shared/page-view-transform.js';
import { READER_STICK_SPEED } from '../src/shared/reader-stick.js';
import { READING_MODE } from '../src/shared/reading-mode.js';
import { applyPageReaderAction } from '../src/shared/reader-page-controls.js';
import { useReaderStore } from '../src/renderer/src/stores/reader.js';

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

function nearly(a, b, eps = 1e-9) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

// Stage portrait local (plan +90°) 1080×1920 ; page manga 1400×2000.
const STAGE = { stageW: 1080, stageH: 1920 };
const PAGE = { pageW: 1400, pageH: 2000 };
const fit = computeFit({ ...STAGE, ...PAGE });

// ——— 1. computeFit = contain ————————————————————————————————————————
assert(fit.valid, 'computeFit : mesures valides');
assert(nearly(fit.widthScale, 1080 / 1400), 'widthScale = stageW / pageW');
assert(nearly(fit.heightScale, 1920 / 2000), 'heightScale = stageH / pageH');
assert(nearly(fit.fitScale, 1080 / 1400), 'fitScale = min(width, height) (contain)');
assert(
  nearly(fit.pageW * fit.fitScale, 1080) &&
    fit.pageH * fit.fitScale <= 1920 + 1e-9,
  'fitScale : page entière dans le stage (bord à bord sur l’axe contraint)',
);

{
  // Page « paysage » : c’est la hauteur qui contraint.
  const wide = computeFit({ ...STAGE, pageW: 2000, pageH: 1000 });
  assert(nearly(wide.fitScale, 1080 / 2000), 'contain page paysage = widthScale');
  assert(
    nearly(wide.pageW * wide.fitScale, 1080) &&
      wide.pageH * wide.fitScale < 1920,
    'contain page paysage : largeur bord à bord, hauteur centrée',
  );
}

{
  // Mesures incomplètes → fit neutre, jamais NaN.
  const none = computeFit({ stageW: 0, stageH: 0, pageW: 0, pageH: 0 });
  assert(none === EMPTY_FIT && !none.valid, 'mesures absentes → EMPTY_FIT');
  assert(nearly(scaleForZoom(1, none), 1), 'scale neutre sans mesure');
  assert(nearly(clampZoom(9, none), PAGE_MAX_ZOOM), 'clampZoom borne même sans mesure');
}

{
  // Rotation : dimensions mesurées en espace écran (AABB post-rotate) transposées.
  const rotated = computeFit({
    stageW: 1920,
    stageH: 1080,
    ...PAGE,
    rotate90: true,
  });
  assert(
    nearly(rotated.fitScale, fit.fitScale) &&
      rotated.stageW === 1080 &&
      rotated.stageH === 1920,
    'computeFit rotate90 : stage transposé → même fitScale',
  );
}

// ——— 2. Bornes de zoom ————————————————————————————————————————————
assert(PAGE_ZOOM_STEP === 0.15, 'pas de zoom D-Pad = 15 %');
assert(PAGE_MAX_ZOOM === 4, 'zoom max = 4 × page entière');
assert(nearly(clampZoom(0.25, fit), 1), 'clampZoom : pas de dézoom sous la page entière');
assert(nearly(clampZoom(-3, fit), 1), 'clampZoom : valeur négative → 1');
assert(nearly(clampZoom(Number.NaN, fit), 1), 'clampZoom : NaN → 1');
assert(nearly(clampZoom(10, fit), 4), 'clampZoom : plafond 4');
assert(nearly(zoomStep(1, 1, fit), 1.15), '1 cran + → 1.15');
assert(nearly(zoomStep(1.15, 1, fit), 1.15 * 1.15), '2 crans + → 1.3225');
assert(nearly(zoomStep(1.15 * 1.15, -1, fit), 1.15), '1 cran − revient au cran précédent');
assert(nearly(zoomStep(1, -1, fit), 1), 'cran − à la page entière = no-op (plancher)');
assert(nearly(zoomStep(1, -8, fit), 1), '8 crans − : toujours la page entière');
assert(nearly(zoomStep(1, 30, fit), 4), '30 crans + : plafonné à 4');
assert(nearly(zoomStep(2, 0, fit), 2), '0 cran = no-op');
assert(
  nearly(scaleForZoom(2, fit), fit.fitScale * 2),
  'scale = fitScale × zoom',
);

// fit-width / fit-height toujours ≥ page entière
assert(nearly(zoomForFitWidth(fit), 1), 'page contrainte en largeur : fit-width = page entière');
assert(
  nearly(zoomForFitHeight(fit), fit.heightScale / fit.fitScale) &&
    zoomForFitHeight(fit) > 1,
  'fit-height > 1 quand la largeur contraint',
);
{
  const tall = computeFit({ ...STAGE, pageW: 1000, pageH: 3000 });
  assert(nearly(tall.fitScale, 1920 / 3000), 'page très haute : contain = heightScale');
  assert(zoomForFitWidth(tall) > 1, 'fit-width > 1 quand la hauteur contraint');
  assert(nearly(zoomForFitHeight(tall), 1), 'fit-height = page entière dans ce cas');
}

// ——— 3. Débordement / clamp offset ————————————————————————————————
{
  const over = overflowFor(1, fit);
  assert(nearly(over.x, 0) && nearly(over.y, 0), 'page entière : aucun débordement');
  const limits = offsetLimits(1, fit);
  assert(
    nearly(limits.minX, 0) &&
      nearly(limits.maxX, 0) &&
      nearly(limits.minY, 0) &&
      nearly(limits.maxY, 0),
    'page entière : offset verrouillé à 0 (centré)',
  );
  const clamped = clampOffset({ x: 500, y: -900 }, 1, fit);
  assert(nearly(clamped.x, 0) && nearly(clamped.y, 0), 'offset hors bornes → recentré');
  assert(!hasOverflow(1, fit), 'hasOverflow false à la page entière');
}

{
  const zoom = 2;
  const scale = scaleForZoom(zoom, fit);
  const over = overflowFor(zoom, fit);
  assert(nearly(over.x, fit.pageW * scale - 1080), 'débordement X = largeur affichée − stage');
  assert(nearly(over.y, fit.pageH * scale - 1920), 'débordement Y = hauteur affichée − stage');
  const limits = offsetLimits(zoom, fit);
  assert(
    nearly(limits.maxX, over.x / 2) && nearly(limits.minX, -over.x / 2),
    'bornes X = ±débordement/2',
  );
  const clamped = clampOffset({ x: 1e6, y: -1e6 }, zoom, fit);
  assert(
    nearly(clamped.x, over.x / 2) && nearly(clamped.y, -over.y / 2),
    'clamp : les bords de page sont atteignables mais pas dépassables',
  );
  const inside = clampOffset({ x: 10, y: -20 }, zoom, fit);
  assert(nearly(inside.x, 10) && nearly(inside.y, -20), 'offset interne inchangé');
  assert(hasOverflow(zoom, fit), 'hasOverflow true une fois zoomé');
}

{
  // Un axe déborde, l’autre non (fit-width sur page courte).
  const short = computeFit({ ...STAGE, pageW: 1080, pageH: 600 });
  const z = zoomForFitWidth(short);
  const limits = offsetLimits(z * 2, short);
  assert(limits.maxX > 0, 'axe X débordant : pan autorisé');
  assert(
    nearly(offsetLimits(1, short).maxY, 0),
    'axe Y qui tient : offset verrouillé à 0',
  );
}

// ——— 4. Reset ——————————————————————————————————————————————————————
{
  const view = resetView();
  assert(view.zoom === 1 && view.x === 0 && view.y === 0, 'resetView = { 1, 0, 0 }');
  assert(nearly(scaleForZoom(view.zoom, fit), fit.fitScale), 'reset → scale = fitScale');
  const over = overflowFor(view.zoom, fit);
  assert(nearly(over.x, 0) && nearly(over.y, 0), 'reset → page entière visible');
  // Garantie indépendante des mesures : même sans fit, le reset reste neutre.
  assert(
    clampZoom(resetView().zoom, EMPTY_FIT) === 1,
    'reset valide même sans mesure (zoom neutre)',
  );
}

// ——— 4 bis. Zoom ancré au centre du stage ——————————————————————————
{
  // Point de la page sous le centre du stage : p = −offset / scale.
  const centerPoint = (offset, zoom) => ({
    x: -offset.x / scaleForZoom(zoom, fit),
    y: -offset.y / scaleForZoom(zoom, fit),
  });

  const from = { x: 60, y: -40 };
  const before = centerPoint(from, 2);
  const after = zoomAboutCenter(from, 2, 2.3, fit);
  const moved = centerPoint(after, after.zoom);
  assert(
    nearly(moved.x, before.x, 1e-6) && nearly(moved.y, before.y, 1e-6),
    'zoomAboutCenter : le point sous le centre reste fixe',
  );
  assert(nearly(after.x, 60 * (2.3 / 2)), 'zoomAboutCenter : offset × ratio');

  const out = zoomAboutCenter(from, 2, 1, fit);
  assert(
    out.zoom === 1 && out.x === 0 && out.y === 0,
    'zoomAboutCenter vers la page entière : offset reclampé à 0',
  );
}

// ——— 5. Pan + intention stick —————————————————————————————————————
assert(PAGE_PAN_SPEED === READER_STICK_SPEED, 'vitesse de pan page = vitesse strip (14)');
{
  const zoom = 2;
  const moved = panBy({ x: 0, y: 0 }, { x: 1, y: -1 }, zoom, fit);
  assert(
    nearly(moved.x, PAGE_PAN_SPEED) && nearly(moved.y, -PAGE_PAN_SPEED) && moved.moved,
    'panBy : ±speed par unité d’axe',
  );
  const limits = offsetLimits(zoom, fit);
  const atEdge = panBy({ x: limits.maxX, y: 0 }, { x: 1, y: 0 }, zoom, fit);
  assert(
    nearly(atEdge.x, limits.maxX) && atEdge.moved === false,
    'panBy au bord : clampé, moved=false',
  );
  const noFit = panBy({ x: 0, y: 0 }, { x: 1, y: 1 }, 1, fit);
  assert(!noFit.moved && noFit.x === 0, 'panBy sans débordement : no-op');
}

{
  // Stick neutre
  assert(
    resolveStickIntent({ x: 0, y: 0 }, 2, fit) === STICK_INTENT.NONE,
    'stick neutre → none',
  );
  // Zoomé : toujours pan (pas de page tournée par accident)
  assert(
    resolveStickIntent({ x: -1, y: 0 }, 2, fit) === STICK_INTENT.PAN,
    'zoomé : stick = pan',
  );
  assert(
    resolveStickIntent({ x: 0, y: 1 }, 2, fit) === STICK_INTENT.PAN,
    'zoomé : stick vertical = pan',
  );
  // Page entière : stick = no-op (pages uniquement via D-Pad)
  assert(
    resolveStickIntent({ x: -1, y: 0 }, 1, fit) === STICK_INTENT.NONE,
    'page entière + stick horizontal → none (pas de page)',
  );
  assert(
    resolveStickIntent({ x: 1, y: 0 }, 1, fit) === STICK_INTENT.NONE,
    'page entière + stick gauche → none',
  );
  assert(
    resolveStickIntent({ x: 0, y: 1 }, 1, fit) === STICK_INTENT.NONE,
    'page entière + stick vertical → none',
  );
  // Au bord d’un axe zoomé : intent reste pan, panBy no-op (moved=false)
  {
    const lim = offsetLimits(2, fit);
    const edge = panBy({ x: lim.maxX, y: 0 }, { x: 1, y: 0 }, 2, fit);
    assert(
      !edge.moved &&
        resolveStickIntent({ x: 1, y: 0 }, 2, fit) === STICK_INTENT.PAN,
      'au bord : intent=pan, panBy no-op (pas de page)',
    );
  }
}

// ——— pageTransform ————————————————————————————————————————————————
{
  const css = pageTransform({ zoom: 1, x: 0, y: 0 }, fit);
  assert(
    css.startsWith('translate(-50%, -50%) translate3d(0px, 0px, 0) scale('),
    'pageTransform : centrage + offset + scale',
  );
  assert(
    css.includes(`scale(${Math.round(fit.fitScale * 1e5) / 1e5})`),
    'pageTransform : scale = fitScale au reset',
  );
  assert(
    pageTransform({ zoom: 2, x: 12.345, y: -7.891 }, fit).includes(
      'translate3d(12.35px, -7.89px, 0)',
    ),
    'pageTransform : offset arrondi au centième de px',
  );
}

// ——— 6. Store Pinia ————————————————————————————————————————————————
setActivePinia(createPinia());
const reader = useReaderStore();
reader.readingMode = READING_MODE.PAGE;
reader.pageCount = 10;
reader.setStageMetrics(1080, 1920);
reader.setPageMetrics(1400, 2000);

assert(reader.fit.valid, 'store : fit calculé depuis les mesures');
assert(nearly(reader.zoom, 1) && reader.fitMode === 'fit-page', 'store : ouverture page entière');
assert(nearly(reader.scale, fit.fitScale), 'store : scale = fitScale');
assert(!reader.canPan, 'store : pas de pan à la page entière');

reader.zoomBy(1);
assert(nearly(reader.zoom, 1.15), 'store zoomBy(+1) → zoom 1.15');
assert(nearly(reader.scale, fit.fitScale * 1.15), 'store : scale suit fitScale × zoom');
assert(reader.canPan, 'store : pan possible une fois zoomé');
reader.zoomBy(1);
assert(nearly(reader.zoom, 1.15 * 1.15), 'store zoomBy(+1)×2');

reader.pan(1, -1);
assert(reader.offsetX > 0 && reader.offsetY < 0, 'store pan : offset déplacé');
for (let i = 0; i < 400; i += 1) reader.pan(1, 1);
const lim = offsetLimits(reader.zoom, reader.fit);
assert(
  nearly(reader.offsetX, lim.maxX) && nearly(reader.offsetY, lim.maxY),
  'store pan : clampé au bord de page (pas de fuite hors page)',
);

reader.resetZoom();
assert(
  nearly(reader.zoom, 1) && reader.offsetX === 0 && reader.offsetY === 0,
  'store L3 : zoom 1 + offset 0',
);
assert(nearly(reader.scale, reader.fit.fitScale), 'store L3 : page entière bord à bord');
assert(
  nearly(reader.fit.pageW * reader.scale, 1080) &&
    reader.fit.pageH * reader.scale <= 1920 + 1e-9,
  'store L3 : la page entière tient dans le stage',
);

// Dézoom répété depuis la page entière : jamais sous le fit ; stick = no-op.
for (let i = 0; i < 20; i += 1) reader.zoomBy(-1);
assert(nearly(reader.zoom, 1), 'store : 20 dézooms → toujours la page entière');
assert(
  reader.stickIntent({ x: -1, y: 0 }) === STICK_INTENT.NONE,
  'store : stick page entière → none (pas de page)',
);

// LB fit-width puis reset
reader.setFitWidth();
assert(reader.fitMode === 'fit-width', 'store LB : fitMode fit-width');
assert(
  nearly(reader.fit.pageW * reader.scale, 1080),
  'store LB : page bord à bord en largeur',
);
reader.setFitHeight();
assert(
  nearly(reader.fit.pageH * reader.scale, 1920),
  'store : fit-height bord à bord en hauteur',
);
reader.resetZoom();
assert(nearly(reader.zoom, 1), 'store : reset après fit → page entière');

// Resize du stage : le facteur de zoom est conservé, l’offset reclampé.
reader.zoomBy(2);
const zoomBeforeResize = reader.zoom;
reader.setStageMetrics(900, 1600);
assert(nearly(reader.zoom, zoomBeforeResize), 'store resize : zoom conservé');
assert(
  nearly(reader.fit.fitScale, Math.min(900 / 1400, 1600 / 2000)),
  'store resize : fitScale recalculé',
);
const limResize = offsetLimits(reader.zoom, reader.fit);
assert(
  reader.offsetX <= limResize.maxX + 1e-9 && reader.offsetY <= limResize.maxY + 1e-9,
  'store resize : offset reclampé aux nouvelles bornes',
);

// Nouvelle page avec _refitPending → refit page entière.
reader.zoomBy(3);
reader.resetTransform();
reader.setPageMetrics(1600, 2400);
assert(
  nearly(reader.zoom, 1) && reader.offsetX === 0 && reader.offsetY === 0,
  'store : refit pending → page entière',
);

// Nav page-à-page (sans _refitPending) : zoom + offset conservés / clampés.
reader.setPageMetrics(1400, 2000);
reader.zoomBy(2);
for (let i = 0; i < 50; i += 1) reader.pan(1, -1);
const zoomBeforeStep = reader.zoom;
const offBefore = { x: reader.offsetX, y: reader.offsetY };
assert(offBefore.x !== 0 || offBefore.y !== 0, 'précond : offset non nul avant nav');
// Simule stepPage : pas de resetTransform, puis mesure de la page suivante.
reader.pageIndex = 1;
reader.setPageMetrics(1600, 2400);
assert(
  nearly(reader.zoom, zoomBeforeStep),
  'store nav page : zoom conservé malgré nouvelles dimensions',
);
const limNav = offsetLimits(reader.zoom, reader.fit);
assert(
  reader.offsetX <= limNav.maxX + 1e-9 &&
    reader.offsetX >= limNav.minX - 1e-9 &&
    reader.offsetY <= limNav.maxY + 1e-9 &&
    reader.offsetY >= limNav.minY - 1e-9,
  'store nav page : offset reclampé aux nouvelles bornes',
);
assert(
  !(nearly(reader.zoom, 1) && reader.offsetX === 0 && reader.offsetY === 0),
  'store nav page : pas de reset fit (zoom≠1 ou offset non nul)',
);

// Strip : zoom / pan no-op
reader.readingMode = READING_MODE.STRIP;
reader.zoomBy(2);
assert(nearly(reader.zoom, zoomBeforeStep), 'store strip : zoomBy no-op (zoom inchangé)');
assert(reader.pan(1, 1) === false, 'store strip : pan no-op');
assert(reader.stickIntent({ x: 1, y: 0 }) === STICK_INTENT.NONE, 'store strip : stickIntent none');
reader.readingMode = READING_MODE.PAGE;
reader.resetZoom();

// ——— Contrôles manette : stick → pan seulement (jamais page) ——————————
{
  const calls = [];
  const stub = {
    resetZoom: () => calls.push('reset'),
    setFitWidth: () => calls.push('fit-width'),
    zoomBy: (n) => calls.push(`zoom:${n}`),
    stepPage: (w) => calls.push(`page:${w}`),
    pan: (x, y) => calls.push(`pan:${x},${y}`),
    stickIntent: () => STICK_INTENT.PAN,
  };
  applyPageReaderAction(stub, 'pan', { x: 1, y: 0 });
  assert(calls.join('|') === 'pan:1,0', 'controls : intention pan → reader.pan');

  const noPage = [];
  applyPageReaderAction(
    {
      ...stub,
      stickIntent: () => STICK_INTENT.NONE,
      stepPage: (w) => noPage.push(w),
    },
    'pan',
    { x: -1, y: 0 },
  );
  assert(noPage.length === 0, 'controls : stick sans débordement → pas de stepPage');

  const dpad = [];
  applyPageReaderAction(
    { ...stub, stepPage: (w) => dpad.push(w) },
    'page-next',
  );
  assert(dpad.join('|') === 'next', 'controls : D-Pad page-next → stepPage');
}

// ——— Câblage : un seul module, plus de couches ———————————————————————
const storeSrc = readFileSync(
  join(root, 'src/renderer/src/stores/reader.js'),
  'utf8',
);
const pageStage = readFileSync(
  join(root, 'src/renderer/src/components/PageReaderStage.vue'),
  'utf8',
);
const controlsSrc = readFileSync(
  join(root, 'src/shared/reader-page-controls.js'),
  'utf8',
);
const gamepadSrc = readFileSync(
  join(root, 'src/renderer/src/composables/useGamepad.js'),
  'utf8',
);

assert(
  storeSrc.includes('page-view-transform.js'),
  'store : importe page-view-transform',
);
assert(
  !storeSrc.includes('zoom-anchor') && !storeSrc.includes('reader-page-zoom'),
  'store : plus de zoom-anchor / reader-page-zoom',
);
assert(
  !storeSrc.includes('panForZoom') &&
    !storeSrc.includes('measureReaderZoomGeometry') &&
    !storeSrc.includes('pinReaderOverflow'),
  'store : plus d’ancrage écran ni de mesure DOM',
);
assert(
  !storeSrc.includes('animateScaleTo') && !storeSrc.includes('_zoomRaf'),
  'store : plus de lerp rAF du scale (transition CSS)',
);
assert(
  !/this\.panX|this\.panY|targetScale/.test(storeSrc),
  'store : plus de panX / panY / targetScale',
);
assert(
  /applyView\(view\)\s*\{[\s\S]*?clampZoom[\s\S]*?clampOffset/.test(storeSrc),
  'store : applyView = point de clamp unique (zoom puis offset)',
);
assert(
  /resetZoom\(\)\s*\{[\s\S]*?applyView\(resetView\(\)\)/.test(storeSrc),
  'store resetZoom → applyView(resetView())',
);
assert(
  storeSrc.includes('setStageMetrics') && storeSrc.includes('setPageMetrics'),
  'store : mesures injectées par la vue',
);
assert(
  pageStage.includes('setStageMetrics') &&
    pageStage.includes('setPageMetrics') &&
    pageStage.includes('ResizeObserver'),
  'vue : mesure stage (ResizeObserver) + page (naturalWidth)',
);
assert(
  pageStage.includes('reader.pageLayerStyle'),
  'vue : calque unique zoom+pan (pageLayerStyle)',
);
assert(
  /zoomBy\(steps\)\s*\{[\s\S]*?zoomAboutCenter/.test(storeSrc),
  'store zoomBy : ancré au centre du stage',
);
assert(
  !/\[data-fit=/.test(pageStage),
  'vue : plus de fit CSS width/height (scale seul)',
);
assert(
  /\.reader__page\s*\{[\s\S]*?max-width:\s*none/.test(pageStage),
  'vue : page à taille naturelle (max-width none)',
);
assert(
  controlsSrc.includes('stickIntent') &&
    !controlsSrc.includes('onStickPage') &&
    !controlsSrc.includes('PAGE_PREV') &&
    !controlsSrc.includes('PAGE_NEXT'),
  'controls : stick → pan seulement (plus de fallback page)',
);
assert(
  !gamepadSrc.includes('stickPageNav') && !gamepadSrc.includes('onStickPage'),
  'gamepad : plus de stickPageNav / onStickPage',
);
assert(
  /async stepPage\(which\)\s*\{[\s\S]*?this\.pageIndex = next;\s*\n\s*\/\/ Zoom[\s\S]*?await this\.loadCurrentPage/.test(
    storeSrc,
  ),
  'store stepPage : pas de resetTransform (zoom persisté)',
);
{
  const m = storeSrc.match(
    /async stepPage\(which\)\s*\{([\s\S]*?)\n\s*async stepChapter/,
  );
  assert(
    m && !m[1].includes('resetTransform'),
    'store stepPage : resetTransform absent du corps',
  );
}
assert(
  /setPageMetrics\([\s\S]*?_refitPending[\s\S]*?applyView\(\{ zoom: this\.zoom/.test(
    storeSrc,
  ),
  'store setPageMetrics : hors refit → conserve zoom',
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll page view transform checks passed.');
