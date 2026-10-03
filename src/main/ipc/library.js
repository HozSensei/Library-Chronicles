import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import { IpcChannels } from '../../shared/ipc-channels.js';
import { getConfig, setConfig } from '../config.js';
import { scanLibraryRoot } from '../library/scanner.js';
import {
  listBooks,
  updateBook,
  getContinueBook,
  getLastAccessedBook,
  listRecentBooks,
  getBookById,
  getBookByPath,
  upsertBook,
  pruneMissingBooks,
  listSeries,
  getNextUnreadInSeries,
} from '../database/books.js';
import { coverToDataUrl } from '../library/thumbnails.js';
import { openBook } from '../extractors/index.js';
import { ensureCover } from '../library/thumbnails.js';
import { syncWatchersFromConfig } from '../library/watcher.js';
import { detectFromFilename } from '../metadata/parse-filename.js';

export function registerLibraryIpc() {
  ipcMain.handle(IpcChannels.LIBRARY_SELECT_ROOT, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choisir le dossier bibliothèque',
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const root = result.filePaths[0];
    fs.mkdirSync(root, { recursive: true });
    setConfig({ libraryRoot: root });
    syncWatchersFromConfig();
    return root;
  });

  ipcMain.handle(IpcChannels.LIBRARY_SELECT_IMPORT, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choisir le dossier d’import',
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const root = result.filePaths[0];
    fs.mkdirSync(root, { recursive: true });
    setConfig({ importRoot: root });
    syncWatchersFromConfig();
    return root;
  });

  ipcMain.handle(IpcChannels.LIBRARY_SCAN, async () => {
    const { libraryRoot } = getConfig();
    if (!libraryRoot) return { found: [], error: 'Aucun dossier racine' };
    const scan = await scanLibraryRoot(libraryRoot);

    // Indexer les nouveaux fichiers (+ détection série/tome depuis le nom)
    for (const file of scan.found) {
      try {
        const book = await openBook(file.filePath);
        let coverPath = null;
        try {
          coverPath = await ensureCover(file.filePath, () => book.getCoverBuffer());
        } catch {
          // ignore cover errors
        }
        const detected = detectFromFilename(file.filePath);
        const existing = getBookByPath(file.filePath);
        // Préserver métadonnées manuelles si déjà présentes
        upsertBook({
          filePath: file.filePath,
          title: existing?.series
            ? existing.title
            : detected.title || book.title || file.name,
          series: existing?.series ?? detected.series ?? null,
          volume: existing?.volume ?? detected.volume ?? null,
          year: existing?.year ?? detected.year ?? null,
          author: existing?.author ?? detected.author ?? null,
          format: file.format,
          coverPath,
          pageTotal: book.pageCount,
        });
        await book.close();
      } catch (err) {
        console.warn('[VDR] scan skip', file.filePath, err.message);
      }
    }

    const removed = pruneMissingBooks(scan.found.map((f) => f.filePath));

    return { ...scan, removed, books: listBooks() };
  });

  ipcMain.handle(IpcChannels.LIBRARY_LIST, async () => listBooks());

  ipcMain.handle(IpcChannels.LIBRARY_GET_COVER, async (_e, bookId) => {
    const book = getBookById(bookId);
    if (!book?.coverPath) return null;
    return coverToDataUrl(book.coverPath);
  });

  ipcMain.handle(IpcChannels.LIBRARY_UPDATE_BOOK, async (_e, { id, patch }) =>
    updateBook(id, patch),
  );

  ipcMain.handle(IpcChannels.LIBRARY_CONTINUE, async () => getContinueBook());

  ipcMain.handle(IpcChannels.LIBRARY_RECENT, async (_e, limit = 12) =>
    listRecentBooks(limit),
  );

  ipcMain.handle(IpcChannels.LIBRARY_LAST_ACCESSED, async (_e, excludeId = null) =>
    getLastAccessedBook(excludeId),
  );

  ipcMain.handle(IpcChannels.LIBRARY_SERIES, async () => listSeries());

  ipcMain.handle(
    IpcChannels.LIBRARY_NEXT_UNREAD,
    async (_e, { seriesId, afterVolume, afterBookId } = {}) =>
      getNextUnreadInSeries(seriesId, { afterVolume, afterBookId }),
  );
}
