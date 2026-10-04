/**
 * Vérifie le câblage auto-update (electron-updater + IPC + toasts i18n).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { t, setLocale } from '../src/shared/i18n.js';
import { IpcChannels } from '../src/shared/ipc-channels.js';

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

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const updater = readFileSync(join(root, 'src/main/updater.js'), 'utf8');
const main = readFileSync(join(root, 'src/main/index.js'), 'utf8');
const preload = readFileSync(join(root, 'src/preload/index.js'), 'utf8');
const appVue = readFileSync(join(root, 'src/renderer/src/App.vue'), 'utf8');
const channels = readFileSync(join(root, 'src/shared/ipc-channels.js'), 'utf8');
const allySmoke = readFileSync(join(root, 'docs/ALLY-SMOKE.md'), 'utf8');
const packaging = readFileSync(join(root, 'docs/PACKAGING.md'), 'utf8');

assert(pkg.dependencies?.['electron-updater'], 'dep electron-updater');
assert(pkg.version === '0.1.0', 'version 0.1.0');
assert(pkg.build?.productName === 'Library Chronicles', 'productName Library Chronicles');
assert(
  Array.isArray(pkg.build?.publish) &&
    pkg.build.publish[0]?.provider === 'github' &&
    pkg.build.publish[0]?.owner === 'HozSensei' &&
    pkg.build.publish[0]?.repo === 'Library-Chronicles',
  'publish github HozSensei/Library-Chronicles',
);
assert(
  pkg.repository?.url?.includes('HozSensei/Library-Chronicles'),
  'repository URL',
);
assert(
  pkg.build?.win?.target?.some((t) => t.target === 'nsis') &&
    pkg.build?.win?.target?.some((t) => t.target === 'portable'),
  'cibles nsis + portable',
);
assert(pkg.build?.icon === 'build/icon.png', 'icon build/icon.png');

assert(updater.includes("from 'electron-updater'"), 'import electron-updater');
assert(updater.includes("owner: 'HozSensei'"), 'feed owner');
assert(updater.includes("repo: 'Library-Chronicles'"), 'feed repo');
assert(updater.includes('autoDownload = true'), 'autoDownload');
assert(updater.includes('autoInstallOnAppQuit = true'), 'autoInstallOnAppQuit');
assert(updater.includes('app.isPackaged'), 'packaged guard');
assert(updater.includes('registerUpdaterIpc'), 'registerUpdaterIpc export');
assert(updater.includes('startAutoUpdater'), 'startAutoUpdater export');

assert(main.includes("from './updater.js'"), 'main importe updater');
assert(main.includes('registerUpdaterIpc()'), 'main registerUpdaterIpc');
assert(main.includes('startAutoUpdater(mainWindow)'), 'main startAutoUpdater');

assert(IpcChannels.UPDATE_CHECK === 'update:check', 'channel UPDATE_CHECK');
assert(
  IpcChannels.UPDATE_QUIT_AND_INSTALL === 'update:quit-and-install',
  'channel QUIT_AND_INSTALL',
);
assert(IpcChannels.UPDATE_STATUS === 'update:status', 'channel UPDATE_STATUS');
assert(channels.includes('UPDATE_STATUS'), 'ipc-channels UPDATE_*');

assert(preload.includes('update:'), 'preload update API');
assert(preload.includes('onStatus'), 'preload onStatus');
assert(preload.includes('quitAndInstall'), 'preload quitAndInstall');

assert(appVue.includes('handleUpdateStatus'), 'App.vue handleUpdateStatus');
assert(appVue.includes('update.onStatus'), 'App.vue subscribe update');
assert(appVue.includes("t('toast.updateAvailable'"), 'toast updateAvailable');
assert(appVue.includes("t('toast.updateReady'"), 'toast updateReady');

setLocale('fr');
assert(
  t('toast.updateReady', { version: '0.1.1' }).includes('0.1.1'),
  'i18n FR updateReady',
);
assert(t('toast.updateDownloading').includes('Téléchargement'), 'i18n FR downloading');
setLocale('en');
assert(
  t('toast.updateReady', { version: '0.1.1' }).includes('0.1.1'),
  'i18n EN updateReady',
);
assert(t('toast.updateError').includes('unavailable'), 'i18n EN updateError');
setLocale('fr');

assert(allySmoke.includes('v0.1'), 'ALLY-SMOKE titre');
assert(allySmoke.includes('CBZ'), 'ALLY-SMOKE CBZ');
assert(allySmoke.includes('EPUB'), 'ALLY-SMOKE EPUB');
assert(allySmoke.includes('Manette'), 'ALLY-SMOKE manette');
assert(packaging.includes('electron-updater'), 'PACKAGING auto-update');
assert(packaging.includes('gh release create'), 'PACKAGING release create');
assert(packaging.includes('git tag'), 'PACKAGING git tag');

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll updater checks passed');
