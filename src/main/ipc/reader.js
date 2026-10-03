import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels.js';
import { openBook } from '../extractors/index.js';
import { setConfig } from '../config.js';
import { getBookByPath } from '../database/books.js';

let session = null;

export function registerReaderIpc() {
  ipcMain.handle(IpcChannels.READER_OPEN, async (_e, filePath) => {
    if (session) {
      await session.close().catch(() => {});
      session = null;
    }

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
      resumePage: dbBook?.pageCurrent ?? 0,
      direction: undefined,
      renderEngine: book.renderEngine || null,
    };
  });

  ipcMain.handle(IpcChannels.READER_GET_PAGE, async (_e, index) => {
    if (!session) throw new Error('Aucun livre ouvert');
    const page = await session.getPage(index);
    // Compat : getPage peut renvoyer Buffer (legacy) ou { buffer, mime }
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
    return { ok: true };
  });
}
