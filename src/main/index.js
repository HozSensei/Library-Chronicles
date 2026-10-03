import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { IpcChannels } from '../shared/ipc-channels.js';
import { registerLibraryIpc } from './ipc/library.js';
import { registerReaderIpc } from './ipc/reader.js';
import { registerProgressIpc } from './ipc/progress.js';
import { getConfig, setConfig } from './config.js';
import { initDatabase } from './database/db.js';

/** Résolution portrait cible ROG Ally X (mode vertical). */
const PORTRAIT = { width: 1080, height: 1920 };

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: PORTRAIT.width,
    height: PORTRAIT.height,
    minWidth: 540,
    minHeight: 960,
    title: 'Vertical Deck Reader',
    backgroundColor: '#0b0c0f',
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
    // DevTools détachées uniquement si flag explicite
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
  ipcMain.handle(IpcChannels.APP_SET_CONFIG, (_event, patch) => setConfig(patch));
}

app.whenReady().then(() => {
  // TODO[Phase 3]: init DB réelle + migration schéma
  initDatabase();

  registerAppIpc();
  registerLibraryIpc();
  registerReaderIpc();
  registerProgressIpc();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
