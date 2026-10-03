/**
 * Surveillance FS des dossiers library / import.
 * - fs.watch (récursif) en priorité
 * - Fallback polling si watch indisponible / erreur / FS fragile
 * - Debounce + fenêtre de stabilité pour éviter rafales
 */
import fs from 'fs';
import path from 'path';
import { BrowserWindow } from 'electron';
import { getConfig } from '../config.js';
import { IpcChannels } from '../../shared/ipc-channels.js';
import { SUPPORTED } from './scanner.js';

const DEBOUNCE_MS = 450;
const STABILITY_MS = 180;
const POLL_INTERVAL_MS = 2500;
/** Après N erreurs watch, bascule polling pour ce kind. */
const WATCH_ERROR_THRESHOLD = 2;

/** @typedef {'library' | 'import'} WatchKind */
/** @typedef {'watch' | 'poll' | 'none'} WatchMode */

/**
 * @typedef {object} WatchEntry
 * @property {WatchKind} kind
 * @property {string} root
 * @property {WatchMode} mode
 * @property {fs.FSWatcher | null} watcher
 * @property {NodeJS.Timeout | null} pollTimer
 * @property {Map<string, number>} pollSnapshot mtimeMs par chemin relatif
 * @property {number} watchErrors
 */

/** @type {Map<WatchKind, WatchEntry>} */
const entries = new Map();
/** @type {Map<string, NodeJS.Timeout>} */
const pending = new Map();
/** @type {Map<string, { at: number, timer: NodeJS.Timeout }>} */
const stability = new Map();

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

/**
 * Debounce + petite fenêtre de stabilité (mêmes events rapprochés).
 * @param {WatchKind} kind
 * @param {string} root
 * @param {string} [reason]
 * @param {string | null} [filePath]
 */
function schedule(kind, root, reason, filePath) {
  const stabKey = `${kind}:${filePath || root}:${reason || 'change'}`;
  const existing = stability.get(stabKey);
  if (existing) clearTimeout(existing.timer);
  stability.set(stabKey, {
    at: Date.now(),
    timer: setTimeout(() => {
      stability.delete(stabKey);
      enqueueDebounce(kind, root, reason, filePath);
    }, STABILITY_MS),
  });
}

function enqueueDebounce(kind, root, reason, filePath) {
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
        mode: entries.get(kind)?.mode || 'none',
        at: new Date().toISOString(),
      });
    }, DEBOUNCE_MS),
  );
}

/**
 * Snapshot récursif des fichiers supportés (relatif → mtimeMs).
 * @param {string} root
 * @returns {Map<string, number>}
 */
export function snapshotSupportedTree(root) {
  /** @type {Map<string, number>} */
  const map = new Map();
  if (!root || !fs.existsSync(root)) return map;

  /** @param {string} dir @param {string} rel */
  function walk(dir, rel) {
    let entriesDir;
    try {
      entriesDir = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entriesDir) {
      if (ent.name.startsWith('.')) continue;
      const relPath = rel ? path.join(rel, ent.name) : ent.name;
      const full = path.join(dir, ent.name);
      try {
        if (ent.isDirectory()) {
          walk(full, relPath);
        } else if (ent.isFile() && isSupportedFile(full)) {
          const st = fs.statSync(full);
          map.set(relPath, st.mtimeMs);
        }
      } catch {
        // fichier disparu pendant le walk
      }
    }
  }

  walk(root, '');
  return map;
}

/**
 * Compare deux snapshots ; true s’il y a un changement pertinent.
 * @param {Map<string, number>} prev
 * @param {Map<string, number>} next
 */
export function snapshotsDiffer(prev, next) {
  if (prev.size !== next.size) return true;
  for (const [k, v] of next) {
    if (prev.get(k) !== v) return true;
  }
  return false;
}

function clearEntryTimers(entry) {
  if (entry.pollTimer) {
    clearInterval(entry.pollTimer);
    entry.pollTimer = null;
  }
  if (entry.watcher) {
    try {
      entry.watcher.close();
    } catch {
      // ignore
    }
    entry.watcher = null;
  }
}

