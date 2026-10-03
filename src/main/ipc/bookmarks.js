import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels.js';
import {
  listBookmarks,
  listAllBookmarks,
  addBookmark,
  removeBookmark,
  removeBookmarkAtPage,
} from '../database/bookmarks.js';

export function registerBookmarksIpc() {
  ipcMain.handle(IpcChannels.BOOKMARKS_LIST, (_e, { bookId, profileId } = {}) =>
    listBookmarks(bookId, profileId ?? null),
  );

  ipcMain.handle(IpcChannels.BOOKMARKS_LIST_ALL, (_e, profileId) =>
    listAllBookmarks(profileId ?? null),
  );

  ipcMain.handle(IpcChannels.BOOKMARKS_ADD, (_e, payload) =>
    addBookmark(payload || {}),
  );

  ipcMain.handle(IpcChannels.BOOKMARKS_REMOVE, (_e, id) => removeBookmark(id));

  ipcMain.handle(IpcChannels.BOOKMARKS_REMOVE_AT, (_e, { bookId, page }) =>
    removeBookmarkAtPage(bookId, page),
  );
}
