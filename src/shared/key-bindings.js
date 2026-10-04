/**
 * Mapping manette utilisateur — actions ↔ boutons / D-Pad logique.
 * Le remap portrait s’applique AVANT la résolution de ce mapping.
 */

import { GamepadButtons } from './gamepad-codes.js';

/** @typedef {'reader'|'library'|'book'|'setup'|'import'|'settings'|'boot'|'profiles'} BindingContext */

export const BINDABLE_ACTIONS = Object.freeze({
  reader: [
    { id: 'toggle-direction', label: 'Sens LTR / RTL' },
    { id: 'close-book', label: 'Fermer le livre' },
    { id: 'toggle-overlay', label: 'Afficher / masquer HUD' },
    { id: 'toggle-zoom', label: 'Toggle Fit Height / Fit Width' },
    { id: 'zoom-in', label: 'Zoom +' },
    { id: 'zoom-out', label: 'Zoom −' },
    { id: 'page-prev', label: 'Page précédente' },
    { id: 'page-next', label: 'Page suivante' },
    { id: 'chapter-prev', label: 'Chapitre précédent' },
    { id: 'chapter-next', label: 'Chapitre suivant' },
    { id: 'fit-width', label: 'Fit Width' },
    { id: 'pan', label: 'Pan / scroll (stick)' },
    { id: 'add-bookmark', label: 'Ajouter un signet' },
    { id: 'toggle-pause', label: 'Menu pause lecture' },
    { id: 'next-volume', label: 'Tome suivant (série)' },
    { id: 'prev-volume', label: 'Tome précédent (série)' },
  ],
  library: [
    { id: 'open-book', label: 'Ouvrir fiche' },
    { id: 'book-options', label: 'Options du livre' },
    { id: 'cursor-up', label: 'Curseur ↑' },
    { id: 'cursor-down', label: 'Curseur ↓' },
    { id: 'cursor-left', label: 'Curseur ←' },
    { id: 'cursor-right', label: 'Curseur →' },
    { id: 'tab-prev', label: 'Onglet catalogue ← (LB)' },
    { id: 'tab-next', label: 'Onglet catalogue → (RB)' },
    { id: 'filter-prev', label: 'Filtre précédent (LT)' },
    { id: 'filter-next', label: 'Filtre suivant (RT)' },
    { id: 'confirm', label: 'Valider' },
    { id: 'import', label: 'Ouvrir import' },
    { id: 'settings', label: 'Paramètres' },
    { id: 'toggle-series', label: 'Vue séries' },
  ],
  book: [
    { id: 'open-book', label: 'Lire' },
    { id: 'back', label: 'Retour' },
    { id: 'book-options', label: 'Options' },
    { id: 'cursor-up', label: 'Curseur ↑' },
    { id: 'cursor-down', label: 'Curseur ↓' },
    { id: 'cursor-left', label: 'Curseur ←' },
    { id: 'cursor-right', label: 'Curseur →' },
    { id: 'confirm', label: 'Valider' },
    { id: 'import', label: 'Import' },
    { id: 'settings', label: 'Paramètres' },
  ],
  boot: [
    { id: 'cursor-up', label: 'Curseur ↑' },
    { id: 'cursor-down', label: 'Curseur ↓' },
    { id: 'confirm', label: 'Valider' },
  ],
  profiles: [
    { id: 'cursor-up', label: 'Curseur ↑' },
    { id: 'cursor-down', label: 'Curseur ↓' },
    { id: 'cursor-left', label: 'Curseur ←' },
    { id: 'cursor-right', label: 'Curseur →' },
    { id: 'confirm', label: 'Choisir / valider' },
    { id: 'rename', label: 'Renommer le profil' },
    { id: 'back', label: 'Annuler saisie' },
  ],
  setup: [
    { id: 'cursor-up', label: 'Rangée ↑' },
    { id: 'cursor-down', label: 'Rangée ↓' },
    { id: 'cursor-left', label: 'Option ←' },
    { id: 'cursor-right', label: 'Option →' },
    { id: 'confirm', label: 'Valider / parcourir' },
    { id: 'back', label: 'Étape précédente' },
  ],
  import: [
    { id: 'cursor-up', label: 'Curseur ↑' },
    { id: 'cursor-down', label: 'Curseur ↓' },
    { id: 'cursor-left', label: 'Focus ←' },
    { id: 'cursor-right', label: 'Focus →' },
    { id: 'confirm', label: 'Détail / valider' },
    { id: 'back', label: 'Retour' },
    { id: 'import-one', label: 'Importer le tome focus' },
    { id: 'import-all', label: 'Tout importer' },
    { id: 'tab-prev', label: 'Onglet Infos ← (LB)' },
    { id: 'tab-next', label: 'Onglet Recherche → (RB)' },
  ],
  settings: [
    { id: 'cursor-up', label: 'Curseur ↑' },
    { id: 'cursor-down', label: 'Curseur ↓' },
    { id: 'cursor-left', label: 'Curseur ←' },
    { id: 'cursor-right', label: 'Curseur →' },
    { id: 'tab-prev', label: 'Section précédente' },
    { id: 'tab-next', label: 'Section suivante' },
    { id: 'confirm', label: 'modifier / écouter' },
    { id: 'back', label: 'Retour' },
  ],
});

