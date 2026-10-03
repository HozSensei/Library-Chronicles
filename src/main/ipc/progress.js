const { ipcMain } = require('electron');
const { IpcChannels } = require('../../shared/ipc-channels');
const { saveProgress, loadProgress } = require('../database/books');

function registerProgressIpc() {
  ipcMain.handle(IpcChannels.PROGRESS_SAVE, async (_e, payload) => {
    // payload: { filePath, pageCurrent, pageTotal }
    // TODO[Phase 3]: upsert book + saveProgress
    console.info('[VDR] progress:save (stub)', payload);
    return { ok: true, stub: true };
  });

  ipcMain.handle(IpcChannels.PROGRESS_LOAD, async (_e, filePath) => {
    // TODO[Phase 3]
    return loadProgress(filePath);
  });
}

module.exports = { registerProgressIpc };
