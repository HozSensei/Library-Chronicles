import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels.js';

contextBridge.exposeInMainWorld('vdr', {
  getConfig: () => ipcRenderer.invoke(IpcChannels.APP_GET_CONFIG),
  setConfig: (patch) => ipcRenderer.invoke(IpcChannels.APP_SET_CONFIG, patch),

  library: {
    selectRoot: () => ipcRenderer.invoke(IpcChannels.LIBRARY_SELECT_ROOT),
    scan: () => ipcRenderer.invoke(IpcChannels.LIBRARY_SCAN),
    list: () => ipcRenderer.invoke(IpcChannels.LIBRARY_LIST),
    getCover: (bookId) => ipcRenderer.invoke(IpcChannels.LIBRARY_GET_COVER, bookId),
  },

  reader: {
    open: (filePath) => ipcRenderer.invoke(IpcChannels.READER_OPEN, filePath),
    getPage: (index) => ipcRenderer.invoke(IpcChannels.READER_GET_PAGE, index),
    close: () => ipcRenderer.invoke(IpcChannels.READER_CLOSE),
  },

  progress: {
    save: (payload) => ipcRenderer.invoke(IpcChannels.PROGRESS_SAVE, payload),
    load: (filePath) => ipcRenderer.invoke(IpcChannels.PROGRESS_LOAD, filePath),
  },
});
