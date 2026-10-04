/**
 * Champs sélectionnables à l’apply méta (modal checklist).
 * Defaults : tous cochés. Manette : ↑↓ focus, A toggle, Confirm apply.
 */

export const META_APPLY_FIELD_IDS = Object.freeze([
  'title',
  'cover',
  'series',
  'volume',
  'author',
  'year',
  'synopsis',
]);

export const META_APPLY_FIELDS = Object.freeze([
  { id: 'title', label: 'Titre', patchKey: 'title' },
  { id: 'cover', label: 'Jaquette', patchKey: 'coverUrl' },
  { id: 'series', label: 'Série', patchKey: 'series' },
  { id: 'volume', label: 'N° tome', patchKey: 'volume' },
  { id: 'author', label: 'Auteur', patchKey: 'author' },
  { id: 'year', label: 'Année', patchKey: 'year' },
  { id: 'synopsis', label: 'Synopsis', patchKey: 'description' },
]);

/** Index focus : 0..fields-1 = cases, last = bouton Appliquer. */
export const META_APPLY_FOCUS = Object.freeze({
  FIELD_MAX: META_APPLY_FIELDS.length - 1,
  APPLY: META_APPLY_FIELDS.length,
  MAX: META_APPLY_FIELDS.length,
});

/**
 * @returns {Record<string, boolean>}
 */
export function defaultMetaApplySelection() {
  /** @type {Record<string, boolean>} */
  const out = {};
  for (const id of META_APPLY_FIELD_IDS) out[id] = true;
  return out;
}

/**
 * @param {number} index
 */
export function clampMetaApplyFocus(index) {
  const n = Number(index);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(META_APPLY_FOCUS.MAX, Math.trunc(n)));
}

/**
 * Filtre un patch draft selon la sélection de champs.
 * @param {object|null|undefined} patch
 * @param {Record<string, boolean>|null|undefined} selection
 * @returns {object}
 */
export function filterMetaPatchBySelection(patch, selection) {
  const src = patch && typeof patch === 'object' ? patch : {};
  const sel =
    selection && typeof selection === 'object'
      ? selection
      : defaultMetaApplySelection();
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const field of META_APPLY_FIELDS) {
    if (!sel[field.id]) continue;
    if (src[field.patchKey] !== undefined) {
      out[field.patchKey] = src[field.patchKey];
    }
  }
  // source / provider suivent si au moins un champ méta texte est pris
  if (
    sel.title ||
    sel.series ||
    sel.author ||
    sel.year ||
    sel.synopsis ||
    sel.cover
  ) {
    if (src.source !== undefined) out.source = src.source;
    if (src.provider !== undefined) out.provider = src.provider;
  }
  return out;
}

/**
 * Au moins un champ coché ?
 * @param {Record<string, boolean>|null|undefined} selection
 */
export function hasMetaApplySelection(selection) {
  const sel = selection || {};
  return META_APPLY_FIELD_IDS.some((id) => Boolean(sel[id]));
}
