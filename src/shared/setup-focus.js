/**
 * Grille de focus setup : rangées d’items côte à côte.
 * ↑↓ change de rangée · ←→ navigue dans la rangée.
 * Confirm/A active l’item (ex. Parcourir) — jamais ←→.
 */

import { accentFocusIds } from './theme-accents.js';

/** @typedef {string} FocusId */

/**
 * Rangées focusables par étape setup.
 * @param {number} step
 * @returns {FocusId[][]}
 */
export function setupFocusRows(step) {
  if (step === 0) return [['next']];
  if (step === 1) return [['library', 'import'], ['next']];
  if (step === 2) {
    return [
      ['theme-dark', 'theme-light'],
      accentFocusIds(),
      ['lang-fr'],
      ['next'],
    ];
  }
  return [['finish']];
}

/**
 * Liste plate (compat index linéaire).
 * @param {number} step
 */
export function setupFocusables(step) {
  return setupFocusRows(step).flat();
}

/**
 * @param {FocusId[][]} rows
 * @param {number} index index linéaire dans flat()
 * @returns {{ row: number, col: number }}
 */
export function indexToRowCol(rows, index) {
  let remaining = Math.max(0, index);
  for (let r = 0; r < rows.length; r += 1) {
    const len = rows[r].length;
    if (remaining < len) return { row: r, col: remaining };
    remaining -= len;
  }
  const last = Math.max(0, rows.length - 1);
  return { row: last, col: Math.max(0, (rows[last]?.length || 1) - 1) };
}

/**
 * @param {FocusId[][]} rows
 * @param {number} row
 * @param {number} col
 */
export function rowColToIndex(rows, row, col) {
  let index = 0;
  const rClamp = Math.max(0, Math.min(row, rows.length - 1));
  for (let r = 0; r < rClamp; r += 1) index += rows[r].length;
  const cClamp = Math.max(0, Math.min(col, (rows[rClamp]?.length || 1) - 1));
  return index + cClamp;
}

/**
 * Déplace le focus dans la grille.
 * @param {FocusId[][]} rows
 * @param {number} index
 * @param {'up'|'down'|'left'|'right'} dir
 * @returns {number} nouvel index linéaire
 */
export function moveSetupFocus(rows, index, dir) {
  if (!rows.length) return 0;
  const { row, col } = indexToRowCol(rows, index);

  if (dir === 'left') {
    if (col > 0) return rowColToIndex(rows, row, col - 1);
    return rowColToIndex(rows, row, col);
  }
  if (dir === 'right') {
    const maxCol = (rows[row]?.length || 1) - 1;
    if (col < maxCol) return rowColToIndex(rows, row, col + 1);
    return rowColToIndex(rows, row, col);
  }
  if (dir === 'up') {
    if (row <= 0) return rowColToIndex(rows, row, col);
    const prev = rows[row - 1];
    const nextCol = Math.min(col, prev.length - 1);
    return rowColToIndex(rows, row - 1, nextCol);
  }
  if (dir === 'down') {
    if (row >= rows.length - 1) return rowColToIndex(rows, row, col);
    const next = rows[row + 1];
    const nextCol = Math.min(col, next.length - 1);
    return rowColToIndex(rows, row + 1, nextCol);
  }
  return index;
}

/** Ids qui ouvrent un sélecteur de dossier — uniquement via Confirm. */
export const SETUP_FOLDER_IDS = new Set(['library', 'import']);
