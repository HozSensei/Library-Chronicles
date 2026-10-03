/**
 * Surveillance FS des dossiers library / import (debounce + events IPC).
 */
import fs from 'fs';
import path from 'path';
import { BrowserWindow } from 'electron';
import { getConfig } from '../config.js';
import { IpcChannels } from '../../shared/ipc-channels.js';
import { SUPPORTED } from './scanner.js';

const DEBOUNCE_MS = 450;

/** @type {Map<string, fs.FSWatcher>} */
const watchers = new Map();
/** @type {Map<string, NodeJS.Timeout>} */
const pending = new Map();

function isSupportedFile(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  return SUPPORTED.has(ext);
}

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

function schedule(kind, root, reason, filePath) {
  const key = `${kind}:${root}`;
  if (pending.has(key)) clearTimeout(pending.get(key));
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key);
      const channel =
        kind === 'library' ? IpcChannels.WATCH_LIBRARY_CHANGED : IpcChannels.WATCH_IMPORT_CHANGED;
      broadcast(channel, {
        root,
        reason: reason || 'change',
        filePath: filePath || null,
        at: new Date().toISOString(),
      });
    }, DEBOUNCE_MS),
  );
}

function watchDir(kind, root) {
  if (!root) return;
  try {
    fs.mkdirSync(root, { recursive: true });
  } catch {
    return;
  }
  if (!fs.existsSync(root)) return;

  const prev = watchers.get(kind);
  if (prev) {
    try {
      prev.close();
    } catch {
      // ignore
    }
    watchers.delete(kind);
  }

  try {
    const watcher = fs.watch(root, { recursive: true }, (eventType, filename) => {
      if (!filename) {
        schedule(kind, root, eventType);
        return;
      }
      const full = path.join(root, filename);
      // Ignorer fichiers cachés / non supportés sauf unlink (refresh utile)
      const base = path.basename(filename);
      if (base.startsWith('.')) return;
      if (eventType !== 'rename' && !isSupportedFile(full) && !isSupportedFile(filename)) {
        // rename peut être delete d'un supporté — on rafraîchit quand même si ext supportée
        const ext = path.extname(filename).toLowerCase();
        if (!SUPPORTED.has(ext)) return;
      }
      schedule(kind, root, eventType, full);
    });
    watcher.on('error', (err) => {
      console.warn(`[VDR] watcher ${kind}:`, err.message);
    });
    watchers.set(kind, watcher);
  } catch (err) {
    console.warn(`[VDR] impossible de surveiller ${kind} (${root}):`, err.message);
  }
}

/** Démarre / met à jour les watchers selon la config courante. */
export function syncWatchersFromConfig() {
  const { libraryRoot, importRoot } = getConfig();
  if (libraryRoot) watchDir('library', libraryRoot);
  else stopWatcher('library');
  if (importRoot) watchDir('import', importRoot);
  else stopWatcher('import');
}

export function stopWatcher(kind) {
  const w = watchers.get(kind);
  if (w) {
    try {
      w.close();
    } catch {
      // ignore
    }
    watchers.delete(kind);
  }
  const keyPrefix = `${kind}:`;
  for (const [k, t] of pending) {
    if (k.startsWith(keyPrefix)) {
      clearTimeout(t);
      pending.delete(k);
    }
  }
}

export function stopAllWatchers() {
  stopWatcher('library');
  stopWatcher('import');
}

export function getWatcherStatus() {
  const { libraryRoot, importRoot } = getConfig();
  return {
    library: { root: libraryRoot, active: watchers.has('library') },
    import: { root: importRoot, active: watchers.has('import') },
  };
}
