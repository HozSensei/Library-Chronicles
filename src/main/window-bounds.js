/**
 * Tailles de fenêtre selon l’orientation session.
 * landscape (défaut UI) · portrait-ccw (mode lecture Ally verticale).
 */

export const PORTRAIT_BOUNDS = Object.freeze({
  width: 1080,
  height: 1920,
  minWidth: 540,
  minHeight: 960,
});

export const LANDSCAPE_BOUNDS = Object.freeze({
  width: 1920,
  height: 1080,
  minWidth: 960,
  minHeight: 540,
});

/**
 * @param {string | undefined | null} orientation
 */
export function boundsForOrientation(orientation) {
  // Défaut produit = landscape (menus). Portrait uniquement en lecture.
  return orientation === 'portrait-ccw' ? PORTRAIT_BOUNDS : LANDSCAPE_BOUNDS;
}

/**
 * Applique taille / minSize à une BrowserWindow sans maximiser.
 * @param {import('electron').BrowserWindow | null} win
 * @param {string | undefined | null} orientation
 */
export function applyWindowOrientation(win, orientation) {
  if (!win || win.isDestroyed()) return boundsForOrientation(orientation);
  const bounds = boundsForOrientation(orientation);
  win.setMinimumSize(bounds.minWidth, bounds.minHeight);
  if (win.isMaximized()) win.unmaximize();
  const [cx, cy] = win.getPosition();
  const { width, height } = bounds;
  // Recentrer légèrement si la fenêtre sort de l’écran
  win.setSize(width, height, true);
  win.setPosition(Math.max(0, cx), Math.max(0, cy));
  return bounds;
}
