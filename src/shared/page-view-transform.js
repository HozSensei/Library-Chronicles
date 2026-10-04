/**
 * Modèle de transformation — lecteur **page par page** (chemin `page`).
 *
 * Un seul module, fonctions pures, aucune dépendance DOM : la vue mesure,
 * le store applique, ce fichier décide. Remplace `reader-page-zoom.js`
 * (bornes 0.25–4 absolues) + `zoom-anchor.js` (ancrage écran + clamps dupliqués).
 *
 * Repères
 * -------
 * - **stage local** : plan du lecteur *avant* le `rotate(90deg)` CSS appliqué à
 *   `.reader__plane`. `clientWidth/clientHeight` du stage sont déjà locaux.
 *   Sous rotate, l’axe local X est l’horizontale **utilisateur** et l’axe local Y
 *   sa verticale — donc tout le modèle raisonne en px stage locaux.
 *   `computeFit({ rotate90: true })` accepte malgré tout des dimensions mesurées
 *   en espace écran (AABB post-rotation) et les transpose.
 * - **page** : taille naturelle de l’image (`naturalWidth/naturalHeight`).
 *
 * Transform CSS appliquée au calque de pan (origin = centre) :
 *   `translate(-50%, -50%) translate3d(x, y, 0) scale(scale)`
 * ⇒ centre de la page = centre du stage + `offset`, `offset` en px stage
 *   (non affecté par `scale`, qui vient après dans la liste).
 *
 * Invariants
 * ----------
 * 1. `fitScale = min(stageW / pageW, stageH / pageH)` — page **entière** bord à bord.
 * 2. `zoom ∈ [1, PAGE_MAX_ZOOM]` et `scale = fitScale × zoom` ⇒ **jamais** de
 *    dézoom sous la page entière, donc jamais de « trou » hors page.
 * 3. `offset` clampé à ±débordement/2 par axe ; axe sans débordement ⇒ 0 (centré).
 * 4. Reset (L3) = `{ zoom: 1, x: 0, y: 0 }` — indépendant des mesures, donc
 *    toujours exactement la page entière une fois le stage mesuré.
 * 5. Stick sans débordement ⇒ `page-prev` / `page-next` : aucun état inerte.
 */

import { ZOOM_STEP } from './gamepad-codes.js';

/** Pas de zoom D-Pad — facteur multiplicatif (±15 %). */
export const PAGE_ZOOM_STEP = ZOOM_STEP;

/** Zoom maximum, en multiple de `fitScale`. */
export const PAGE_MAX_ZOOM = 4;

/** Vitesse de pan stick (px stage locaux par frame et par unité d’axe). */
export const PAGE_PAN_SPEED = 14;

/** Tolérance de débordement (px) — sous ce seuil l’axe est considéré « tient ». */
export const PAGE_OVERFLOW_EPS = 0.5;

/** Seuil d’activation du stick pour tourner la page (hors débordement). */
export const PAGE_STICK_TURN_THRESHOLD = 0.45;

/** Intentions possibles d’un stick en mode page. */
export const STICK_INTENT = Object.freeze({
  NONE: 'none',
  PAN: 'pan',
  PAGE_PREV: 'page-prev',
  PAGE_NEXT: 'page-next',
});

/** Fit neutre tant que le stage ou la page n’est pas mesuré. */
export const EMPTY_FIT = Object.freeze({
  valid: false,
  stageW: 0,
  stageH: 0,
  pageW: 0,
  pageH: 0,
  fitScale: 1,
  widthScale: 1,
  heightScale: 1,
  maxZoom: PAGE_MAX_ZOOM,
});

