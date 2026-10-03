import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels.js';
import { openBook } from '../extractors/index.js';
import { setConfig } from '../config.js';
import { getBookByPath } from '../database/books.js';
import { createLruMap } from '../../shared/perf-cache.js';

let session = null;
/** Cache IPC base64 pages courantes ±N (évite re-encode à chaque getPage). */
let pagePayloadCache = createLruMap(10);
/** @type {Map<number, Promise<object>>} */
let pageInflight = new Map();

function clearPageCaches() {
  pagePayloadCache = createLruMap(10);
  pageInflight = new Map();
}

function encodePagePayload(index, page) {
  if (Buffer.isBuffer(page)) {
    return {
      index,
      mime: 'image/jpeg',
      data: page.toString('base64'),
    };
  }
  return {
    index,
    mime: page.mime || 'image/jpeg',
    data: page.buffer ? page.buffer.toString('base64') : null,
    name: page.name || null,
    engine: page.engine || null,
    placeholder: Boolean(page.placeholder),
  };
}

export function registerReaderIpc() {
  ipcMain.handle(IpcChannels.READER_OPEN, async (_e, filePath) => {
    if (session) {
      await session.close().catch(() => {});
      session = null;
    }
    clearPageCaches();

    const book = await openBook(filePath);
    session = book;
    setConfig({ lastOpenedPath: filePath });

    const dbBook = getBookByPath(filePath);

    return {
      title: dbBook?.title || book.title,
      format: book.format,
      pageCount: book.pageCount,
      filePath,
      chapters: book.chapters || [],
      bookId: dbBook?.id ?? null,
      series: dbBook?.series ?? null,
      seriesId: dbBook?.seriesId ?? null,
      volume: dbBook?.volume ?? null,
      resumePage: dbBook?.pageCurrent ?? 0,
      direction: undefined,
      renderEngine: book.renderEngine || null,
    };
  });

  ipcMain.handle(IpcChannels.READER_GET_PAGE, async (_e, index) => {
    if (!session) throw new Error('Aucun livre ouvert');
    const idx = Number(index);
    const cached = pagePayloadCache.get(idx);
    if (cached) return cached;
    if (pageInflight.has(idx)) return pageInflight.get(idx);

    const promise = (async () => {
      const page = await session.getPage(idx);
      const payload = encodePagePayload(idx, page);
      pagePayloadCache.set(idx, payload);
      return payload;
    })().finally(() => {
      pageInflight.delete(idx);
    });
    pageInflight.set(idx, promise);
    return promise;
  });

  ipcMain.handle(IpcChannels.READER_GET_CHAPTERS, async () => {
    if (!session) return [];
    return session.chapters || [];
  });

  ipcMain.handle(IpcChannels.READER_CLOSE, async () => {
    if (session) {
      await session.close().catch(() => {});
    }
    session = null;
    clearPageCaches();
    return { ok: true };
  });
}
