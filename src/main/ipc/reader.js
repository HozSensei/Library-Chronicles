const { ipcMain } = require('electron');
const { IpcChannels } = require('../../shared/ipc-channels');
const { openBook } = require('../extractors');
const { setConfig } = require('../config');

/** Session lecture courante (un livre à la fois pour le MVP). */
let session = null;

function registerReaderIpc() {
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
    // TODO[Phase 1]: retourner { mime, base64 } ou ArrayBuffer sérialisable
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

module.exports = { registerReaderIpc };
