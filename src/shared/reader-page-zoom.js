/**
 * Zoom / pan — chemin page par page.
 *
 * Logique figée depuis b7d1f81 (post-#39 L3 reset, pré-#57 strip-cta).
 * Le mode strip n’importe pas ce module pour le scale CSS.
 */

import { ZOOM_STEP } from './gamepad-codes.js';

/** Durée d’interpolation zoom D-Pad / L3 (ms), ease-out — b7d1f81. */
export const PAGE_ZOOM_ANIM_MS = 200;

/** Seuil « zoomé » pour pan stick — b7d1f81. */
export const PAGE_ZOOMED_EPS = 1.02;

/** Bornes scale page — b7d1f81. */
export const PAGE_SCALE_MIN = 0.25;
export const PAGE_SCALE_MAX = 4;

/**
 * @param {unknown} value
 * @returns {number}
 */
export function clampPageScale(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(PAGE_SCALE_MAX, Math.max(PAGE_SCALE_MIN, n));
}

/**
 * Prochaine cible de zoom après N pas D-Pad (±15 %).
 * @param {unknown} currentTarget
 * @param {unknown} steps
 * @param {number} [step=ZOOM_STEP]
 * @returns {number}
 */
export function nextPageTargetScale(currentTarget, steps, step = ZOOM_STEP) {
  const from = Number(currentTarget);
  const base = Number.isFinite(from) ? from : 1;
  const s = Number(steps);
  const delta = Number.isFinite(s) ? s : 0;
  const stepN = Number(step);
  const z = Number.isFinite(stepN) ? stepN : ZOOM_STEP;
  return clampPageScale(base + delta * z);
}

/**
 * Simule N pas de zoom + reset L3 (comportement numérique pré-#57).
 * Sans DOM / rAF — pour tests de régression.
 *
 * @param {{ scale?: number, targetScale?: number, panX?: number, panY?: number }} [start]
 * @param {{ steps?: number[], reset?: boolean }} [ops]
 * @returns {{ scale: number, targetScale: number, panX: number, panY: number }}
 */
export function simulatePageZoomSequence(start = {}, ops = {}) {
  let scale = clampPageScale(start.scale ?? 1);
  let targetScale = clampPageScale(start.targetScale ?? scale);
  let panX = Number(start.panX) || 0;
  let panY = Number(start.panY) || 0;

  const steps = Array.isArray(ops.steps) ? ops.steps : [];
  for (const step of steps) {
    targetScale = nextPageTargetScale(targetScale, step);
    // animateScaleTo synchrone (fin d’anim) — scale = cible.
    scale = targetScale;
  }

  if (ops.reset) {
    panX = 0;
    panY = 0;
    targetScale = 1;
    scale = 1;
  }

  return { scale, targetScale, panX, panY };
}
