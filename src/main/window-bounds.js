/**
 * Tailles de fenêtre selon l’orientation session.
 * landscape (défaut UI) · portrait-ccw (mode lecture Ally verticale).
 *
 * Toujours clamper à workAreaSize pour ne jamais dépasser l’écran,
 * recentrer, et éviter un fullscreen involontaire.
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
 * Clamp une taille désirée à l’aire utile de l’écran (hors barre des tâches).
 * @param {{ width: number, height: number, minWidth?: number, minHeight?: number }} desired
 * @param {{ width: number, height: number, x?: number, y?: number } | null | undefined} workArea
 */
export function clampSizeToWorkArea(desired, workArea) {
  const waW = Math.max(320, Number(workArea?.width) || desired.width);
  const waH = Math.max(240, Number(workArea?.height) || desired.height);
  const width = Math.min(desired.width, waW);
  const height = Math.min(desired.height, waH);
  const minWidth = Math.min(desired.minWidth ?? width, width);
  const minHeight = Math.min(desired.minHeight ?? height, height);
  return { width, height, minWidth, minHeight };
}

/**
 * Position centrée dans le workArea (coordonnées écran).
 * @param {{ width: number, height: number }} size
 * @param {{ width: number, height: number, x?: number, y?: number } | null | undefined} workArea
 */
export function centerInWorkArea(size, workArea) {
  const areaX = Number(workArea?.x) || 0;
  const areaY = Number(workArea?.y) || 0;
  const waW = Math.max(1, Number(workArea?.width) || size.width);
  const waH = Math.max(1, Number(workArea?.height) || size.height);
  const x = Math.round(areaX + (waW - size.width) / 2);
  const y = Math.round(areaY + (waH - size.height) / 2);
  return { x, y, width: size.width, height: size.height };
}

/**
 * Applique taille / minSize à une BrowserWindow sans maximiser ni fullscreen.
 * @param {import('electron').BrowserWindow | null} win
 * @param {string | undefined | null} orientation
 * @param {{ width: number, height: number, x?: number, y?: number } | null | undefined} [workArea]
 */
export function applyWindowOrientation(win, orientation, workArea) {
  const desired = boundsForOrientation(orientation);
  const area = workArea || {
    width: desired.width,
    height: desired.height,
    x: 0,
    y: 0,
  };
  const clamped = clampSizeToWorkArea(desired, area);
  if (!win || win.isDestroyed()) return clamped;

  if (typeof win.isFullScreen === 'function' && win.isFullScreen()) {
    win.setFullScreen(false);
  }
  if (win.isMaximized()) win.unmaximize();

  win.setMinimumSize(clamped.minWidth, clamped.minHeight);
  const centered = centerInWorkArea(clamped, area);
  win.setBounds(
    {
      x: centered.x,
      y: centered.y,
      width: clamped.width,
      height: clamped.height,
    },
    true,
  );
  return clamped;
}

/**
 * True si la fenêtre a déjà la taille (et orientation) cible — évite un setBounds inutile.
 * @param {import('electron').BrowserWindow | null} win
 * @param {{ width: number, height: number }} target
 */
export function windowMatchesSize(win, target) {
  if (!win || win.isDestroyed()) return false;
  const [w, h] = win.getSize();
  return w === target.width && h === target.height;
}
