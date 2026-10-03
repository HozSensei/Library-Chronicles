/**
 * Vérifie la structure modal pause lecture (Select) + orientation plan +90°.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else {
    console.log('OK  ', msg);
  }
}

const hud = readFileSync(
  join(root, 'src/renderer/src/components/ReaderHud.vue'),
  'utf8',
);
const readerView = readFileSync(
  join(root, 'src/renderer/src/views/ReaderView.vue'),
  'utf8',
);
const orientationCss = readFileSync(
  join(root, 'src/renderer/src/styles/orientation.css'),
  'utf8',
);
const gamepad = readFileSync(
  join(root, 'src/renderer/src/composables/useGamepad.js'),
  'utf8',
);
const store = readFileSync(
  join(root, 'src/renderer/src/stores/reader.js'),
  'utf8',
);

assert(hud.includes('role="dialog"'), 'ReaderHud = dialog modal');
assert(hud.includes('aria-modal="true"'), 'ReaderHud aria-modal');
assert(hud.includes('hud__backdrop'), 'overlay assombri hud__backdrop');
assert(hud.includes('hud__dialog'), 'panneau centré hud__dialog');
assert(hud.includes('data-hud-focus'), 'cibles focus manette data-hud-focus');
assert(hud.includes('A valider'), 'hint A valider');
assert(hud.includes('B fermer'), 'hint B fermer');
assert(hud.includes('hud-toast'), 'toast progression distinct de la modal');

assert(
  /<div[^>]*class="reader__plane"[\s\S]*<ReaderHud\s*\/>/.test(readerView),
  'ReaderHud dans reader__plane (même plan tourné)',
);
assert(
  readerView.includes('rotate(90deg)'),
  'plan lecteur rotate(+90°)',
);

assert(
  orientationCss.includes('modal') || orientationCss.includes('plan'),
  'orientation.css documente modal / plan',
);
assert(
  !orientationCss.includes('max-height: 55%'),
  'plus de HUD bas max-height 55% (ancien layout)',
);

assert(store.includes('closeHud'), 'store closeHud');
assert(store.includes('toastVisible'), 'store toastVisible (flash ≠ modal)');
assert(store.includes('hudFocusIndex'), 'store hudFocusIndex');
assert(store.includes('moveHudFocus'), 'store moveHudFocus');

assert(gamepad.includes('reader.hudVisible'), 'gamepad branche modal pause');
assert(gamepad.includes('closeHud()'), 'B/Select → closeHud en pause');
assert(gamepad.includes('moveHudFocus'), 'D-Pad → moveHudFocus en pause');
assert(
  gamepad.includes('hudVisible') && gamepad.includes('stickMenuNav.update'),
  'stick → nav focus quand modal ouverte',
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll reader HUD modal checks passed.');
