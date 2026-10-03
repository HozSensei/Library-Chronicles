/**
 * Tailles de fenêtre selon l’orientation session.
 *
 * Stratégie B (Ally / Windows) :
 * - Menus et lecteur gardent une fenêtre **landscape** pleine (workArea).
 * - Le mode lecture « portrait » est une rotation CSS du plan lecteur,
 *   jamais un setBounds 1080×1920 (sinon clamp Ally → shrink 1080×1080).
 *
 * PORTRAIT_BOUNDS reste disponible pour référence / tests, mais
 * applySessionMode ne l’utilise plus pour la fenêtre Electron.
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
 * Taille fenêtre Electron. Stratégie B : toujours landscape (plein usage écran).
 * @param {string | undefined | null} _orientation
 */
export function boundsForOrientation(_orientation) {
  return LANDSCAPE_BOUNDS;
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
 * Stratégie B : toujours landscape, quel que soit `orientation`.
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

/**
 * Lecteur : toujours rotation CSS (stratégie B — fenêtre landscape fixe).
 * Les menus n’activent jamais la rotation.
 *
 * @param {string | undefined | null} orientation
 * @param {{ width: number, height: number }} [_appliedSize]
 * @returns {boolean}
 */
export function needsCssPortraitRotate(orientation, _appliedSize) {
  return orientation === 'portrait-ccw';
}
