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

/** Résolution portrait cible ROG Ally X (mode vertical). */
const PORTRAIT = { width: 1080, height: 1920 };

let mainWindow = null;

function createWindow() {
  const theme = getConfig().theme || 'dark';
  mainWindow = new BrowserWindow({
    width: PORTRAIT.width,
    height: PORTRAIT.height,
    minWidth: 540,
    minHeight: 960,
    title: 'Vertical Deck Reader',
    backgroundColor: theme === 'light' ? '#f4efe6' : '#0b0c0f',
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

function registerAppIpc() {
  ipcMain.handle(IpcChannels.APP_GET_CONFIG, () => getConfig());
  ipcMain.handle(IpcChannels.APP_SET_CONFIG, (_event, patch) => {
    const next = setConfig(patch);
    if (patch.libraryRoot !== undefined || patch.importRoot !== undefined) {
      syncWatchersFromConfig();
    }
    return next;
  });
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
  // Garantit un profil actif dès le démarrage
  getActiveProfileId();
  // Choix profil à chaque lancement (après setup)
  setConfig({ profileSelected: false });

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
