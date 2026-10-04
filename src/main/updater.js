/**
 * Auto-update via electron-updater + GitHub Releases.
 * Actif uniquement en build packagée (pas en `electron-vite dev`).
 */

import { app, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { IpcChannels } from '../shared/ipc-channels.js';

/** @typedef {import('electron').BrowserWindow} BrowserWindow */

const LOG = '[updater]';

/** Délai après boot avant le check (laisse l’UI s’afficher). */
const BOOT_CHECK_DELAY_MS = 4_000;

/** @type {BrowserWindow | null} */
let targetWindow = null;
let started = false;
let eventsWired = false;

/**
 * @param {BrowserWindow | null} win
 * @param {string} channel
 * @param {unknown} [payload]
 */
function push(win, channel, payload) {
  if (!win || win.isDestroyed()) return;
  try {
    win.webContents.send(channel, payload ?? null);
  } catch (err) {
    console.warn(LOG, 'push failed', err?.message || err);
  }
}

/**
 * Configure le provider GitHub (owner/repo du dépôt public).
 */
function configureGithub() {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'HozSensei',
    repo: 'Library-Chronicles',
  });
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // Pas de prompt natif — toasts renderer FR/EN.
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
}

/**
 * @param {BrowserWindow | null} win
 */
function wireEvents(win) {
  targetWindow = win;
  if (eventsWired) return;
  eventsWired = true;

  autoUpdater.on('checking-for-update', () => {
    push(targetWindow, IpcChannels.UPDATE_STATUS, { state: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    push(targetWindow, IpcChannels.UPDATE_STATUS, {
      state: 'available',
      version: info?.version || null,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    push(targetWindow, IpcChannels.UPDATE_STATUS, {
      state: 'not-available',
      version: info?.version || app.getVersion(),
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    push(targetWindow, IpcChannels.UPDATE_STATUS, {
      state: 'downloading',
      percent: Math.round(Number(progress?.percent) || 0),
      version: null,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    push(targetWindow, IpcChannels.UPDATE_STATUS, {
      state: 'downloaded',
      version: info?.version || null,
    });
  });

  autoUpdater.on('error', (err) => {
    console.warn(LOG, err?.message || err);
    push(targetWindow, IpcChannels.UPDATE_STATUS, {
      state: 'error',
      message: String(err?.message || err || 'update error'),
    });
  });
}

/**
 * Démarre le check au boot (packaged only).
 * @param {BrowserWindow | null} win
 */
export function startAutoUpdater(win) {
  targetWindow = win;
  wireEvents(win);

  if (started) return;
  if (!app.isPackaged) {
    console.log(LOG, 'skip — unpackaged (dev)');
    return;
  }

  started = true;
  configureGithub();

  setTimeout(() => {
    void checkForUpdates({ silent: true });
  }, BOOT_CHECK_DELAY_MS);
}

/**
 * @param {{ silent?: boolean }} [opts]
 */
export async function checkForUpdates(opts = {}) {
  if (!app.isPackaged) {
    return { ok: false, reason: 'dev' };
  }
  try {
    if (!started) {
      configureGithub();
      started = true;
    }
    const result = await autoUpdater.checkForUpdates();
    return {
      ok: true,
      version: result?.updateInfo?.version || null,
      silent: Boolean(opts.silent),
    };
  } catch (err) {
    console.warn(LOG, 'check failed', err?.message || err);
    push(targetWindow, IpcChannels.UPDATE_STATUS, {
      state: 'error',
      message: String(err?.message || err || 'check failed'),
    });
    return { ok: false, reason: 'error', message: String(err?.message || err) };
  }
}

/** Quitte et installe la mise à jour téléchargée. */
export function quitAndInstall() {
  try {
    // isSilent=false, isForceRunAfter=true
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  } catch (err) {
    console.warn(LOG, 'quitAndInstall', err?.message || err);
    return { ok: false, message: String(err?.message || err) };
  }
}

export function registerUpdaterIpc() {
  ipcMain.handle(IpcChannels.UPDATE_CHECK, () => checkForUpdates({ silent: false }));
  ipcMain.handle(IpcChannels.UPDATE_QUIT_AND_INSTALL, () => quitAndInstall());
  ipcMain.handle(IpcChannels.UPDATE_GET_STATUS, () => ({
    packaged: app.isPackaged,
    version: app.getVersion(),
    started,
  }));
}
