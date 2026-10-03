/**
 * Vérification remap portrait + bindings + parse filename.
 */
import {
  DeviceOrientation,
  remapDpad,
  remapStick,
  readingActionForLogicalDpad,
  sessionOrientationForRoute,
  sessionModeForRoute,
  visualPanToLocal,
  pageSlideFromVisualPan,
} from '../src/shared/portrait-remap.js';
import {
  resolveKeyBindings,
  actionForBinding,
  DEFAULT_KEY_BINDINGS,
  REMAP_UI_CONTEXT,
} from '../src/shared/key-bindings.js';
import { detectFromFilename } from '../src/main/metadata/parse-filename.js';
import { naturalCompare, detectChapters } from '../src/main/extractors/cbz.js';
import { GamepadButtons } from '../src/shared/gamepad-codes.js';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else {
    console.log('OK  ', msg);
  }
}

const o = DeviceOrientation.PORTRAIT_CCW;

assert(remapDpad(o, 'up') === 'left', 'physique ↑ → logique ←');
assert(remapDpad(o, 'down') === 'right', 'physique ↓ → logique →');
assert(remapDpad(o, 'left') === 'down', 'physique ← → logique ↓ (CCW D-Pad bas)');
assert(remapDpad(o, 'right') === 'up', 'physique → → logique ↑ (CCW ABXY haut)');
assert(remapDpad(DeviceOrientation.LANDSCAPE, 'up') === 'up', 'landscape inchangé');
assert(remapDpad(DeviceOrientation.LANDSCAPE, 'left') === 'left', 'landscape ← inchangé');

const stickUp = remapStick(o, 0, -1);
assert(stickUp.x === -1 && stickUp.y === 0, 'stick physique ↑ → logique ←');
const stickLeft = remapStick(o, -1, 0);
assert(stickLeft.x === 0 && stickLeft.y === 1, 'stick physique ← → logique ↓');
const stickRight = remapStick(o, 1, 0);
assert(stickRight.x === 0 && stickRight.y === -1, 'stick physique → → logique ↑');

// Pan stick lecture (+90° CSS) — formules locales
//   localX = −visualY ; localY = visualX
const panRight = visualPanToLocal(1, 0);
assert(panRight.x === 0 && panRight.y === 1, 'pan visuel → → local +Y');
const panUp = visualPanToLocal(0, -1);
assert(panUp.x === 1 && panUp.y === 0, 'pan visuel ↑ → local +X');
const panDown = visualPanToLocal(0, 1);
assert(panDown.x === -1 && panDown.y === 0, 'pan visuel ↓ → local −X');
const panLeft = visualPanToLocal(-1, 0);
assert(panLeft.x === 0 && panLeft.y === -1, 'pan visuel ← → local −Y');

// Spec exacte : stick logique → glissement page (écran utilisateur)
assert(pageSlideFromVisualPan(0, -1) === 'right', 'spec stick ↑ → page glisse droite');
assert(pageSlideFromVisualPan(0, 1) === 'left', 'spec stick ↓ → page glisse gauche');
assert(pageSlideFromVisualPan(-1, 0) === 'up', 'spec stick ← → page glisse haut');
assert(pageSlideFromVisualPan(1, 0) === 'down', 'spec stick → → page glisse bas');

// Chaîne complète Ally CCW : physique → remapStick → visualPanToLocal → glissement
// Stick vers le haut écran = physique → (vers ABXY)
const stickScreenUp = remapStick(o, 1, 0);
assert(stickScreenUp.x === 0 && stickScreenUp.y === -1, 'physique → → logique ↑ (haut écran)');
const localScreenUp = visualPanToLocal(stickScreenUp.x, stickScreenUp.y);
assert(localScreenUp.x === 1 && localScreenUp.y === 0, 'haut écran → pan local +X (plan +90°)');
assert(
  pageSlideFromVisualPan(stickScreenUp.x, stickScreenUp.y) === 'right',
  'chaîne haut écran → page glisse droite',
);

const stickScreenDown = remapStick(o, -1, 0);
assert(stickScreenDown.x === 0 && stickScreenDown.y === 1, 'physique ← → logique ↓');
assert(
  pageSlideFromVisualPan(stickScreenDown.x, stickScreenDown.y) === 'left',
  'chaîne bas écran → page glisse gauche',
);

const stickScreenLeft = remapStick(o, 0, -1);
assert(stickScreenLeft.x === -1 && stickScreenLeft.y === 0, 'physique ↑ → logique ←');
assert(
  pageSlideFromVisualPan(stickScreenLeft.x, stickScreenLeft.y) === 'up',
  'chaîne gauche écran → page glisse haut',
);

const stickScreenRight = remapStick(o, 0, 1);
assert(stickScreenRight.x === 1 && stickScreenRight.y === 0, 'physique ↓ → logique →');
assert(
  pageSlideFromVisualPan(stickScreenRight.x, stickScreenRight.y) === 'down',
  'chaîne droite écran → page glisse bas',
);