function startPolling(entry) {
  clearEntryTimers(entry);
  entry.mode = 'poll';
  entry.pollSnapshot = snapshotSupportedTree(entry.root);
  entry.pollTimer = setInterval(() => {
    const next = snapshotSupportedTree(entry.root);
    if (snapshotsDiffer(entry.pollSnapshot, next)) {
      entry.pollSnapshot = next;
      schedule(entry.kind, entry.root, 'poll');
    }
  }, POLL_INTERVAL_MS);
  // Unref pour ne pas bloquer le shutdown Electron en tests / CLI
  if (typeof entry.pollTimer.unref === 'function') entry.pollTimer.unref();
  console.info(`[VDR] watcher ${entry.kind}: mode poll →`, entry.root);
}

function startWatch(entry) {
  clearEntryTimers(entry);
  entry.mode = 'watch';
  entry.watchErrors = 0;

  try {
    const watcher = fs.watch(entry.root, { recursive: true }, (eventType, filename) => {
      if (!filename) {
        schedule(entry.kind, entry.root, eventType || 'change');
        return;
      }
      const full = path.join(entry.root, filename);
      const base = path.basename(filename);
      if (base.startsWith('.')) return;
      if (eventType !== 'rename' && !isSupportedFile(full) && !isSupportedFile(filename)) {
        const ext = path.extname(filename).toLowerCase();
        if (!SUPPORTED.has(ext)) return;
      }
      schedule(entry.kind, entry.root, eventType, full);
    });
    watcher.on('error', (err) => {
      entry.watchErrors += 1;
      console.warn(`[VDR] watcher ${entry.kind}:`, err.message);
      if (entry.watchErrors >= WATCH_ERROR_THRESHOLD) {
        console.warn(`[VDR] watcher ${entry.kind}: bascule polling après erreurs`);
        startPolling(entry);
      }
    });
    entry.watcher = watcher;
    // Snapshot initial aussi en mode watch (utile si watch rate-limité)
    entry.pollSnapshot = snapshotSupportedTree(entry.root);
    console.info(`[VDR] watcher ${entry.kind}: mode watch →`, entry.root);
  } catch (err) {
    console.warn(
      `[VDR] impossible de surveiller ${entry.kind} (${entry.root}), fallback poll:`,
      err.message,
    );
    startPolling(entry);
  }
}

/**
 * @param {WatchKind} kind
 * @param {string} root
 */
function watchDir(kind, root) {
  if (!root) return;
  try {
    fs.mkdirSync(root, { recursive: true });
  } catch {
    return;
  }
  if (!fs.existsSync(root)) return;

  stopWatcher(kind);

  /** @type {WatchEntry} */
  const entry = {
    kind,
    root,
    mode: 'none',
    watcher: null,
    pollTimer: null,
    pollSnapshot: new Map(),
    watchErrors: 0,
  };
  entries.set(kind, entry);

  // Certains FS (network, FUSE) n’émmettent pas bien — on tente watch puis poll.
  startWatch(entry);
}

/** Démarre / met à jour les watchers selon la config courante. */
export function syncWatchersFromConfig() {
  const { libraryRoot, importRoot } = getConfig();
  if (libraryRoot) watchDir('library', libraryRoot);
  else stopWatcher('library');
  if (importRoot) watchDir('import', importRoot);
  else stopWatcher('import');
}

/** @param {WatchKind} kind */
export function stopWatcher(kind) {
  const entry = entries.get(kind);
  if (entry) {
    clearEntryTimers(entry);
    entries.delete(kind);
  }
  const keyPrefix = `${kind}:`;
  for (const [k, t] of pending) {
    if (k.startsWith(keyPrefix)) {
      clearTimeout(t);
      pending.delete(k);
    }
  }
  for (const [k, s] of stability) {
    if (k.startsWith(keyPrefix)) {
      clearTimeout(s.timer);
      stability.delete(k);
    }
  }
}

export function stopAllWatchers() {
  stopWatcher('library');
  stopWatcher('import');
}

export function getWatcherStatus() {
  const { libraryRoot, importRoot } = getConfig();
  const lib = entries.get('library');
  const imp = entries.get('import');
  return {
    library: {
      root: libraryRoot,
      active: Boolean(lib),
      mode: lib?.mode || 'none',
      watchErrors: lib?.watchErrors || 0,
      trackedFiles: lib?.pollSnapshot?.size ?? 0,
    },
    import: {
      root: importRoot,
      active: Boolean(imp),
      mode: imp?.mode || 'none',
      watchErrors: imp?.watchErrors || 0,
      trackedFiles: imp?.pollSnapshot?.size ?? 0,
    },
    debounceMs: DEBOUNCE_MS,
    stabilityMs: STABILITY_MS,
    pollIntervalMs: POLL_INTERVAL_MS,
  };
}
