/**
 * Stick lecture — parité page / strip.
 *
 * Mapping physique → local : même pipeline que le mode page
 * (`visualPanToLocal` sous +90° CSS, sinon axes déjà remappés).
 *
 * - page  : `reader.pan(localX, localY)` (translate + clamp bords)
 * - strip : scroll du conteneur `.reader__strip` sur les mêmes axes locaux
 *           (pas de zoom CSS — fit-width bord à bord)
 *
 * Signe scroll : opposé au translate pan pour la même sensation visuelle
 * (translate +Δ déplace le contenu ; scroll +Δ déplace le viewport).
 */

/** Vitesse stick commune (px / unité axe / frame) — axes X/Y égaux. */
export const READER_STICK_SPEED = 14;

/**
 * Applique un delta stick local au scroll d’un strip continu.
 * @param {{ scrollLeft: number, scrollTop: number } | null | undefined} strip
 * @param {number} localX
 * @param {number} localY
 * @param {number} [speed=READER_STICK_SPEED]
 * @returns {boolean} true si un scroll a été tenté
 */
export function applyStickToStripScroll(
  strip,
  localX,
  localY,
  speed = READER_STICK_SPEED,
) {
  if (!strip || typeof strip.scrollLeft !== 'number') return false;
  const s = Number(speed);
  const spd = Number.isFinite(s) && s > 0 ? s : READER_STICK_SPEED;
  const dx = Number(localX) || 0;
  const dy = Number(localY) || 0;
  if (dx === 0 && dy === 0) return false;
  // Inverse du translate pan : même direction visuelle que mode page.
  strip.scrollLeft -= dx * spd;
  strip.scrollTop -= dy * spd;
  return true;
}
