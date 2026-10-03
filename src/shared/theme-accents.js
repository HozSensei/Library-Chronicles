/**
 * Thème clair/sombre + accent de contraste (hors palette Steam Deck).
 * Persistance : prefs profil + miroir config `theme` / `accent`.
 */

/** @typedef {'blue'|'orange'|'green'|'amber'|'rose'|'violet'} AccentId */

/** @type {{ id: AccentId, label: string, swatch: string }[]} */
export const ACCENTS = [
  { id: 'blue', label: 'Bleu', swatch: '#4a7eb5' },
  { id: 'orange', label: 'Orange', swatch: '#d4843a' },
  { id: 'green', label: 'Vert', swatch: '#4a9b6e' },
  { id: 'amber', label: 'Laiton', swatch: '#c4a35a' },
  { id: 'rose', label: 'Rose', swatch: '#c47a8a' },
  { id: 'violet', label: 'Violet', swatch: '#8b6b9e' },
];

export const ACCENT_IDS = ACCENTS.map((a) => a.id);

/** Accent par défaut — laiton, distinct du cyan Steam. */
export const DEFAULT_ACCENT = 'amber';

export const DEFAULT_THEME = 'dark';

/**
 * @param {unknown} value
 * @returns {AccentId}
 */
export function normalizeAccent(value) {
  const id = String(value || '').toLowerCase();
  return ACCENT_IDS.includes(id) ? /** @type {AccentId} */ (id) : DEFAULT_ACCENT;
}

/**
 * @param {unknown} value
 * @returns {'dark'|'light'}
 */
export function normalizeTheme(value) {
  return value === 'light' ? 'light' : 'dark';
}

/**
 * @param {AccentId|string} id
 */
export function accentLabel(id) {
  return (
    ACCENTS.find((a) => a.id === id)?.label ||
    ACCENTS.find((a) => a.id === DEFAULT_ACCENT).label
  );
}

/** Ids focus setup pour la rangée d’accents. */
export function accentFocusIds() {
  return ACCENT_IDS.map((id) => `accent-${id}`);
}
