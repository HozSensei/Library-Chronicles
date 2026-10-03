/**
 * Remapping manette pour ROG Ally en orientation portrait.
 *
 * La console est tournée de 90° dans le sens anti-horaire (CCW) :
 * - poignée gauche (D-Pad + stick L) en bas
 * - poignée droite (ABXY + stick R) en haut
 *
 * Conséquence pour l’utilisateur qui regarde l’écran vertical :
 *   physique HAUT    → logique GAUCHE
 *   physique BAS     → logique DROITE
 *   physique GAUCHE  → logique HAUT
 *   physique DROITE  → logique BAS
 *
 * Toutes les actions UI/lecteur doivent raisonner en directions *logiques*
 * (repère écran), jamais en indices bruts du D-Pad XInput.
 */

export const DeviceOrientation = Object.freeze({
  /** Manette / écran alignés landscape (dev desktop). */
  LANDSCAPE: 'landscape',
  /** Ally tenue en portrait, rotation 90° CCW (défaut produit). */
  PORTRAIT_CCW: 'portrait-ccw',
});

/** Directions logiques (repère écran portrait). */
export const LogicalDir = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
});

/**
 * Bouton D-Pad physique (index Gamepad API) → direction logique.
 * @param {typeof DeviceOrientation[keyof typeof DeviceOrientation]} orientation
 * @param {'up'|'down'|'left'|'right'} physical
 */
export function remapDpad(orientation, physical) {
  if (orientation !== DeviceOrientation.PORTRAIT_CCW) return physical;

  switch (physical) {
    case 'up':
      return LogicalDir.LEFT;
    case 'down':
      return LogicalDir.RIGHT;
    case 'left':
      return LogicalDir.UP;
    case 'right':
      return LogicalDir.DOWN;
    default:
      return physical;
  }
}

/**
 * Axes stick physiques → axes logiques écran.
 * Convention Gamepad : x −1 gauche / +1 droite, y −1 haut / +1 bas.
 *
 * Portrait CCW :
 *   logicalX = physicalY
 *   logicalY = physicalX
 *
 * @returns {{ x: number, y: number }}
 */
export function remapStick(orientation, physicalX, physicalY) {
  if (orientation !== DeviceOrientation.PORTRAIT_CCW) {
    return { x: physicalX, y: physicalY };
  }
  return { x: physicalY, y: physicalX };
}

/**
 * Action lecture associée à une direction logique D-Pad.
 * Brief produit (repère écran) :
 *   ↑ / ↓  → zoom ±
 *   ← / →  → pages
 */
export function readingActionForLogicalDpad(dir) {
  switch (dir) {
    case LogicalDir.UP:
      return 'zoom-in';
    case LogicalDir.DOWN:
      return 'zoom-out';
    case LogicalDir.LEFT:
      return 'page-prev';
    case LogicalDir.RIGHT:
      return 'page-next';
    default:
      return null;
  }
}

/**
 * Action UI menu associée à une direction logique D-Pad.
 */
export function uiActionForLogicalDpad(dir) {
  switch (dir) {
    case LogicalDir.UP:
      return 'cursor-up';
    case LogicalDir.DOWN:
      return 'cursor-down';
    case LogicalDir.LEFT:
      return 'cursor-left';
    case LogicalDir.RIGHT:
      return 'cursor-right';
    default:
      return null;
  }
}
