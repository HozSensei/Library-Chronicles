const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { IpcChannels } = require('../shared/ipc-channels');
const { registerLibraryIpc } = require('./ipc/library');
const { registerReaderIpc } = require('./ipc/reader');
const { registerProgressIpc } = require('./ipc/progress');
const { getConfig, setConfig } = require('./config');
const { initDatabase } = require('./database/db');

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
    backgroundColor: '#0d1117',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // nécessaire pour certains extracteurs natifs via IPC
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
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
