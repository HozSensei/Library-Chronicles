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
 * à l’endroit dans ce hold — voir ReaderView + visualPanToLocal.
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
 * Convertit un pan en repère utilisateur (visuel / logique) vers le repère
 * local du plan lecteur tourné de +90° CSS (CW).
 *
 * Spec pan stick lecture (directions = écran logique) :
 *   Haut    → la page glisse vers la droite
 *   Bas     → la page glisse vers la gauche
 *   Gauche  → la page glisse vers le haut
 *   Droite  → la page glisse vers le bas
 *
 * Sous rotate(90deg) CW, local(+X) apparaît à droite écran utilisateur et
 * local(+Y) vers le bas. La spec ci-dessus impose donc :
 *
 *   localX = −visualY
 *   localY =  visualX
 *
 * Chaîne Ally CCW (D-Pad en bas), stick vers le haut de l’écran :
 *   physique → (1,0) → remapStick → logique ↑ (0,−1)
 *   → visualPanToLocal → local (+1, 0) → page glisse à droite
 *
 * Ne pas toucher remapStick ici : menus / modal pause / D-Pad en dépendent.
 *
 * @param {number} visualX
 * @param {number} visualY
 * @returns {{ x: number, y: number }}
 */
export function visualPanToLocal(visualX, visualY) {
  return { x: -visualY, y: visualX };
}

/**
 * Direction de glissement de la page (repère écran utilisateur) pour un
 * pan logique, une fois appliqué via visualPanToLocal sous +90° CSS.
 * @param {number} visualX
 * @param {number} visualY
 * @returns {'up'|'down'|'left'|'right'|null}
 */
export function pageSlideFromVisualPan(visualX, visualY) {
  const local = visualPanToLocal(visualX, visualY);
  // local(+X) → droite écran ; local(+Y) → bas écran (plan +90° Ally CCW)
  const ax = Math.abs(local.x);
  const ay = Math.abs(local.y);
  if (ax < 1e-9 && ay < 1e-9) return null;
  if (ax >= ay) return local.x > 0 ? LogicalDir.RIGHT : LogicalDir.LEFT;
  return local.y > 0 ? LogicalDir.DOWN : LogicalDir.UP;
}

/**
 * Action lecture associée à une direction logique D-Pad.
 * Spec UX Steam OS (repère écran portrait) :
 *   ← / →  → zoom ±
 *   ↑ / ↓  → pages
 */
export function readingActionForLogicalDpad(dir) {
  switch (dir) {
    case LogicalDir.RIGHT:
      return 'zoom-in';
    case LogicalDir.LEFT:
      return 'zoom-out';
    case LogicalDir.UP:
      return 'page-prev';
    case LogicalDir.DOWN:
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
