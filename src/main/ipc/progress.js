import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels.js';
import { loadProgress } from '../database/books.js';

export function registerProgressIpc() {
  ipcMain.handle(IpcChannels.PROGRESS_SAVE, async (_e, payload) => {
    console.info('[VDR] progress:save (stub)', payload);
    return { ok: true, stub: true };
  });

  ipcMain.handle(IpcChannels.PROGRESS_LOAD, async (_e, filePath) => loadProgress(filePath));
}
