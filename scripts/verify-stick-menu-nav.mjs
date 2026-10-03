/**
 * Vérification stick menus → directions + repeat (edge / délai / intervalle).
 */
import {
  stickDirection,
  createStickMenuNav,
  STICK_NAV_THRESHOLD,
  STICK_NAV_INITIAL_DELAY_MS,
  STICK_NAV_REPEAT_MS,
} from '../src/shared/stick-menu-nav.js';
import { uiActionForLogicalDpad } from '../src/shared/portrait-remap.js';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else {
    console.log('OK  ', msg);
  }
}

assert(stickDirection(0, 0) === null, 'neutre → null');
assert(stickDirection(0.2, 0.2) === null, 'sous seuil → null');
assert(stickDirection(0, -0.5) === 'up', 'y− → up');
assert(stickDirection(0, 0.5) === 'down', 'y+ → down');
assert(stickDirection(-0.5, 0) === 'left', 'x− → left');
assert(stickDirection(0.5, 0) === 'right', 'x+ → right');
assert(stickDirection(0.3, -0.8) === 'up', 'diagonale : axe dominant Y');
assert(stickDirection(0.9, -0.2) === 'right', 'diagonale : axe dominant X');
assert(
  stickDirection(STICK_NAV_THRESHOLD - 0.01, 0) === null,
  'pile sous seuil → null',
);
assert(
  stickDirection(STICK_NAV_THRESHOLD, 0) === 'right',
  'pile au seuil → right',
);

assert(uiActionForLogicalDpad('up') === 'cursor-up', 'up → cursor-up');
assert(uiActionForLogicalDpad('down') === 'cursor-down', 'down → cursor-down');
assert(uiActionForLogicalDpad('left') === 'cursor-left', 'left → cursor-left');
assert(uiActionForLogicalDpad('right') === 'cursor-right', 'right → cursor-right');

const nav = createStickMenuNav({
  threshold: 0.45,
  initialDelayMs: 320,
  repeatMs: 120,
});

assert(nav.update(0, -0.6, 0) === 'up', 'edge : premier fire immédiat');
assert(nav.lastWasRepeat() === false, 'edge : lastWasRepeat=false');
assert(nav.update(0, -0.6, 100) === null, 'pendant délai initial : silence');
assert(nav.update(0, -0.6, 319) === null, 'juste avant délai : silence');
assert(nav.update(0, -0.6, 320) === 'up', 'à initialDelay : premier repeat');
assert(nav.lastWasRepeat() === true, 'repeat : lastWasRepeat=true');
assert(nav.update(0, -0.6, 400) === null, 'entre repeats : silence');
assert(nav.update(0, -0.6, 440) === 'up', 'après repeatMs : fire');
assert(nav.lastWasRepeat() === true, 'repeat suivant : lastWasRepeat=true');
assert(nav.update(0, 0, 500) === null, 'retour neutre : null + reset');
assert(nav.lastWasRepeat() === false, 'reset neutre : lastWasRepeat=false');
assert(nav.update(0, -0.6, 510) === 'up', 'nouveau edge après neutre');
assert(nav.lastWasRepeat() === false, 'nouvel edge : lastWasRepeat=false');

assert(nav.update(0.7, 0, 520) === 'right', 'changement de direction : edge');
assert(nav.update(0.7, 0, 600) === null, 'même dir : silence avant délai');
assert(
  nav.update(0.7, 0, 520 + STICK_NAV_INITIAL_DELAY_MS) === 'right',
  'repeat après délai sur nouvelle dir',
);

const short = createStickMenuNav({
  initialDelayMs: 200,
  repeatMs: 50,
});
assert(short.update(-0.8, 0, 0) === 'left', 'custom : edge left');
assert(short.update(-0.8, 0, 199) === null, 'custom : avant délai');
assert(short.update(-0.8, 0, 200) === 'left', 'custom : repeat à 200');
assert(short.update(-0.8, 0, 249) === null, 'custom : avant intervalle');
assert(short.update(-0.8, 0, 250) === 'left', 'custom : repeat à +50');

assert(
  STICK_NAV_INITIAL_DELAY_MS >= 250 && STICK_NAV_INITIAL_DELAY_MS <= 400,
  'délai initial raisonnable (250–400 ms)',
);
assert(
  STICK_NAV_REPEAT_MS >= 80 && STICK_NAV_REPEAT_MS <= 180,
  'intervalle repeat raisonnable (80–180 ms)',
);

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nTous les tests stick-menu-nav OK');
