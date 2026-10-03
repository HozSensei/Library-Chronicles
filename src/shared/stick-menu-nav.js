/**
 * Stick gauche → navigation focus menus (comme D-Pad).
 *
 * Hors lecteur uniquement : axes → up/down/left/right avec
 * franchissement de seuil (edge) + repeat (délai initial + intervalle).
 * Menus = landscape identité (pas de remap portrait).
 */

/** Seuil d’activation discret (au-delà de la deadzone analogique). */
export const STICK_NAV_THRESHOLD = 0.45;

/** Délai avant auto-repeat (ms) après le premier pas. */
export const STICK_NAV_INITIAL_DELAY_MS = 320;

/** Intervalle entre pas de repeat (ms). */
export const STICK_NAV_REPEAT_MS = 120;

/**
 * Direction dominante du stick, ou null sous le seuil.
 * Convention Gamepad : x −1 gauche / +1 droite, y −1 haut / +1 bas.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} [threshold]
 * @returns {'up'|'down'|'left'|'right'|null}
 */
export function stickDirection(x, y, threshold = STICK_NAV_THRESHOLD) {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax < threshold && ay < threshold) return null;
  if (ay >= ax) return y < 0 ? 'up' : 'down';
  return x < 0 ? 'left' : 'right';
}

/**
 * État de repeat pour le stick menus.
 * - Premier franchissement de seuil → fire immédiat (edge)
 * - Maintien → silence jusqu’au délai initial, puis fire à intervalle
 * - Neutre ou changement de direction → reset
 *
 * @param {{
 *   threshold?: number,
 *   initialDelayMs?: number,
 *   repeatMs?: number,
 * }} [opts]
 */
export function createStickMenuNav(opts = {}) {
  const threshold = opts.threshold ?? STICK_NAV_THRESHOLD;
  const initialDelayMs = opts.initialDelayMs ?? STICK_NAV_INITIAL_DELAY_MS;
  const repeatMs = opts.repeatMs ?? STICK_NAV_REPEAT_MS;

  /** @type {'up'|'down'|'left'|'right'|null} */
  let heldDir = null;
  let firstFireAt = 0;
  let lastFireAt = 0;
  /** true si le dernier `update` non-null était un auto-repeat (pas l’edge). */
  let lastFireWasRepeat = false;

  function reset() {
    heldDir = null;
    firstFireAt = 0;
    lastFireAt = 0;
    lastFireWasRepeat = false;
  }

  /**
   * @param {number} x axes déjà deadzone-appliqués (ou bruts)
   * @param {number} y
   * @param {number} now timestamp ms (performance.now)
   * @returns {'up'|'down'|'left'|'right'|null} direction à émettre ce frame
   */
  function update(x, y, now) {
    const dir = stickDirection(x, y, threshold);
    if (!dir) {
      reset();
      return null;
    }

    if (dir !== heldDir) {
      heldDir = dir;
      firstFireAt = now;
      lastFireAt = now;
      lastFireWasRepeat = false;
      return dir;
    }

    const sinceFirst = now - firstFireAt;
    if (sinceFirst < initialDelayMs) return null;
    if (now - lastFireAt >= repeatMs) {
      lastFireAt = now;
      lastFireWasRepeat = true;
      return dir;
    }
    return null;
  }

  /** Dernier pas émis était-il un repeat ? (pour couper les haptics nav.) */
  function lastWasRepeat() {
    return lastFireWasRepeat;
  }

  return { update, reset, lastWasRepeat };
}
