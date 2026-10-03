#!/usr/bin/env node
/**
 * postinstall tolérant (Linux + Windows).
 *
 * Ne doit jamais faire échouer `npm install` :
 * - pas de `|| true` (cassé sous cmd.exe Windows, où `true` n'existe pas)
 * - rebuild Electron de better-sqlite3 en mode soft
 */
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rebuildScript = join(__dirname, 'rebuild-native.mjs');

try {
  const result = spawnSync(process.execPath, [rebuildScript, '--soft'], {
    cwd: join(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) {
    console.warn('[VDR] postinstall: impossible de lancer rebuild-native:', result.error.message);
  } else if (result.status !== 0) {
    console.warn(
      '[VDR] postinstall: rebuild natif non bloquant (exit',
      result.status,
      '). Relance plus tard: npm run rebuild:native',
    );
  }
} catch (err) {
  console.warn('[VDR] postinstall: erreur ignorée:', err?.message || err);
}

process.exit(0);
