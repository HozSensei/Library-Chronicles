import { app, BrowserWindow, ipcMain, dialog, screen } from 'electron';
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
import {
  applyWindowOrientation,
  boundsForOrientation,
  clampSizeToWorkArea,
  centerInWorkArea,
  needsCssPortraitRotate,
} from './window-bounds.js';
import { showWindowsVirtualKeyboard } from './virtual-keyboard.js';

let mainWindow = null;

function primaryWorkArea() {
  try {
    return screen.getPrimaryDisplay().workArea;
  } catch {
    return { x: 0, y: 0, width: 1920, height: 1080 };
  }
}

function createWindow() {
  const config = getConfig();
  const theme = config.theme || 'dark';
  // Boot menus = 1080p landscape, clamper à l’écran, centré, pas de fullscreen.
  const orientation =
    config.orientation === 'portrait-ccw' && process.argv.includes('--portrait')
      ? 'portrait-ccw'
      : 'landscape';
  const workArea = primaryWorkArea();
  const desired = boundsForOrientation(orientation);
  const bounds = clampSizeToWorkArea(desired, workArea);
  const pos = centerInWorkArea(bounds, workArea);

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: pos.x,
    y: pos.y,
    minWidth: bounds.minWidth,
    minHeight: bounds.minHeight,
    title: 'Vertical Deck Reader',
    backgroundColor: theme === 'light' ? '#eef3f8' : '#0e1419',
    autoHideMenuBar: true,
    show: false,
    fullscreen: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
    mainWindow.show();
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
 * Mode session UI vs lecture.
 * Stratégie B : fenêtre toujours landscape (plein workArea).
 * Lecteur = orientation logique portrait-ccw + rotation CSS +90° du plan
 * (jamais setBounds 1080×1920 → évite le shrink Ally 1080×1080).
 * setBounds uniquement si l’orientation session change ou force.
 */
function applySessionMode(mode, { force = false } = {}) {
  const isReader = mode === 'reader';
  const orientation = isReader ? 'portrait-ccw' : 'landscape';
  const prev = getConfig();
  const changed = prev.orientation !== orientation;
  const workArea = primaryWorkArea();

  if (changed) {
    setConfig({ orientation });
  }

  // Toujours viser landscape plein écran (stratégie B).
  let applied = clampSizeToWorkArea(boundsForOrientation('landscape'), workArea);

  if (changed || force) {
    applied = applyWindowOrientation(mainWindow, 'landscape', workArea) || applied;
    notifyOrientation(orientation);
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    const [w, h] = mainWindow.getSize();
    applied = { width: w, height: h };
  }

  const cssRotate = needsCssPortraitRotate(orientation, applied);

  return {
    mode: isReader ? 'reader' : 'ui',
    orientation,
    bounds: { width: applied.width, height: applied.height },
    cssRotate,
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
      applyWindowOrientation(mainWindow, next.orientation, primaryWorkArea());
      notifyOrientation(next.orientation);
    }
    return next;
  });
  ipcMain.handle(IpcChannels.APP_SET_SESSION_MODE, (_e, { mode, force } = {}) =>
    applySessionMode(mode, { force: Boolean(force) }),
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
  ipcMain.handle(IpcChannels.APP_SHOW_VIRTUAL_KEYBOARD, () =>
    showWindowsVirtualKeyboard(),
  );
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
