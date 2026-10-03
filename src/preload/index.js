import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels.js';

function subscribe(channel, handler) {
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('vdr', {
  getConfig: () => ipcRenderer.invoke(IpcChannels.APP_GET_CONFIG),
  setConfig: (patch) => ipcRenderer.invoke(IpcChannels.APP_SET_CONFIG, patch),
  getDefaultPaths: () => ipcRenderer.invoke(IpcChannels.APP_GET_DEFAULT_PATHS),
  pickDirectory: (opts) => ipcRenderer.invoke(IpcChannels.APP_PICK_DIRECTORY, opts),
  /** Bascule fenêtre landscape (ui) ↔ portrait (reader). */
  setSessionMode: (mode) =>
    ipcRenderer.invoke(IpcChannels.APP_SET_SESSION_MODE, { mode }),
  onOrientationChanged: (handler) =>
    subscribe(IpcChannels.APP_ORIENTATION_CHANGED, handler),

  library: {
    selectRoot: () => ipcRenderer.invoke(IpcChannels.LIBRARY_SELECT_ROOT),
    selectImport: () => ipcRenderer.invoke(IpcChannels.LIBRARY_SELECT_IMPORT),
    scan: () => ipcRenderer.invoke(IpcChannels.LIBRARY_SCAN),
    list: () => ipcRenderer.invoke(IpcChannels.LIBRARY_LIST),
    getCover: (bookId) => ipcRenderer.invoke(IpcChannels.LIBRARY_GET_COVER, bookId),
    updateBook: (id, patch) =>
      ipcRenderer.invoke(IpcChannels.LIBRARY_UPDATE_BOOK, { id, patch }),
    continue: () => ipcRenderer.invoke(IpcChannels.LIBRARY_CONTINUE),
    recent: (limit) => ipcRenderer.invoke(IpcChannels.LIBRARY_RECENT, limit),
    lastAccessed: (excludeId) =>
      ipcRenderer.invoke(IpcChannels.LIBRARY_LAST_ACCESSED, excludeId),
    series: () => ipcRenderer.invoke(IpcChannels.LIBRARY_SERIES),
    nextUnread: (payload) =>
      ipcRenderer.invoke(IpcChannels.LIBRARY_NEXT_UNREAD, payload),
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
    listProviders: () => ipcRenderer.invoke(IpcChannels.METADATA_LIST_PROVIDERS),
    setProvider: (provider) =>
      ipcRenderer.invoke(IpcChannels.METADATA_SET_PROVIDER, provider),
    setApiKey: (provider, key) =>
      ipcRenderer.invoke(IpcChannels.METADATA_SET_API_KEY, { provider, key }),
    hasApiKey: (provider) =>
      ipcRenderer.invoke(IpcChannels.METADATA_HAS_API_KEY, provider),
    openHelp: (payload) =>
      ipcRenderer.invoke(IpcChannels.METADATA_OPEN_HELP, payload),
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

  profiles: {
    list: () => ipcRenderer.invoke(IpcChannels.PROFILES_LIST),
    create: (payload) => ipcRenderer.invoke(IpcChannels.PROFILES_CREATE, payload),
    update: (id, patch) =>
      ipcRenderer.invoke(IpcChannels.PROFILES_UPDATE, { id, patch }),
    delete: (id) => ipcRenderer.invoke(IpcChannels.PROFILES_DELETE, id),
    setActive: (id) => ipcRenderer.invoke(IpcChannels.PROFILES_SET_ACTIVE, id),
    getActive: () => ipcRenderer.invoke(IpcChannels.PROFILES_GET_ACTIVE),
    getPrefs: (profileId) =>
      ipcRenderer.invoke(IpcChannels.PROFILES_GET_PREFS, profileId),
    setPrefs: (patch, profileId) =>
      ipcRenderer.invoke(IpcChannels.PROFILES_SET_PREFS, { patch, profileId }),
  },

  bookmarks: {
    list: (bookId, profileId) =>
      ipcRenderer.invoke(IpcChannels.BOOKMARKS_LIST, { bookId, profileId }),
    listAll: (profileId) =>
      ipcRenderer.invoke(IpcChannels.BOOKMARKS_LIST_ALL, profileId),
    add: (payload) => ipcRenderer.invoke(IpcChannels.BOOKMARKS_ADD, payload),
    remove: (id) => ipcRenderer.invoke(IpcChannels.BOOKMARKS_REMOVE, id),
    removeAt: (bookId, page) =>
      ipcRenderer.invoke(IpcChannels.BOOKMARKS_REMOVE_AT, { bookId, page }),
  },

  watch: {
    status: () => ipcRenderer.invoke(IpcChannels.WATCH_STATUS),
    onLibraryChanged: (handler) => subscribe(IpcChannels.WATCH_LIBRARY_CHANGED, handler),
    onImportChanged: (handler) => subscribe(IpcChannels.WATCH_IMPORT_CHANGED, handler),
  },
});
