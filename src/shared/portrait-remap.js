/**
 * Remapping manette pour ROG Ally en orientation portrait.
 *
 * La console est tournée de 90° dans le sens anti-horaire (CCW) :
 * - poignée gauche (D-Pad + stick L) en bas
 * - poignée droite (ABXY + stick R) en haut
 *
 * Conséquence pour l’utilisateur qui regarde l’écran vertical :
 *   physique HAUT    → logique GAUCHE   (haut natif pointe à gauche)
 *   physique BAS     → logique DROITE
 *   physique GAUCHE  → logique BAS      (gauche natif pointe vers le D-Pad / bas)
 *   physique DROITE  → logique HAUT     (droite natif pointe vers ABXY / haut)
 *
 * Le plan lecteur CSS est tourné de +90° (CW) pour que la planche soit
 * à l’endroit dans ce hold — pan stick : même +90° via visualPanToLocal.
 *
 * Toutes les actions UI/lecteur doivent raisonner en directions *logiques*
 * (repère écran utilisateur), jamais en indices bruts du D-Pad XInput.
 *
 * IMPORTANT — remap portrait UNIQUEMENT en mode lecture.
 * Menus (setup / profils / biblio / import / fiche / paramètres) = landscape
 * (identité : Haut=Haut, Gauche=Gauche). Ne jamais dériver du config.orientation
 * seul : un portrait résiduel après crash laissait les menus remappés.
 */

export const DeviceOrientation = Object.freeze({
  /** Manette / écran alignés landscape (menus / défaut). */
  LANDSCAPE: 'landscape',
  /** Ally tenue en portrait, rotation 90° CCW (lecteur uniquement). */
  PORTRAIT_CCW: 'portrait-ccw',
});

/** Directions logiques (repère écran utilisateur). */
export const LogicalDir = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
});

/**
 * Orientation manette dérivée STRICTEMENT de la route.
 * Seul `reader` active le remap portrait — jamais la config persistée.
 * @param {string | null | undefined} routeName
 * @returns {typeof DeviceOrientation[keyof typeof DeviceOrientation]}
 */
export function sessionOrientationForRoute(routeName) {
  return routeName === 'reader'
    ? DeviceOrientation.PORTRAIT_CCW
    : DeviceOrientation.LANDSCAPE;
}

/**
 * Mode session fenêtre : ui (landscape) | reader (portrait logique).
 * @param {string | null | undefined} routeName
 * @returns {'ui'|'reader'}
 */
export function sessionModeForRoute(routeName) {
  return routeName === 'reader' ? 'reader' : 'ui';
}

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
      return LogicalDir.DOWN;
    case 'right':
      return LogicalDir.UP;
    default:
      return physical;
  }
}

/**
 * Axes stick physiques → axes logiques écran utilisateur.
 * Convention Gamepad : x −1 gauche / +1 droite, y −1 haut / +1 bas.
 *
 * Portrait CCW (D-Pad en bas) :
 *   logicalX = physicalY
 *   logicalY = −physicalX
 *
 * @returns {{ x: number, y: number }}
 */
export function remapStick(orientation, physicalX, physicalY) {
  if (orientation !== DeviceOrientation.PORTRAIT_CCW) {
    return { x: physicalX, y: physicalY };
  }
  return { x: physicalY, y: -physicalX };
}

/**
 * Pan stick → repère local du plan lecteur sous CSS `rotate(90deg)` CW.
 *
 * Règle unique : **rotate stick like the page** — même +90° CW que le plan
 * (ReaderView `.reader__plane`), appliquée aux axes stick *physiques*
 * (= identité landscape des menus), pas au remap portrait CCW.
 *
 * Repère Gamepad / CSS (Y ↓) : rotation CW 90°
 *   (x, y) → (−y, x)
 * donc :
 *   localX = −stickY
 *   localY =  stickX
 *
 * | Stick physique | local après +90° CW |
 * |----------------|---------------------|
 * | Haut  (0,−1)   | (+1, 0)             |
 * | Bas   (0,+1)   | (−1, 0)             |
 * | Gauche (−1,0)  | (0,−1)              |
 * | Droite (+1,0)  | (0,+1)              |
 *
 * Ne pas toucher remapStick : menus landscape + modal pause / D-Pad en dépendent.
 *
 * @param {number} stickX axes stick physiques (ou landscape identité)
 * @param {number} stickY
 * @returns {{ x: number, y: number }}
 */
export function visualPanToLocal(stickX, stickY) {
  return { x: -stickY, y: stickX };
}

/**
 * Direction de glissement écran de la page pour un stick physique, une fois
 * passé par visualPanToLocal (+90° CW) puis le plan CSS rotate(90deg).
 * Composition : écran ≈ −stick (même rotation stick + page).
 * @param {number} stickX
 * @param {number} stickY
 * @returns {'up'|'down'|'left'|'right'|null}
 */
export function pageSlideFromVisualPan(stickX, stickY) {
  const local = visualPanToLocal(stickX, stickY);
  // rotate(90deg) CW sur le plan : screenX = −localY, screenY = localX
  const screenX = -local.y;
  const screenY = local.x;
  const ax = Math.abs(screenX);
  const ay = Math.abs(screenY);
  if (ax < 1e-9 && ay < 1e-9) return null;
  if (ax >= ay) return screenX > 0 ? LogicalDir.RIGHT : LogicalDir.LEFT;
  return screenY > 0 ? LogicalDir.DOWN : LogicalDir.UP;
}

/**
 * Action lecture associée à une direction logique D-Pad.
 * Spec UX (repère écran portrait) — axes invertis :
 *   ← / →  → pages
 *   ↑ = zoom + · ↓ = zoom −
 */
export function readingActionForLogicalDpad(dir) {
  switch (dir) {
    case LogicalDir.LEFT:
      return 'page-prev';
    case LogicalDir.RIGHT:
      return 'page-next';
    case LogicalDir.UP:
      return 'zoom-in';
    case LogicalDir.DOWN:
      return 'zoom-out';
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
