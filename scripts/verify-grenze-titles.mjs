/**
 * Vérifie que Grenze (--font-display) est câblée pour les titres UI.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const main = read('src/renderer/src/main.js');
assert(main.includes("import './assets/fonts/grenze.css'"), 'main.js importe grenze.css');

const grenzeCss = join(root, 'src/renderer/src/assets/fonts/grenze.css');
assert(existsSync(grenzeCss), 'grenze.css présent');
const faces = read('src/renderer/src/assets/fonts/grenze.css');
for (const w of [600, 700, 800, 900]) {
  assert(faces.includes(`font-weight: ${w}`), `face Grenze weight ${w}`);
  assert(
    existsSync(join(root, `src/renderer/src/assets/fonts/grenze/grenze-latin-${w}-normal.woff2`)),
    `woff2 latin ${w}`,
  );
}

const tokens = read('src/renderer/src/styles/tokens.css');
assert(tokens.includes("--font-display: 'Grenze'"), 'token --font-display = Grenze');
assert(tokens.includes("--font-body: 'Figtree'"), 'token --font-body = Figtree');

const tw = read('src/renderer/src/styles/tailwind.css');
assert(tw.includes("--font-display: 'Grenze'"), 'tailwind @theme --font-display');

const base = read('src/renderer/src/styles/base.css');
assert(base.includes('font-family: var(--font-display)'), 'base.css titres → display');
assert(/h1,\s*\nh2,\s*\nh3/.test(base) || base.includes('h1,\nh2,\nh3'), 'base.css h1–h3 display');
assert(base.includes('.btn-primary'), 'btn-primary conservé');
assert(
  /\.btn-primary[\s\S]*?font-family:\s*var\(--font-display\)/.test(base),
  'btn-primary en display',
);

const boot = read('src/renderer/src/views/BootView.vue');
assert(
  /\.boot__headline\s*\{[^}]*font-family:\s*var\(--font-display\)/s.test(boot),
  'boot headline → Grenze',
);
assert(
  !/\.boot__headline\s*\{[^}]*font-family:\s*var\(--font-body\)/s.test(boot),
  'boot headline ne reste pas en body',
);
assert(
  /\.boot__headline\s*\{[^}]*font-weight:\s*7\d0/s.test(boot),
  'boot headline poids ≥ 700 (faces 600–900)',
);

const checks = [
  ['src/renderer/src/views/LibraryView.vue', '.poster__title', 'poster titles'],
  ['src/renderer/src/views/LibraryView.vue', '.catalog__nav-link', 'onglets catalogue'],
  ['src/renderer/src/views/LibraryView.vue', '.catalog__empty-title', 'empty library'],
  ['src/renderer/src/views/LibraryView.vue', '.catalog__cta', 'CTA empty library'],
  ['src/renderer/src/views/ProfilesView.vue', '.profiles__prompt', 'prompt profils'],
  ['src/renderer/src/views/ImportView.vue', '.import__empty-title', 'empty import'],
  ['src/renderer/src/views/ImportView.vue', '.import__title', 'import header'],
  ['src/renderer/src/views/BookDetailView.vue', '.book-detail__headline', 'fiche livre'],
  ['src/renderer/src/views/BookDetailView.vue', '.book-detail__empty-title', 'empty fiche livre'],
  ['src/renderer/src/views/SeriesDetailView.vue', '.series-detail__title', 'fiche série'],
  ['src/renderer/src/views/SeriesDetailView.vue', '.series-detail__vol-title', 'titres tomes'],
  ['src/renderer/src/views/SettingsView.vue', 'h1', 'settings h1'],
  ['src/renderer/src/components/ReaderHud.vue', '.hud__title', 'HUD titre'],
  ['src/renderer/src/components/ReaderHud.vue', '.hud__tab', 'HUD onglets'],
  ['src/renderer/src/components/ControlHint.vue', 'font-body', 'hints manette restent body'],
];

for (const [file, needle, label] of checks) {
  const src = read(file);
  if (needle === 'font-body') {
    assert(src.includes('var(--font-body)'), label);
    continue;
  }
  // Classe / sélecteur suivi d'un bloc contenant font-display
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{[^}]*font-family:\\s*var\\(--font-display\\)`, 's');
  assert(re.test(src), `${label} (${file} ${needle}) → font-display`);
}

assert(!read('src/renderer/src/main.js').includes('syne'), 'plus de Syne dans main.js');
assert(!tokens.toLowerCase().includes('syne'), 'plus de Syne dans tokens');

console.log('OK: Grenze display titles wiring');
