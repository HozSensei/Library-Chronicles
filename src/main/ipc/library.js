const { ipcMain, dialog } = require('electron');
const { IpcChannels } = require('../../shared/ipc-channels');
const { getConfig, setConfig } = require('../config');
const { scanLibraryRoot } = require('../library/scanner');
const { listBooks } = require('../database/books');

function registerLibraryIpc() {
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
    // TODO[Phase 3]: scanner + miniatures + DB
    return scanLibraryRoot(libraryRoot);
  });

  ipcMain.handle(IpcChannels.LIBRARY_LIST, async () => {
    // TODO[Phase 3]: listBooks() réel
    return listBooks();
  });

  ipcMain.handle(IpcChannels.LIBRARY_GET_COVER, async (_e, _bookId) => {
    // TODO[Phase 3]: chemin cover cache
    return null;
  });
}

module.exports = { registerLibraryIpc };
