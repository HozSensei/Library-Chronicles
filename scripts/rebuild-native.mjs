#!/usr/bin/env node
/**
 * Rebuild better-sqlite3 pour la version Electron du projet.
 * Échoue avec un message clair (exit 1) — à lancer avant dist:win sur Windows.
 */
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(join(root, 'package.json'));

function electronVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'node_modules/electron/package.json'), 'utf8'));
    return String(pkg.version || '').replace(/^v/, '');
  } catch {
    return null;
  }
}

const version = electronVersion();
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

if (result.status !== 0) {
  console.error(`
[VDR] Échec du rebuild natif better-sqlite3.
  • Sur Windows (Ally / PC de build) : installe les Build Tools Visual Studio (C++),
    puis relance : npm run rebuild:native
  • Sans binaire natif, l’app bascule automatiquement sur le fallback JSON
    (voir docs/NATIVE.md) — l’app démarre quand même.
`);
  process.exit(result.status || 1);
}

// Smoke : tenter de charger le module sous Node (le runtime Electron peut différer)
try {
  require('better-sqlite3');
  console.info('[VDR] better-sqlite3 chargeable sous Node — OK pour packaging.');
} catch (err) {
  console.warn('[VDR] Chargement Node de better-sqlite3 échoué:', err.message);
  console.warn('[VDR] electron-builder / npmRebuild tentera un rebuild au packaging.');
}

process.exit(0);
