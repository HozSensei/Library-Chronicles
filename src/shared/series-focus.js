/**
 * Indices focus manette — fiche série (SeriesDetailView).
 * 0 … n-1 : tomes (ordre volume)
 * n : Ouvrir (tome focus / suivant)
 * n+1 : Retour
 */

export const SERIES_FOCUS_ACTIONS = {
  OPEN: 'open',
  BACK: 'back',
};

/**
 * @param {number} volumeCount
 */
export function seriesFocusMax(volumeCount) {
  const n = Math.max(0, Number(volumeCount) || 0);
  // volumes + OPEN + BACK — si aucun tome, seulement BACK
  return n > 0 ? n + 1 : 0;
}

/**
 * @param {number} index
 * @param {number} volumeCount
 */
export function clampSeriesFocus(index, volumeCount) {
  const max = seriesFocusMax(volumeCount);
  const n = Number(index);
  if (!Number.isFinite(n)) return volumeCount > 0 ? 0 : 0;
  return Math.max(0, Math.min(max, Math.trunc(n)));
}

/**
 * @param {number} index
 * @param {number} volumeCount
 * @returns {'volume'|'open'|'back'}
 */
export function seriesFocusKind(index, volumeCount) {
  const n = Math.max(0, Number(volumeCount) || 0);
  const i = clampSeriesFocus(index, n);
  if (n <= 0) return 'back';
  if (i < n) return 'volume';
  if (i === n) return 'open';
  return 'back';
}
