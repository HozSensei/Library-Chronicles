import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels.js';

contextBridge.exposeInMainWorld('vdr', {
  getConfig: () => ipcRenderer.invoke(IpcChannels.APP_GET_CONFIG),
  setConfig: (patch) => ipcRenderer.invoke(IpcChannels.APP_SET_CONFIG, patch),
  getDefaultPaths: () => ipcRenderer.invoke(IpcChannels.APP_GET_DEFAULT_PATHS),
  pickDirectory: (opts) => ipcRenderer.invoke(IpcChannels.APP_PICK_DIRECTORY, opts),

  library: {
    selectRoot: () => ipcRenderer.invoke(IpcChannels.LIBRARY_SELECT_ROOT),
    selectImport: () => ipcRenderer.invoke(IpcChannels.LIBRARY_SELECT_IMPORT),
    scan: () => ipcRenderer.invoke(IpcChannels.LIBRARY_SCAN),
    list: () => ipcRenderer.invoke(IpcChannels.LIBRARY_LIST),
    getCover: (bookId) => ipcRenderer.invoke(IpcChannels.LIBRARY_GET_COVER, bookId),
    updateBook: (id, patch) =>
      ipcRenderer.invoke(IpcChannels.LIBRARY_UPDATE_BOOK, { id, patch }),
    continue: () => ipcRenderer.invoke(IpcChannels.LIBRARY_CONTINUE),
  },

  import: {
    scan: (importRoot) => ipcRenderer.invoke(IpcChannels.IMPORT_SCAN, importRoot),
    commit: (payload) => ipcRenderer.invoke(IpcChannels.IMPORT_COMMIT, payload),
    previewCover: (filePath) =>
      ipcRenderer.invoke(IpcChannels.IMPORT_PREVIEW_COVER, filePath),
  },

  metadata: {
    detect: (filePath) => ipcRenderer.invoke(IpcChannels.METADATA_DETECT, filePath),
    search: (query, provider) =>
      ipcRenderer.invoke(IpcChannels.METADATA_SEARCH, { query, provider }),
    setApiKey: (provider, key) =>
      ipcRenderer.invoke(IpcChannels.METADATA_SET_API_KEY, { provider, key }),
    hasApiKey: (provider) =>
      ipcRenderer.invoke(IpcChannels.METADATA_HAS_API_KEY, provider),
  },

  reader: {
    open: (filePath) => ipcRenderer.invoke(IpcChannels.READER_OPEN, filePath),
    getPage: (index) => ipcRenderer.invoke(IpcChannels.READER_GET_PAGE, index),
    getChapters: () => ipcRenderer.invoke(IpcChannels.READER_GET_CHAPTERS),
    close: () => ipcRenderer.invoke(IpcChannels.READER_CLOSE),
  },

  progress: {
    save: (payload) => ipcRenderer.invoke(IpcChannels.PROGRESS_SAVE, payload),
    load: (filePath) => ipcRenderer.invoke(IpcChannels.PROGRESS_LOAD, filePath),
  },
});