/** Seul contexte exposé dans l’UI remap Paramètres. */
export const REMAP_UI_CONTEXT = 'reader';

/**
 * Clés de binding :
 * - `button:<index>` — bouton Gamepad API
 * - `dpad:<dir>` — direction logique après remap portrait
 * - `stick:left` — stick gauche (pan / scroll)
 */
export const DEFAULT_KEY_BINDINGS = Object.freeze({
  reader: {
    [`button:${GamepadButtons.A}`]: 'toggle-direction',
    [`button:${GamepadButtons.B}`]: 'close-book',
    [`button:${GamepadButtons.Y}`]: 'toggle-overlay',
    [`button:${GamepadButtons.X}`]: 'add-bookmark',
    /** Select / View → menu pause lecture */
    [`button:${GamepadButtons.SELECT}`]: 'toggle-pause',
    [`button:${GamepadButtons.LB}`]: 'fit-width',
    [`button:${GamepadButtons.L3}`]: 'toggle-zoom',
    [`button:${GamepadButtons.R3}`]: 'toggle-zoom',
    [`button:${GamepadButtons.LT}`]: 'chapter-prev',
    [`button:${GamepadButtons.RT}`]: 'chapter-next',
    [`button:${GamepadButtons.RB}`]: 'next-volume',
    /**
     * Spec UX : axes invertis (ex-zoom ↔ ex-pages).
     * ← / →  → pages · ↑ = zoom + · ↓ = zoom − (repère logique post-remap)
     */
    'dpad:left': 'page-prev',
    'dpad:right': 'page-next',
    'dpad:up': 'zoom-in',
    'dpad:down': 'zoom-out',
    'stick:left': 'pan',
  },
  library: {
    [`button:${GamepadButtons.A}`]: 'open-book',
    /** B = no-op : bibliothèque = accueil (pas de retour boot). */
    [`button:${GamepadButtons.Y}`]: 'book-options',
    [`button:${GamepadButtons.X}`]: 'import',
    [`button:${GamepadButtons.SELECT}`]: 'toggle-series',
    [`button:${GamepadButtons.START}`]: 'settings',
    [`button:${GamepadButtons.L3}`]: 'confirm',
    [`button:${GamepadButtons.R3}`]: 'confirm',
    /** LB / RB = onglets Bibliothèque / Tous / Récents / Séries */
    [`button:${GamepadButtons.LB}`]: 'tab-prev',
    [`button:${GamepadButtons.RB}`]: 'tab-next',
    /** LT / RT = filtre statut */
    [`button:${GamepadButtons.LT}`]: 'filter-prev',
    [`button:${GamepadButtons.RT}`]: 'filter-next',
    'dpad:up': 'cursor-up',
    'dpad:down': 'cursor-down',
    'dpad:left': 'cursor-left',
    'dpad:right': 'cursor-right',
    'stick:left': 'scroll',
  },
  book: {
    [`button:${GamepadButtons.A}`]: 'open-book',
    [`button:${GamepadButtons.B}`]: 'back',
    [`button:${GamepadButtons.Y}`]: 'book-options',
    [`button:${GamepadButtons.X}`]: 'import',
    [`button:${GamepadButtons.START}`]: 'settings',
    'dpad:up': 'cursor-up',
    'dpad:down': 'cursor-down',
    'dpad:left': 'cursor-left',
    'dpad:right': 'cursor-right',
    'stick:left': 'scroll',
  },
  boot: {
    [`button:${GamepadButtons.A}`]: 'confirm',
    'dpad:up': 'cursor-up',
    'dpad:down': 'cursor-down',
    'stick:left': 'scroll',
  },
  profiles: {
    [`button:${GamepadButtons.A}`]: 'confirm',
    [`button:${GamepadButtons.B}`]: 'back',
    [`button:${GamepadButtons.Y}`]: 'rename',
    'dpad:up': 'cursor-up',
    'dpad:down': 'cursor-down',
    'dpad:left': 'cursor-left',
    'dpad:right': 'cursor-right',
    'stick:left': 'scroll',
  },
  setup: {
    [`button:${GamepadButtons.A}`]: 'confirm',
    [`button:${GamepadButtons.B}`]: 'back',
    'dpad:up': 'cursor-up',
    'dpad:down': 'cursor-down',
    'dpad:left': 'cursor-left',
    'dpad:right': 'cursor-right',
  },
  import: {
    [`button:${GamepadButtons.A}`]: 'confirm',
    [`button:${GamepadButtons.B}`]: 'back',
    /** X = un tome (focus) · Y = tous — méta sélectionnées ou défaut */
    [`button:${GamepadButtons.X}`]: 'import-one',
    [`button:${GamepadButtons.Y}`]: 'import-all',
    /** LB / RB = onglets Infos ↔ Recherche (comme catalogue) */
    [`button:${GamepadButtons.LB}`]: 'tab-prev',
    [`button:${GamepadButtons.RB}`]: 'tab-next',
    'dpad:up': 'cursor-up',
    'dpad:down': 'cursor-down',
    'dpad:left': 'cursor-left',
    'dpad:right': 'cursor-right',
  },
  settings: {
    [`button:${GamepadButtons.A}`]: 'confirm',
    [`button:${GamepadButtons.B}`]: 'back',
    /** LT / RT = changer de section Paramètres */
    [`button:${GamepadButtons.LT}`]: 'tab-prev',
    [`button:${GamepadButtons.RT}`]: 'tab-next',
    /** D-Pad / stick = focus dans la section (providers, champs, liens…) */
    'dpad:up': 'cursor-up',
    'dpad:down': 'cursor-down',
    'dpad:left': 'cursor-left',
    'dpad:right': 'cursor-right',
  },
});

