/**
 * Branding Library Chronicles : assets, productName, composants logo/marque.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else {
    console.log('OK  ', msg);
  }
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const pkg = JSON.parse(read('package.json'));
assert(pkg.productName === 'Library Chronicles' || pkg.build?.productName === 'Library Chronicles', 'productName Library Chronicles');
assert(pkg.build?.productName === 'Library Chronicles', 'build.productName');
assert(pkg.build?.nsis?.shortcutName === 'Library Chronicles', 'shortcutName');
assert(pkg.name === 'library-chronicles', 'package name library-chronicles');

assert(exists('src/renderer/src/assets/library-chronicles-logo.png'), 'wordmark png');
assert(exists('src/renderer/src/assets/library-chronicles-mark.png'), 'mark png');
assert(exists('src/renderer/src/assets/library-chronicles-mark-glyph.png'), 'glyph mask png');
assert(exists('src/renderer/src/assets/library-chronicles-mark.svg'), 'mark svg (mask)');
assert(exists('src/renderer/public/favicon.png'), 'favicon public');
assert(exists('build/icon.png'), 'electron icon.png');
assert(exists('build/icon.ico'), 'electron icon.ico');
assert(exists('build/icon.icns'), 'electron icon.icns');

const logo = read('src/renderer/src/components/AppBrandLogo.vue');
assert(logo.includes('library-chronicles-logo.png'), 'AppBrandLogo → wordmark');
assert(logo.includes('Library Chronicles'), 'AppBrandLogo alt/title');

const mark = read('src/renderer/src/components/AppBrandMark.vue');
assert(mark.includes('library-chronicles-mark-glyph.png'), 'AppBrandMark glyph mask');
assert(mark.includes('normalizeAvatarColor'), 'AppBrandMark normalise couleur profil');
assert(mark.includes('mask-image') || mark.includes('mask-image'), 'CSS mask');

const fav = read('src/renderer/src/composables/useBrandFavicon.js');
assert(fav.includes('paintBrandFavicon'), 'favicon paint');
assert(fav.includes('activeProfile'), 'favicon suit profil actif');

const html = read('src/renderer/index.html');
assert(html.includes('Library Chronicles'), 'title HTML');
assert(html.includes('favicon.png'), 'link favicon');

const main = read('src/main/index.js');
assert(main.includes("title: 'Library Chronicles'"), 'window title');
assert(main.includes('resolveAppIcon') || main.includes('nativeImage'), 'icône fenêtre');

const profiles = read('src/renderer/src/views/ProfilesView.vue');
assert(profiles.includes('AppBrandMark'), 'profils utilisent AppBrandMark');
assert(profiles.includes('AppBrandLogo'), 'profils wordmark');

const library = read('src/renderer/src/views/LibraryView.vue');
assert(library.includes('AppBrandMark'), 'library avatar marque');
assert(library.includes('AppBrandLogo'), 'library wordmark');

const boot = read('src/renderer/src/views/BootView.vue');
assert(boot.includes('AppBrandLogo'), 'boot wordmark');

const setup = read('src/renderer/src/views/SetupView.vue');
assert(setup.includes('AppBrandLogo'), 'setup wordmark');

const app = read('src/renderer/src/App.vue');
assert(app.includes('useBrandFavicon'), 'App branche favicon dynamique');

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nbrand-logo OK');
