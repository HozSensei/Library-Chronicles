import fs from 'fs';
import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels.js';
import { openBook } from '../extractors/index.js';
import { setConfig } from '../config.js';
import { getBookByPath } from '../database/books.js';
import { createLruMap } from '../../shared/perf-cache.js';

let session = null;
/** Chemin fichier de la session courante (pour getBytes / epub.js). */
let sessionPath = null;
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
    kind: page.kind || null,
    placeholder: Boolean(page.placeholder),
  };
}

export function registerReaderIpc() {
  ipcMain.handle(IpcChannels.READER_OPEN, async (_e, filePath) => {
    if (session) {
      await session.close().catch(() => {});
      session = null;
    }
    sessionPath = null;
    clearPageCaches();

    const book = await openBook(filePath);
    session = book;
    sessionPath = filePath;
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
      author: book.author || dbBook?.author || null,
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

  /**
   * Octets bruts du fichier ouvert — utilisé par le renderer epub.js
   * (pagination viewport native, sans colonnes CSS maison).
   */
  ipcMain.handle(IpcChannels.READER_GET_BYTES, async () => {
    if (!sessionPath) throw new Error('Aucun livre ouvert');
    if (!fs.existsSync(sessionPath)) {
      throw new Error('Fichier introuvable: ' + sessionPath);
    }
    const buf = fs.readFileSync(sessionPath);
    const format = session?.format || null;
    return {
      data: buf.toString('base64'),
      mime:
        format === 'epub'
          ? 'application/epub+zip'
          : 'application/octet-stream',
      format,
      byteLength: buf.length,
    };
  });

  ipcMain.handle(IpcChannels.READER_CLOSE, async () => {
    if (session) {
      await session.close().catch(() => {});
    }
    session = null;
    sessionPath = null;
    clearPageCaches();
    return { ok: true };
  });
}
