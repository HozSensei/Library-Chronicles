/**
 * Grille de focus Paramètres.
 * Rangées horizontales (thème, accents) : ←→ dans la rangée, ↑↓ change de rangée.
 * Items sans `data-focus-row` (ou rangée à 1 colonne) : ←→ alias ↑↓ (liste verticale).
 */

import { indexToRowCol, moveSetupFocus } from './setup-focus.js';

/**
 * Groupe les clés de rangée consécutives identiques.
 * `null` / vide = singleton (chaque item sa propre rangée).
 *
 * @param {Array<string|null|undefined>} rowKeys
 * @returns {number[][]} indices plats par rangée
 */
export function groupSettingsFocusRows(rowKeys) {
  /** @type {{ key: string|null, indices: number[] }[]} */
  const groups = [];
  for (let i = 0; i < rowKeys.length; i += 1) {
    const raw = rowKeys[i];
    const key =
      raw == null || String(raw).trim() === '' ? null : String(raw);
    const last = groups[groups.length - 1];
    if (key != null && last && last.key === key) {
      last.indices.push(i);
    } else {
      groups.push({ key, indices: [i] });
    }
  }
  return groups.map((g) => g.indices);
}

/**
 * Construit la grille depuis les nœuds `[data-settings-item]`.
 * @param {Iterable<{ getAttribute?: (name: string) => string|null }>} elements
 * @returns {number[][]}
 */
export function settingsFocusRowsFromElements(elements) {
  const keys = [...elements].map((el) =>
    el?.getAttribute ? el.getAttribute('data-focus-row') : null,
  );
  return groupSettingsFocusRows(keys);
}

/**
 * @param {number[][]} rows indices plats par rangée (contigus 0..n-1)
 * @param {number} index
 * @param {'up'|'down'|'left'|'right'} dir
 * @returns {number}
 */
export function moveSettingsFocus(rows, index, dir) {
  if (!rows.length) return 0;
  const { row } = indexToRowCol(rows, index);
  const rowLen = rows[row]?.length || 1;

  // Liste verticale (1 col) : ←→ = ↑↓ pour garder le pad usable hors rangées.
  let effective = dir;
  if (rowLen === 1) {
    if (dir === 'left') effective = 'up';
    if (dir === 'right') effective = 'down';
  }

  return moveSetupFocus(rows, index, effective);
}
