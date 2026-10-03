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

const tokens = readFileSync(
  join(root, 'src/renderer/src/styles/tokens.css'),
  'utf8',
);

assert(hud.includes('role="dialog"'), 'ReaderHud = dialog modal');
assert(hud.includes('aria-modal="true"'), 'ReaderHud aria-modal');
assert(hud.includes('hud__backdrop'), 'overlay hud__backdrop');
assert(hud.includes('hud__dialog'), 'panneau centré hud__dialog');
assert(hud.includes('data-hud-focus'), 'cibles focus manette data-hud-focus');
assert(hud.includes('A valider'), 'hint A valider');
assert(hud.includes('B fermer'), 'hint B fermer');
assert(hud.includes('hud-toast'), 'toast progression distinct de la modal');
assert(
  /\.hud__backdrop\s*\{[\s\S]*?background:\s*var\(--hud-fade\)/.test(hud),
  'backdrop = voile thème --hud-fade',
);
assert(
  /\.hud__dialog\s*\{[\s\S]*?background:\s*var\(--bg\)/.test(hud),
  'panneau modal = fond thème --bg',
);
assert(!hud.includes('rgba(6, 10, 14'), 'plus de noir générique backdrop');
assert(
  tokens.includes('--bg:') && tokens.includes('--ink:'),
  'tokens --bg / --ink définis',
);
assert(
  /\[data-theme='dark'\][\s\S]*?--hud-fade:/.test(tokens) &&
    /\[data-theme='light'\][\s\S]*?--hud-fade:/.test(tokens),
  '--hud-fade clair/foncé selon data-theme',
);

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
assert(store.includes('animateScaleTo'), 'zoom smooth animateScaleTo (rAF)');
assert(store.includes('targetScale'), 'zoom targetScale');
assert(store.includes('ZOOM_STEP'), 'zoom pas logique ±15 %');
assert(readerView.includes('reader__strip'), 'strip vertical DOM');
assert(readerView.includes('data-strip'), 'reader data-strip défaut');
assert(
  /\.reader__strip-page\s*\{[\s\S]*?width:\s*100%/.test(readerView),
  'strip pages fit-width implicite (width 100%)',
);
assert(store.includes('loadStripWindow'), 'store loadStripWindow');
assert(store.includes('setPageFromStripScroll'), 'store setPageFromStripScroll');
assert(!store.includes('toggleWebtoon'), 'plus de toggleWebtoon');
assert(!hud.includes('Mode webtoon'), 'HUD sans bouton Mode webtoon');
assert(hud.includes('strip vertical'), 'HUD meta strip vertical');

assert(gamepad.includes('reader.hudVisible'), 'gamepad branche modal pause');
assert(gamepad.includes('closeHud()'), 'B/Select → closeHud en pause');
assert(gamepad.includes('moveHudFocus'), 'D-Pad → moveHudFocus en pause');
assert(
  gamepad.includes('hudVisible') && gamepad.includes('stickMenuNav.update'),
  'stick → nav focus quand modal ouverte',
);
assert(
  /function tick\(\)[\s\S]*?const\s*\{\s*ui\s*,\s*reader\s*\}\s*=\s*handlers/.test(
    gamepad,
  ) ||
    /function tick\(\)[\s\S]*?const\s*\{\s*reader\s*,\s*ui\s*\}\s*=\s*handlers/.test(
      gamepad,
    ),
  'tick() : reader depuis handlers (évite ReferenceError / boucle morte)',
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll reader HUD modal checks passed.');
