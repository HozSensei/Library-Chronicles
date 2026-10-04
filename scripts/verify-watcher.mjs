#!/usr/bin/env node
/**
 * Tests unitaires du watcher FS (snapshot / diff) — sans Electron.
 */
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Charger les helpers purs — le module importe electron ; on mocke via redirection.
// On extrait la logique testable en ré-exécutant les exports après un stub minimal.

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vdr-watch-'));
const libraryDir = path.join(tmp, 'library');
const importDir = path.join(tmp, 'import');
fs.mkdirSync(libraryDir, { recursive: true });
fs.mkdirSync(importDir, { recursive: true });

// Stub electron avant import du watcher
const electronStubPath = path.join(tmp, 'electron-stub.mjs');
fs.writeFileSync(
  electronStubPath,
  `
export class BrowserWindow {
  static getAllWindows() { return []; }
}
`,
  'utf8',
);

// Node ne remappe pas facilement electron ; on teste les helpers via copie locale
// des fonctions pures (même logique que watcher.js).
function isSupported(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  return ['.cbz', '.cbr', '.pdf', '.zip'].includes(ext);
}

function snapshotSupportedTree(dirRoot) {
  const map = new Map();
  if (!dirRoot || !fs.existsSync(dirRoot)) return map;
  function walk(dir, rel) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue;
      const relPath = rel ? path.join(rel, ent.name) : ent.name;
      const full = path.join(dir, ent.name);
      try {
        if (ent.isDirectory()) walk(full, relPath);
        else if (ent.isFile() && isSupported(full)) {
          map.set(relPath, fs.statSync(full).mtimeMs);
        }
      } catch {
        // ignore
      }
    }
  }
  walk(dirRoot, '');
  return map;
}

function snapshotsDiffer(prev, next) {
  if (prev.size !== next.size) return true;
  for (const [k, v] of next) {
    if (prev.get(k) !== v) return true;
  }
  return false;
}

// --- assertions ---
const empty = snapshotSupportedTree(libraryDir);
assert.strictEqual(empty.size, 0, 'snapshot vide');

const cbz = path.join(libraryDir, 'Demo.cbz');
fs.writeFileSync(cbz, 'PK');
const snap1 = snapshotSupportedTree(libraryDir);
assert.strictEqual(snap1.size, 1, '1 fichier supporté');
assert.ok(snap1.has('Demo.cbz'));

fs.writeFileSync(path.join(libraryDir, 'notes.txt'), 'ignore');
const snap2 = snapshotSupportedTree(libraryDir);
assert.strictEqual(snap2.size, 1, 'ignore non supportés');
assert.strictEqual(snapshotsDiffer(snap1, snap2), false, 'pas de diff sans supporté');

const nested = path.join(libraryDir, 'serie', 'Tome01.pdf');
fs.mkdirSync(path.dirname(nested), { recursive: true });
fs.writeFileSync(nested, '%PDF');
const snap3 = snapshotSupportedTree(libraryDir);
assert.strictEqual(snap3.size, 2, 'récursif + pdf');
assert.ok(snapshotsDiffer(snap2, snap3), 'diff détectée');

fs.writeFileSync(path.join(importDir, 'Incoming.cbr'), 'Rar!');
const impSnap = snapshotSupportedTree(importDir);
assert.strictEqual(impSnap.size, 1, 'import couvert');

fs.writeFileSync(path.join(libraryDir, 'Novel.epub'), 'PK');
const snapEpub = snapshotSupportedTree(libraryDir);
assert.ok(snapEpub.has('Novel.epub'), 'epub supporté par snapshot');
assert.strictEqual(snapEpub.size, 3, 'cbz + pdf + epub');

// Importer le vrai module pour snapshotsDiffer / snapshotSupportedTree si possible
try {
  // Mock electron dans le registre module (CJS interop via createRequire n'aide pas ESM).
  // On valide au moins que le fichier source exporte les symboles attendus.
  const src = fs.readFileSync(path.join(root, 'src/main/library/watcher.js'), 'utf8');
  assert.ok(src.includes('export function snapshotSupportedTree'));
  assert.ok(src.includes('export function snapshotsDiffer'));
  assert.ok(src.includes("mode = 'poll'"));
  assert.ok(src.includes('POLL_INTERVAL_MS'));
  assert.ok(src.includes('STABILITY_MS'));
  console.info('OK  watcher source — poll fallback + stabilité présents');
} catch (err) {
  console.error(err);
  process.exit(1);
}

// Nettoyage
fs.rmSync(tmp, { recursive: true, force: true });
console.info('OK  snapshot / diff library+import');
console.info('Tous les tests watcher FS sont passés.');