/**
 * Fusionne les bindings utilisateur par-dessus les défauts.
 * @param {Record<string, Record<string, string>>|null|undefined} user
 */
export function resolveKeyBindings(user) {
  const out = {};
  for (const ctx of Object.keys(DEFAULT_KEY_BINDINGS)) {
    out[ctx] = {
      ...DEFAULT_KEY_BINDINGS[ctx],
      ...(user?.[ctx] || {}),
    };
  }
  return out;
}

/**
 * Résout l’action pour un contexte + clé de binding.
 * @param {Record<string, Record<string, string>>} bindings
 * @param {BindingContext} context
 * @param {string} key
 */
export function actionForBinding(bindings, context, key) {
  const map = bindings?.[context] || DEFAULT_KEY_BINDINGS[context] || {};
  return map[key] || null;
}

/** Libellé lisible d’une clé de binding. */
export function labelForBindingKey(key) {
  if (key.startsWith('button:')) {
    const idx = Number(key.slice(7));
    const names = {
      [GamepadButtons.A]: 'A',
      [GamepadButtons.B]: 'B',
      [GamepadButtons.X]: 'X',
      [GamepadButtons.Y]: 'Y',
      [GamepadButtons.LB]: 'LB',
      [GamepadButtons.RB]: 'RB',
      [GamepadButtons.LT]: 'LT',
      [GamepadButtons.RT]: 'RT',
      [GamepadButtons.SELECT]: 'Select',
      [GamepadButtons.START]: 'Start',
      [GamepadButtons.L3]: 'L3',
      [GamepadButtons.R3]: 'R3',
      [GamepadButtons.DPAD_UP]: 'D-Pad ↑',
      [GamepadButtons.DPAD_DOWN]: 'D-Pad ↓',
      [GamepadButtons.DPAD_LEFT]: 'D-Pad ←',
      [GamepadButtons.DPAD_RIGHT]: 'D-Pad →',
    };
    return names[idx] || `Bouton ${idx}`;
  }
  if (key.startsWith('dpad:')) {
    const dir = key.slice(5);
    const map = { up: 'D-Pad ↑', down: 'D-Pad ↓', left: 'D-Pad ←', right: 'D-Pad →' };
    return map[dir] || key;
  }
  if (key === 'stick:left') return 'Stick L';
  if (key === 'stick:right') return 'Stick R';
  return key;
}
