import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels.js';
import { openBook } from '../extractors/index.js';
import { setConfig } from '../config.js';

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

    return {
      title: book.title,
      format: book.format,
      pageCount: book.pageCount,
      filePath,
    };
  });

  ipcMain.handle(IpcChannels.READER_GET_PAGE, async (_e, index) => {
    if (!session) throw new Error('Aucun livre ouvert');
    const buffer = await session.getPage(index);
    return {
      index,
      mime: 'image/jpeg',
      data: buffer ? buffer.toString('base64') : null,
    };
  });

  ipcMain.handle(IpcChannels.READER_CLOSE, async () => {
    if (session) {
      await session.close().catch(() => {});
      session = null;
    }
    return { ok: true };
  });
}
