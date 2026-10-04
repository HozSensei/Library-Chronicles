/**
 * Comportement numérique du zoom page (réf. b7d1f81, pré-#57).
 * - pas D-Pad ±0.15
 * - L3 → scale 1 + pan 0
 * - strip : zoomBy no-op (scale inchangé)
 * - store Pinia : zoomBy change bien scale en mode page
 */
import { createPinia, setActivePinia } from 'pinia';
import { ZOOM_STEP } from '../src/shared/gamepad-codes.js';
import {
  clampPageScale,
  nextPageTargetScale,
  simulatePageZoomSequence,
} from '../src/shared/reader-page-zoom.js';
import { READING_MODE } from '../src/shared/reading-mode.js';
import { useReaderStore } from '../src/renderer/src/stores/reader.js';

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

// --- Pure helpers (b7d1f81) ---
assert(ZOOM_STEP === 0.15, 'ZOOM_STEP = 0.15');
assert(nearly(nextPageTargetScale(1, 1), 1.15), '1 pas + → 1.15');
assert(nearly(nextPageTargetScale(1.15, 1), 1.3), '2 pas + → 1.30');
assert(nearly(nextPageTargetScale(1.3, -1), 1.15), '1 pas − → 1.15');
assert(nearly(clampPageScale(0.1), 0.25), 'clamp min 0.25');
assert(nearly(clampPageScale(9), 4), 'clamp max 4');

{
  const seq = simulatePageZoomSequence({}, { steps: [1, 1, 1] });
  assert(nearly(seq.scale, 1.45), '3× zoom-in → scale 1.45');
  assert(nearly(seq.targetScale, 1.45), '3× zoom-in → target 1.45');
}
{
  const seq = simulatePageZoomSequence(
    {},
    { steps: [1, 1, 1], reset: true },
  );
  assert(nearly(seq.scale, 1), 'L3 reset → scale 1');
  assert(nearly(seq.targetScale, 1), 'L3 reset → target 1');
  assert(seq.panX === 0 && seq.panY === 0, 'L3 reset → pan 0');
}

// --- Store Pinia : zoomBy change scale (mode page) ---
/** rAF mock qui avance le temps pour terminer l’anim ease-out. */
let rafNow = 0;
globalThis.performance = {
  now: () => rafNow,
};
globalThis.requestAnimationFrame = (cb) => {
  rafNow += 50;
  return setTimeout(() => cb(rafNow), 0);
};
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

setActivePinia(createPinia());
const reader = useReaderStore();
reader.readingMode = READING_MODE.PAGE;
reader.scale = 1;
reader.targetScale = 1;
reader.panX = 0;
reader.panY = 0;

reader.zoomBy(1);
await new Promise((r) => setTimeout(r, 350));
assert(nearly(reader.scale, 1.15, 1e-6), 'store page zoomBy(+1) → scale 1.15');
assert(nearly(reader.targetScale, 1.15, 1e-6), 'store page targetScale 1.15');

reader.zoomBy(1);
await new Promise((r) => setTimeout(r, 350));
assert(nearly(reader.scale, 1.3, 1e-6), 'store page zoomBy(+1)×2 → scale 1.30');

reader.resetZoom();
await new Promise((r) => setTimeout(r, 350));
assert(nearly(reader.scale, 1, 1e-6), 'store L3 resetZoom → scale 1');
assert(reader.panX === 0 && reader.panY === 0, 'store L3 resetZoom → pan 0');

// Strip : zoomBy no-op
reader.readingMode = READING_MODE.STRIP;
reader.scale = 1;
reader.targetScale = 1;
reader.zoomBy(2);
await new Promise((r) => setTimeout(r, 50));
assert(nearly(reader.scale, 1), 'store strip zoomBy = no-op (scale inchangé)');
assert(nearly(reader.targetScale, 1), 'store strip targetScale inchangé');

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll page-zoom behavior checks passed.');
