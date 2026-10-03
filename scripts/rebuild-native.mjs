#!/usr/bin/env node
/**
 * Rebuild better-sqlite3 pour la version Electron du projet.
 *
 * Usage:
 *   node scripts/rebuild-native.mjs          # strict (exit 1 si échec) — packaging
 *   node scripts/rebuild-native.mjs --soft   # tolérant (exit 0) — postinstall
 *   npm run rebuild:native
 */
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(join(root, 'package.json'));
const soft = process.argv.includes('--soft');

function fail(message, code = 1) {
  console.error(message);
  process.exit(soft ? 0 : code);
}

function runNpm(args) {
  return spawnSync('npm', args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
}

function electronVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'node_modules/electron/package.json'), 'utf8'));
    return String(pkg.version || '').replace(/^v/, '');
  } catch {
    return null;
  }
}

function sqlitePresent() {
  return existsSync(join(root, 'node_modules/better-sqlite3/package.json'));
}

function ensureBetterSqlite3() {
  if (sqlitePresent()) return true;

  console.warn(`
[VDR] better-sqlite3 absent de node_modules.
  Tentative d’installation (npm install better-sqlite3 --no-save)…
`);

  const install = runNpm(['install', 'better-sqlite3', '--no-save']);
  if (install.error) {
    console.warn(`[VDR] npm install better-sqlite3 a échoué au lancement: ${install.error.message}`);
  } else if (install.status !== 0) {
    console.warn(`[VDR] npm install better-sqlite3 a échoué (exit ${install.status}).`);
  }

  if (sqlitePresent()) {
    console.info('[VDR] better-sqlite3 installé — suite du rebuild Electron.');
    return true;
  }

  // Second essai : installer depuis package.json (dependencies).
  console.warn('[VDR] Second essai : npm install better-sqlite3…');
  const install2 = runNpm(['install', 'better-sqlite3']);
  if (install2.error) {
    console.warn(`[VDR] Second essai échoué au lancement: ${install2.error.message}`);
  }

  return sqlitePresent();
}

if (!ensureBetterSqlite3()) {
  fail(`
[VDR] Module manquant : better-sqlite3 n’est toujours pas dans node_modules.
  Cause probable : l’installation npm a omis le module (réseau, cache, ou
  ancienne config optionalDependencies) ou la compile native a échoué.

  Que faire :
  1. npm install better-sqlite3
  2. puis : npm run rebuild:native

  Sans ce module, l’app utilise le fallback JSON (docs/NATIVE.md).
  Ce n’est PAS un problème de Visual Studio Build Tools — le package
  lui-même n’est pas présent.
`);
}

const version = electronVersion();
if (!version) {
  console.warn('[VDR] Electron introuvable — rebuild pour l’ABI Node courant uniquement.');
}

console.info('[VDR] rebuild better-sqlite3 pour Electron', version || '(version inconnue)');

const args = ['--yes', '@electron/rebuild', '-f', '-w', 'better-sqlite3'];
if (version) {
  args.push('-v', version);
}

const result = spawnSync('npx', args, {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});

if (result.error) {
  fail(`
[VDR] Impossible de lancer npx @electron/rebuild: ${result.error.message}
  • Vérifie Node/npm, puis : npm run rebuild:native
`);
}

if (result.status !== 0) {
  fail(`
[VDR] Échec du rebuild natif better-sqlite3 (module présent, compile KO).
  Cause probable : outils de compilation manquants ou incompatibles.

  Sur Windows (Ally / PC de build) :
  • Installe Visual Studio Build Tools (workload « Desktop development with C++ »)
  • Relance : npm run rebuild:native

  Ce n’est PAS « module absent » — better-sqlite3 est bien installé, mais
  le binaire natif n’a pas pu être reconstruit pour Electron.

  Sans binaire natif, l’app bascule automatiquement sur le fallback JSON
  (voir docs/NATIVE.md) — l’app démarre quand même.
`, result.status || 1);
}

// Smoke : tenter de charger le module sous Node (le runtime Electron peut différer)
try {
  require('better-sqlite3');
  console.info('[VDR] better-sqlite3 chargeable sous Node — OK pour packaging.');
} catch (err) {
  console.warn('[VDR] Chargement Node de better-sqlite3 échoué:', err.message);
  console.warn('[VDR] electron-builder / npmRebuild tentera un rebuild au packaging.');
  if (!soft) {
    // Ne bloque pas rebuild:native si le .node Electron n’est pas chargeable sous Node.
    console.warn('[VDR] Continuons (ABI Electron ≠ Node) — packaging OK.');
  }
}

process.exit(0);
