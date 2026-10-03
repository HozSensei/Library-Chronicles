import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import fs from 'fs';
import { IpcChannels } from '../shared/ipc-channels.js';
import { registerLibraryIpc } from './ipc/library.js';
import { registerReaderIpc } from './ipc/reader.js';
import { registerProgressIpc } from './ipc/progress.js';
import { registerImportIpc } from './ipc/import.js';
import { registerMetadataIpc } from './ipc/metadata.js';
import { registerProfilesIpc } from './ipc/profiles.js';
import { registerBookmarksIpc } from './ipc/bookmarks.js';
import { getConfig, setConfig, getDefaultPaths } from './config.js';
import { initDatabase, closeDatabase } from './database/db.js';
import { getActiveProfileId } from './database/profiles.js';
import {
  syncWatchersFromConfig,
  stopAllWatchers,
  getWatcherStatus,
} from './library/watcher.js';
import { destroyPdfElectronHost } from './extractors/pdf-electron-canvas.js';
import { applyWindowOrientation, boundsForOrientation } from './window-bounds.js';

let mainWindow = null;

function createWindow() {
  const config = getConfig();
  const theme = config.theme || 'dark';
  const bounds = boundsForOrientation(config.orientation);
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: bounds.minWidth,
    minHeight: bounds.minHeight,
    title: 'Vertical Deck Reader',
    backgroundColor: theme === 'light' ? '#eef3f8' : '#0e1419',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  if (process.argv.includes('--dev') || !app.isPackaged) {
    if (process.argv.includes('--devtools')) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function notifyOrientation(orientation) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(IpcChannels.APP_ORIENTATION_CHANGED, {
    orientation,
  });
}

/**
 * Mode session UI (landscape) vs lecture (portrait).
 * Menus = toujours landscape ; portrait uniquement en reader.
 * Au boot on force landscape — on ne persiste portrait que pendant la lecture
 * pour éviter un redémarrage menus encore en portrait-ccw.
 */
function applySessionMode(mode) {
  const isReader = mode === 'reader';
  const orientation = isReader ? 'portrait-ccw' : 'landscape';
  const prev = getConfig();
  // Hors lecteur : persister landscape même si déjà landscape (répare stale portrait)
  const next =
    prev.orientation === orientation && isReader
      ? prev
      : setConfig({ orientation });
  applyWindowOrientation(mainWindow, orientation);
  notifyOrientation(orientation);
  return {
    mode: isReader ? 'reader' : 'ui',
    orientation: next.orientation || orientation,
  };
}

function registerAppIpc() {
  ipcMain.handle(IpcChannels.APP_GET_CONFIG, () => getConfig());
  ipcMain.handle(IpcChannels.APP_SET_CONFIG, (_event, patch) => {
    const prev = getConfig();
    const next = setConfig(patch);
    if (patch.libraryRoot !== undefined || patch.importRoot !== undefined) {
      syncWatchersFromConfig();
    }
    if (
      patch.orientation !== undefined &&
      patch.orientation !== prev.orientation
    ) {
      applyWindowOrientation(mainWindow, next.orientation);
      notifyOrientation(next.orientation);
    }
    return next;
  });
  ipcMain.handle(IpcChannels.APP_SET_SESSION_MODE, (_e, { mode } = {}) =>
    applySessionMode(mode),
  );
  ipcMain.handle(IpcChannels.APP_GET_DEFAULT_PATHS, () => getDefaultPaths());
  ipcMain.handle(IpcChannels.APP_PICK_DIRECTORY, async (_e, { title } = {}) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: title || 'Choisir un dossier',
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const dir = result.filePaths[0];
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  });
  ipcMain.handle(IpcChannels.WATCH_STATUS, () => getWatcherStatus());
}

app.whenReady().then(() => {
  initDatabase();
  // Profil actif optionnel (écran « Qui lit ? » peut être vide)
  getActiveProfileId();
  // Choix profil à chaque lancement
  setConfig({ profileSelected: false, orientation: 'landscape' });

  // Menus toujours landscape au boot ; `--portrait` force lecture (dev).
  if (process.argv.includes('--portrait')) {
    setConfig({ orientation: 'portrait-ccw' });
  } else {
    setConfig({ orientation: 'landscape' });
  }

  registerAppIpc();
  registerLibraryIpc();
  registerReaderIpc();
  registerProgressIpc();
  registerImportIpc();
  registerMetadataIpc();
  registerProfilesIpc();
  registerBookmarksIpc();

  syncWatchersFromConfig();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopAllWatchers();
  destroyPdfElectronHost().catch(() => {});
  closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopAllWatchers();
});
