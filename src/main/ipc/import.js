import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels.js';
import { getConfig } from '../config.js';
import {
  scanImportFolder,
  commitImport,
  previewCover,
  previewCoverFromUrl,
} from '../library/import.js';

export function registerImportIpc() {
  ipcMain.handle(IpcChannels.IMPORT_SCAN, async (_e, importRoot) => {
    const root = importRoot || getConfig().importRoot;
    return scanImportFolder(root);
  });

  ipcMain.handle(IpcChannels.IMPORT_COMMIT, async (_e, payload) =>
    commitImport(payload || {}),
  );

  ipcMain.handle(IpcChannels.IMPORT_PREVIEW_COVER, async (_e, filePath) =>
    previewCover(filePath),
  );

  ipcMain.handle(IpcChannels.IMPORT_PREVIEW_COVER_URL, async (_e, coverUrl) => {
    try {
      return await previewCoverFromUrl(coverUrl);
    } catch (err) {
      console.warn('[VDR] previewCoverFromUrl:', err.message);
      return null;
    }
  });
}
