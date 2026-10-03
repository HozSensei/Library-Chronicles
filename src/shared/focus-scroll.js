/**
 * Fait défiler le conteneur pour garder l’élément focalisé (manette) visible.
 * Utilisé après chaque déplacement D-Pad / stick dans les menus.
 *
 * @param {string} [rootSelector] sélecteur optionnel pour limiter la recherche
 * @param {{ behavior?: ScrollBehavior }} [opts]
 */
export function scrollFocusedIntoView(rootSelector = '', opts = {}) {
  if (typeof document === 'undefined') return false;
  const behavior = opts.behavior || 'smooth';
  const scoped = rootSelector
    ? `${rootSelector} .is-focused`
    : '.is-focused';
  const el =
    document.querySelector(scoped) ||
    document.querySelector('.is-focused');
  if (!el || typeof el.scrollIntoView !== 'function') return false;
  el.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    behavior,
  });
  return true;
}

/**
 * Planifie le scroll après le prochain paint (DOM focus class mis à jour).
 * @param {string} [rootSelector]
 */
export function scheduleScrollFocusedIntoView(rootSelector = '') {
  if (typeof requestAnimationFrame === 'undefined') {
    return scrollFocusedIntoView(rootSelector, { behavior: 'auto' });
  }
  requestAnimationFrame(() => {
    scrollFocusedIntoView(rootSelector);
  });
  return true;
}

/** Racine DOM par route pour cibler le bon conteneur scrollable. */
export function focusRootForRoute(routeName) {
  switch (routeName) {
    case 'library':
      return '.catalog';
    case 'book':
      return '.book-detail';
    case 'series':
      return '.series-detail';
    case 'setup':
      return '.setup';
    case 'profiles':
      return '.profiles';
    case 'import':
      return '.import';
    case 'settings':
      return '.settings';
    case 'boot':
      return '.boot';
    case 'reader':
      return '.reader';
    default:
      return '';
  }
}
