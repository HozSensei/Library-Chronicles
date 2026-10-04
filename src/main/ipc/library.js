import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import { IpcChannels } from '../../shared/ipc-channels.js';
import { getConfig, setConfig } from '../config.js';
import { scanLibraryRoot } from '../library/scanner.js';
import {
  listBooks,
  updateBook,
  deleteBook,
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
import {
  coverToDataUrl,
  ensureCover,
  ensureCoverFromUrl,
  invalidateCoverDataUrl,
} from '../library/thumbnails.js';
import { openBook } from '../extractors/index.js';
import { syncWatchersFromConfig } from '../library/watcher.js';
import { detectFromFilename } from '../metadata/parse-filename.js';
import { getActiveProfileId, setProfilePrefs } from '../database/profiles.js';
import { normalizeRemoteCoverUrl } from '../../shared/cover-url.js';

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
    const pid = getActiveProfileId();
    if (pid != null) setProfilePrefs({ libraryRoot: root }, pid);
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
    const pid = getActiveProfileId();
    if (pid != null) setProfilePrefs({ importRoot: root }, pid);
    syncWatchersFromConfig();
    return root;
  });

  /**
   * Scan bibliothèque.
   * @param {{ force?: boolean }} [opts]
   *   force=true (bouton Scanner) : ré-ouvre tous les fichiers.
   *   force=false (watcher) : n’ouvre que les fichiers absents / sans cover / pageTotal=0.
   */
  ipcMain.handle(IpcChannels.LIBRARY_SCAN, async (_e, opts = {}) => {
    const force = Boolean(opts?.force);
    const { libraryRoot } = getConfig();
    if (!libraryRoot) {
      return { found: [], error: 'Aucun dossier racine', indexed: 0, skipped: 0 };
    }
    const scan = await scanLibraryRoot(libraryRoot);
    const pid = getActiveProfileId();
    let indexed = 0;
    let skipped = 0;

    for (const file of scan.found) {
      try {
        const existing = getBookByPath(file.filePath);
        const remoteCoverUrl = normalizeRemoteCoverUrl(
          existing?.metadata?.coverUrl,
        );
        // Jacket API connue mais pas encore marquée remote (ex. race watcher
        // a écrit page 0) → ne pas skip, re-télécharger la jaquette.
        const needsRemoteCover =
          Boolean(remoteCoverUrl) &&
          existing?.metadata?.coverSource !== 'remote';

        if (
          !force &&
          existing &&
          existing.pageTotal > 0 &&
          existing.coverPath &&
          fs.existsSync(existing.coverPath) &&
          !needsRemoteCover
        ) {
          skipped += 1;
          continue;
        }

        const book = await openBook(file.filePath);
        let coverPath = null;
        let coverSource = existing?.metadata?.coverSource || null;

        // Priorité jacket API (coverUrl persisté à l’import) sur page 0 archive.
        if (remoteCoverUrl) {
          try {
            coverPath = await ensureCoverFromUrl(
              file.filePath,
              remoteCoverUrl,
              pid,
            );
            coverSource = 'remote';
          } catch (err) {
            console.warn('[VDR] scan jacket API:', err.message);
          }
        }

        if (!coverPath) {
          try {
            coverPath = await ensureCover(
              file.filePath,
              () => book.getCoverBuffer(),
              pid,
            );
            if (coverPath && coverSource !== 'remote') {
              coverSource = 'archive';
            }
          } catch {
            // ignore cover errors
          }
        }

        const detected = detectFromFilename(file.filePath);
        const nextMetadata =
          remoteCoverUrl || existing?.metadata
            ? {
                ...(existing?.metadata || {}),
                coverUrl: remoteCoverUrl || existing?.metadata?.coverUrl || null,
                coverSource,
              }
            : undefined;
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
          metadata: nextMetadata,
        });
        await book.close();
        indexed += 1;
      } catch (err) {
        console.warn('[VDR] scan skip', file.filePath, err.message);
      }
    }

    const removed = pruneMissingBooks(scan.found.map((f) => f.filePath));

    return { ...scan, removed, books: listBooks(), indexed, skipped, force };
  });

  ipcMain.handle(IpcChannels.LIBRARY_LIST, async () => listBooks());

  ipcMain.handle(IpcChannels.LIBRARY_GET_COVER, async (_e, bookId) => {
    const book = getBookById(bookId);
    if (!book?.coverPath) return null;
    return coverToDataUrl(book.coverPath);
  });

  ipcMain.handle(IpcChannels.LIBRARY_UPDATE_BOOK, async (_e, { id, patch }) => {
    const bookId = Number(id);
    if (!Number.isFinite(bookId)) return null;
    const existing = getBookById(bookId);
    if (!existing) return null;

    const nextPatch = patch && typeof patch === 'object' ? { ...patch } : {};
    const incomingMeta =
      nextPatch.metadata && typeof nextPatch.metadata === 'object'
        ? { ...nextPatch.metadata }
        : null;

    if (incomingMeta) {
      const remoteCoverUrl = normalizeRemoteCoverUrl(incomingMeta.coverUrl);
      const prevCoverUrl = normalizeRemoteCoverUrl(existing?.metadata?.coverUrl);
      const wantsRemote =
        Boolean(remoteCoverUrl) &&
        (remoteCoverUrl !== prevCoverUrl ||
          existing?.metadata?.coverSource !== 'remote' ||
          !existing?.coverPath);

      if (remoteCoverUrl) {
        incomingMeta.coverUrl = remoteCoverUrl;
      }

      if (wantsRemote && remoteCoverUrl && existing.filePath) {
        try {
          const pid = getActiveProfileId();
          const coverPath = await ensureCoverFromUrl(
            existing.filePath,
            remoteCoverUrl,
            pid,
          );
          nextPatch.coverPath = coverPath;
          incomingMeta.coverSource = 'remote';
          delete incomingMeta.coverError;
          if (existing.coverPath && existing.coverPath !== coverPath) {
            invalidateCoverDataUrl(existing.coverPath);
          }
          invalidateCoverDataUrl(coverPath);
        } catch (err) {
          console.warn('[VDR] updateBook jacket API:', err?.message || err);
          incomingMeta.coverSource =
            existing?.metadata?.coverSource === 'remote'
              ? 'remote'
              : existing?.metadata?.coverSource || null;
          incomingMeta.coverError = String(err?.message || err);
        }
      } else if (
        Object.prototype.hasOwnProperty.call(incomingMeta, 'coverUrl') &&
        !remoteCoverUrl
      ) {
        // cover coché mais URL absente / invalide
        incomingMeta.coverUrl = null;
        console.warn('[VDR] updateBook: coverUrl manquante ou invalide');
      }

      nextPatch.metadata = {
        ...(existing.metadata || {}),
        ...incomingMeta,
      };
    }

    return updateBook(bookId, nextPatch);
  });

  ipcMain.handle(IpcChannels.LIBRARY_DELETE_BOOK, async (_e, id) => {
    const bookId = Number(id);
    if (!Number.isFinite(bookId)) return { ok: false, error: 'id invalide' };
    const existing = getBookById(bookId);
    if (!existing) return { ok: false, error: 'Livre introuvable' };
    deleteBook(bookId);
    return { ok: true, id: bookId };
  });

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
