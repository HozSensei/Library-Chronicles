import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels.js';
import {
  loadProgress,
  saveProgressByPath,
  saveProgress,
  getBookByPath,
} from '../database/books.js';

export function registerProgressIpc() {
  ipcMain.handle(IpcChannels.PROGRESS_SAVE, async (_e, payload) => {
    const { filePath, bookId, pageCurrent, pageTotal } = payload || {};
    if (bookId != null) {
      return saveProgress(bookId, pageCurrent, pageTotal);
    }
    if (filePath) {
      // Auto-créer l’entrée si absente ? Non — tenter path
      const book = getBookByPath(filePath);
      if (book) return saveProgress(book.id, pageCurrent, pageTotal);
      return saveProgressByPath(filePath, pageCurrent, pageTotal);
    }
    return { ok: false, error: 'payload invalide' };
  });

  ipcMain.handle(IpcChannels.PROGRESS_LOAD, async (_e, filePath) =>
    loadProgress(filePath),
  );
}