/** Vue initiale / reset — page entière centrée. */
export const RESET_VIEW = Object.freeze({ zoom: 1, x: 0, y: 0 });

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampTo(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Échelle « contain » + échelles fit-width / fit-height d’un couple stage/page.
 *
 * @param {{
 *   stageW?: number, stageH?: number,
 *   pageW?: number, pageH?: number,
 *   rotate90?: boolean,
 * }} [metrics] dimensions stage en px **locaux** ; `rotate90` si elles ont été
 *   mesurées en espace écran sous un plan tourné de 90° (elles sont transposées).
 * @returns {typeof EMPTY_FIT}
 */
export function computeFit(metrics = {}) {
  const rawW = num(metrics?.stageW);
  const rawH = num(metrics?.stageH);
  const stageW = metrics?.rotate90 ? rawH : rawW;
  const stageH = metrics?.rotate90 ? rawW : rawH;
  const pageW = num(metrics?.pageW);
  const pageH = num(metrics?.pageH);
  if (stageW <= 0 || stageH <= 0 || pageW <= 0 || pageH <= 0) return EMPTY_FIT;

  const widthScale = stageW / pageW;
  const heightScale = stageH / pageH;
  return {
    valid: true,
    stageW,
    stageH,
    pageW,
    pageH,
    fitScale: Math.min(widthScale, heightScale),
    widthScale,
    heightScale,
    maxZoom: PAGE_MAX_ZOOM,
  };
}

/**
 * Borne le facteur de zoom : `1` (page entière) ≤ zoom ≤ `maxZoom`.
 * @param {unknown} zoom
 * @param {typeof EMPTY_FIT} [fit]
 * @returns {number}
 */
export function clampZoom(zoom, fit = EMPTY_FIT) {
  const max = Math.max(1, num(fit?.maxZoom, PAGE_MAX_ZOOM));
  const z = Number(zoom);
  if (!Number.isFinite(z)) return 1;
  return clampTo(z, 1, max);
}

/**
 * Échelle CSS absolue correspondant à un facteur de zoom.
 * @param {unknown} zoom
 * @param {typeof EMPTY_FIT} [fit]
 * @returns {number}
 */
export function scaleForZoom(zoom, fit = EMPTY_FIT) {
  const z = clampZoom(zoom, fit);
  return fit?.valid ? num(fit.fitScale, 1) * z : z;
}

/**
 * Zoom après `steps` crans D-Pad (multiplicatif, borné [1, maxZoom]).
 * @param {unknown} zoom
 * @param {unknown} steps crans (± entiers, 0 = no-op)
 * @param {typeof EMPTY_FIT} [fit]
 * @param {number} [step=PAGE_ZOOM_STEP]
 * @returns {number}
 */
export function zoomStep(zoom, steps, fit = EMPTY_FIT, step = PAGE_ZOOM_STEP) {
  const base = clampZoom(zoom, fit);
  const n = num(steps);
  const factor = 1 + num(step, PAGE_ZOOM_STEP);
  if (n === 0 || factor <= 0) return base;
  return clampZoom(base * factor ** n, fit);
}

/**
 * Zoom qui amène la page bord à bord en largeur (toujours ≥ 1).
 * @param {typeof EMPTY_FIT} [fit]
 * @returns {number}
 */
export function zoomForFitWidth(fit = EMPTY_FIT) {
  if (!fit?.valid) return 1;
  return clampZoom(num(fit.widthScale, 1) / num(fit.fitScale, 1), fit);
}

/**
 * Zoom qui amène la page bord à bord en hauteur (toujours ≥ 1).
 * @param {typeof EMPTY_FIT} [fit]
 * @returns {number}
 */
export function zoomForFitHeight(fit = EMPTY_FIT) {
  if (!fit?.valid) return 1;
  return clampZoom(num(fit.heightScale, 1) / num(fit.fitScale, 1), fit);
}

/**
 * Débordement de la page hors du stage, par axe (px stage, ≥ 0).
 * @param {unknown} zoom
 * @param {typeof EMPTY_FIT} [fit]
 * @returns {{ x: number, y: number }}
 */
export function overflowFor(zoom, fit = EMPTY_FIT) {
  if (!fit?.valid) return { x: 0, y: 0 };
  const scale = scaleForZoom(zoom, fit);
  return {
    x: Math.max(0, fit.pageW * scale - fit.stageW),
    y: Math.max(0, fit.pageH * scale - fit.stageH),
  };
}

/**
 * Bornes d’offset : ±débordement/2 (axe qui tient ⇒ 0, page centrée).
 * @param {unknown} zoom
 * @param {typeof EMPTY_FIT} [fit]
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
 */
export function offsetLimits(zoom, fit = EMPTY_FIT) {
  const over = overflowFor(zoom, fit);
  const halfX = over.x / 2;
  const halfY = over.y / 2;
  return { minX: -halfX, maxX: halfX, minY: -halfY, maxY: halfY };
}

/**
 * Clampe un offset dans les bornes de l’échelle courante.
 * @param {{ x?: number, y?: number } | null} [offset]
 * @param {unknown} zoom
 * @param {typeof EMPTY_FIT} [fit]
 * @returns {{ x: number, y: number }}
 */
export function clampOffset(offset, zoom, fit = EMPTY_FIT) {
  const limits = offsetLimits(zoom, fit);
  return {
    x: clampTo(num(offset?.x), limits.minX, limits.maxX),
    y: clampTo(num(offset?.y), limits.minY, limits.maxY),
  };
}

/** Vue de reset (L3) — page entière centrée, quelle que soit la mesure. */
export function resetView() {
  return { ...RESET_VIEW };
}

/**
 * Change de zoom en gardant fixe le point de la page sous le **centre du stage**.
 *
 * La page étant toujours centrée par construction (`translate(-50%,-50%)`), le
 * point sous le centre est `p = −offset / scale` ; l’y maintenir après coup donne
 * `offset' = offset × (zoom' / zoom)`. Pas de géométrie d’écran à mesurer : c’est
 * toute la complexité de l’ancien `panForZoomToScreenCenter` qui disparaît.
 *
 * @param {{ x?: number, y?: number } | null} offset
 * @param {unknown} fromZoom
 * @param {unknown} toZoom
 * @param {typeof EMPTY_FIT} [fit]
 * @returns {{ zoom: number, x: number, y: number }}
 */
export function zoomAboutCenter(offset, fromZoom, toZoom, fit = EMPTY_FIT) {
  const from = clampZoom(fromZoom, fit);
  const to = clampZoom(toZoom, fit);
  const ratio = from > 0 ? to / from : 1;
  const next = clampOffset(
    { x: num(offset?.x) * ratio, y: num(offset?.y) * ratio },
    to,
    fit,
  );
  return { zoom: to, x: next.x, y: next.y };
}

/**
 * Au moins un axe déborde ⇒ le pan a un sens.
 * @param {unknown} zoom
 * @param {typeof EMPTY_FIT} [fit]
 * @returns {boolean}
 */
export function hasOverflow(zoom, fit = EMPTY_FIT) {
  const over = overflowFor(zoom, fit);
  return over.x > PAGE_OVERFLOW_EPS || over.y > PAGE_OVERFLOW_EPS;
}

/**
 * Applique un delta stick à l’offset, clampé.
 * @param {{ x?: number, y?: number } | null} offset
 * @param {{ x?: number, y?: number } | null} delta axes stick locaux (−1..1)
 * @param {unknown} zoom
 * @param {typeof EMPTY_FIT} [fit]
 * @param {number} [speed=PAGE_PAN_SPEED]
 * @returns {{ x: number, y: number, moved: boolean }}
 */
export function panBy(offset, delta, zoom, fit = EMPTY_FIT, speed = PAGE_PAN_SPEED) {
  const spd = num(speed, PAGE_PAN_SPEED) || PAGE_PAN_SPEED;
  const fromX = num(offset?.x);
  const fromY = num(offset?.y);
  const next = clampOffset(
    { x: fromX + num(delta?.x) * spd, y: fromY + num(delta?.y) * spd },
    zoom,
    fit,
  );
  return {
    x: next.x,
    y: next.y,
    moved: Math.abs(next.x - fromX) > 1e-6 || Math.abs(next.y - fromY) > 1e-6,
  };
}

/**
 * Intention d’un stick en mode page.
 *
 * - au moins un axe déborde ⇒ `pan` (jamais de page tournée par accident) ;
 * - page entièrement visible ⇒ l’horizontale **utilisateur** tourne les pages,
 *   la verticale reste neutre. Le stick n’est donc jamais inerte au reset.
 *
 * `stickLocal` est le vecteur de pan (sortie de `visualPanToLocal`), qui est
 * l’opposé du repère utilisateur : pousser à droite ramène la page à gauche.
 *
 * @param {{ x?: number, y?: number } | null} stickLocal
 * @param {unknown} zoom
 * @param {typeof EMPTY_FIT} [fit]
 * @param {{ threshold?: number }} [opts]
 * @returns {typeof STICK_INTENT[keyof typeof STICK_INTENT]}
 */
export function resolveStickIntent(stickLocal, zoom, fit = EMPTY_FIT, opts = {}) {
  const x = num(stickLocal?.x);
  const y = num(stickLocal?.y);
  if (x === 0 && y === 0) return STICK_INTENT.NONE;
  if (hasOverflow(zoom, fit)) return STICK_INTENT.PAN;

  const threshold = num(opts?.threshold, PAGE_STICK_TURN_THRESHOLD);
  const userX = -x;
  const userY = -y;
  if (Math.abs(userX) < threshold) return STICK_INTENT.NONE;
  if (Math.abs(userX) < Math.abs(userY)) return STICK_INTENT.NONE;
  return userX > 0 ? STICK_INTENT.PAGE_NEXT : STICK_INTENT.PAGE_PREV;
}

function round(value, decimals) {
  const f = 10 ** decimals;
  return Math.round(num(value) * f) / f;
}

/**
 * Transform CSS du calque de pan (origin centre, page à taille naturelle).
 * @param {{ zoom?: number, x?: number, y?: number } | null} view
 * @param {typeof EMPTY_FIT} [fit]
 * @returns {string}
 */
export function pageTransform(view, fit = EMPTY_FIT) {
  const scale = scaleForZoom(view?.zoom, fit);
  const x = round(view?.x, 2);
  const y = round(view?.y, 2);
  return `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0) scale(${round(scale, 5)})`;
}
