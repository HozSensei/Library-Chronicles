/**
 * Couleurs d’icône profil — alignées sur les swatches d’accent (`theme-accents`).
 */

/** @type {readonly string[]} */
export const AVATAR_COLORS = Object.freeze([
  '#c4a35a', // amber / laiton
  '#4a7eb5', // blue
  '#d4843a', // orange
  '#4a9b6e', // green
  '#c47a8a', // rose
  '#8b6b9e', // violet
]);

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeAvatarColor(value) {
  const hex = String(value || '').trim().toLowerCase();
  if (AVATAR_COLORS.includes(hex)) return hex;
  // Hex #rrggbb hors palette (profils legacy) conservé.
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  return AVATAR_COLORS[0];
}
