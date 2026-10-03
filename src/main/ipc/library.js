import { ipcMain, dialog } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels.js';
import { getConfig, setConfig } from '../config.js';
import { scanLibraryRoot } from '../library/scanner.js';
import { listBooks } from '../database/books.js';

export function registerLibraryIpc() {
  ipcMain.handle(IpcChannels.LIBRARY_SELECT_ROOT, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Choisir le dossier racine des BD',
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const root = result.filePaths[0];
    setConfig({ libraryRoot: root });
    return root;
  });

  ipcMain.handle(IpcChannels.LIBRARY_SCAN, async () => {
    const { libraryRoot } = getConfig();
    if (!libraryRoot) return { found: [], error: 'Aucun dossier racine' };
    return scanLibraryRoot(libraryRoot);
  });

  ipcMain.handle(IpcChannels.LIBRARY_LIST, async () => listBooks());

  ipcMain.handle(IpcChannels.LIBRARY_GET_COVER, async () => null);
}
