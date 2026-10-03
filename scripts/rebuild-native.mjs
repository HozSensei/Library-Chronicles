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

function electronVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'node_modules/electron/package.json'), 'utf8'));
    return String(pkg.version || '').replace(/^v/, '');
  } catch {
    return null;
  }
}

const sqlitePkg = join(root, 'node_modules/better-sqlite3/package.json');
if (!existsSync(sqlitePkg)) {
  fail(`
[VDR] better-sqlite3 absent de node_modules (dépendance optionnelle non installée).
  • Relance : npm install
  • Sans ce module, l’app utilise le fallback JSON (docs/NATIVE.md).
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
[VDR] Échec du rebuild natif better-sqlite3.
  • Sur Windows (Ally / PC de build) : installe les Build Tools Visual Studio (C++),
    puis relance : npm run rebuild:native
  • Sans binaire natif, l’app bascule automatiquement sur le fallback JSON
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