const landStick = remapStick(DeviceOrientation.LANDSCAPE, 0.5, -0.7);
assert(
  landStick.x === 0.5 && landStick.y === -0.7,
  'landscape stick : physique = logique',
);

// Menus = landscape (identité) — bug critique : jamais portrait hors lecteur
const menuRoutes = [
  'boot',
  'setup',
  'profiles',
  'library',
  'book',
  'import',
  'settings',
  null,
  undefined,
  '',
];
for (const route of menuRoutes) {
  assert(
    sessionOrientationForRoute(route) === DeviceOrientation.LANDSCAPE,
    `route "${route}" → landscape (menus)`,
  );
  assert(sessionModeForRoute(route) === 'ui', `route "${route}" → mode ui`);
}
assert(
  sessionOrientationForRoute('reader') === DeviceOrientation.PORTRAIT_CCW,
  'route reader → portrait-ccw',
);
assert(sessionModeForRoute('reader') === 'reader', 'route reader → mode reader');

// Spec UX : droite = Zoom +, gauche = Zoom − ; haut/bas = pages
assert(readingActionForLogicalDpad('right') === 'zoom-in', '→ écran = zoom +');
assert(readingActionForLogicalDpad('left') === 'zoom-out', '← écran = zoom −');
assert(readingActionForLogicalDpad('up') === 'page-prev', '↑ écran = page prev');
assert(readingActionForLogicalDpad('down') === 'page-next', '↓ écran = page next');

const bindings = resolveKeyBindings(null);
assert(
  actionForBinding(bindings, 'reader', 'dpad:right') === 'zoom-in',
  'binding défaut zoom-in (droite)',
);
assert(
  actionForBinding(bindings, 'reader', 'dpad:left') === 'zoom-out',
  'binding défaut zoom-out (gauche)',
);
assert(
  actionForBinding(bindings, 'library', 'dpad:up') === 'cursor-up',
  'biblio dpad:up = cursor-up (post-identity)',
);
assert(
  actionForBinding(bindings, 'setup', 'dpad:left') === 'cursor-left',
  'setup dpad:left = cursor-left (post-identity)',
);
assert(
  actionForBinding(bindings, 'reader', `button:${GamepadButtons.SELECT}`) === 'toggle-pause',
  'Select = menu pause',
);
assert(
  actionForBinding(bindings, 'reader', 'button:0') === 'toggle-direction',
  'binding défaut A = sens',
);
assert(
  actionForBinding(bindings, 'library', `button:${GamepadButtons.LB}`) === 'tab-prev',
  'biblio LB = onglet catalogue précédent',
);
assert(
  actionForBinding(bindings, 'library', `button:${GamepadButtons.RB}`) === 'tab-next',
  'biblio RB = onglet catalogue suivant',
);
assert(
  actionForBinding(bindings, 'library', `button:${GamepadButtons.LT}`) === 'filter-prev',
  'biblio LT = filtre précédent',
);
assert(
  actionForBinding(bindings, 'library', `button:${GamepadButtons.RT}`) === 'filter-next',
  'biblio RT = filtre suivant',
);
assert(
  actionForBinding(bindings, 'library', `button:${GamepadButtons.B}`) == null,
  'biblio B = no-op (pas de back)',
);
assert(
  actionForBinding(bindings, 'library', `button:${GamepadButtons.START}`) === 'settings',
  'biblio Start = paramètres',
);
assert(
  actionForBinding(bindings, 'settings', `button:${GamepadButtons.LT}`) === 'tab-prev',
  'settings LT = section précédente',
);
assert(
  actionForBinding(bindings, 'settings', 'dpad:left') === 'cursor-left',
  'settings dpad:left = focus (pas section)',
);

const custom = resolveKeyBindings({
  reader: { 'button:0': 'close-book' },
});
assert(
  actionForBinding(custom, 'reader', 'button:0') === 'close-book',
  'override utilisateur A',
);
assert(
  actionForBinding(custom, 'reader', 'dpad:up') === DEFAULT_KEY_BINDINGS.reader['dpad:up'],
  'override partiel conserve dpad',
);

const meta = detectFromFilename('/books/One Piece - Tome 03 (2019).cbz');
assert(meta.series === 'One Piece', `series détectée (${meta.series})`);
assert(meta.volume === 3, `volume détecté (${meta.volume})`);
assert(meta.year === 2019, `année détectée (${meta.year})`);
assert(meta.title.includes('One Piece'), `titre enrichi (${meta.title})`);

const names = ['ch2/page10.jpg', 'ch1/page2.jpg', 'ch1/page10.jpg', 'ch2/page2.jpg'];
const sorted = [...names].sort(naturalCompare);
assert(sorted[0] === 'ch1/page2.jpg', `tri naturel (${sorted[0]})`);
const chapters = detectChapters(sorted);
assert(chapters.length === 2, `chapitres détectés (${chapters.length})`);

if (failed) {
  console.error(`\n${failed} assertion(s) en échec`);
  process.exit(1);
}
assert(REMAP_UI_CONTEXT === 'reader', 'remap UI = reader only');

console.log('\nTests remap / bindings / metadata OK');
