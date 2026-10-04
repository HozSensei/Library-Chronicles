import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels.js';
import { sanitizeForIpc } from '../shared/plain-clone.js';

function subscribe(channel, handler) {
  const listener = (_event, payload) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('vdr', {
  getConfig: () => ipcRenderer.invoke(IpcChannels.APP_GET_CONFIG),
  setConfig: (patch) =>
    ipcRenderer.invoke(IpcChannels.APP_SET_CONFIG, sanitizeForIpc(patch)),
  getDefaultPaths: () => ipcRenderer.invoke(IpcChannels.APP_GET_DEFAULT_PATHS),
  pickDirectory: (opts) =>
    ipcRenderer.invoke(IpcChannels.APP_PICK_DIRECTORY, sanitizeForIpc(opts)),
  /** Bascule fenêtre landscape (ui) ↔ portrait (reader). force = resize même si déjà ui. */
  setSessionMode: (mode, opts) =>
    ipcRenderer.invoke(IpcChannels.APP_SET_SESSION_MODE, {
      mode,
      force: Boolean(opts?.force),
    }),
  onOrientationChanged: (handler) =>
    subscribe(IpcChannels.APP_ORIENTATION_CHANGED, handler),
  /** Plein écran Electron (toggle lecteur HUD). */
  getFullscreen: () => ipcRenderer.invoke(IpcChannels.APP_GET_FULLSCREEN),
  setFullscreen: (enabled) =>
    ipcRenderer.invoke(IpcChannels.APP_SET_FULLSCREEN, { enabled: Boolean(enabled) }),
  /** Clavier virtuel Windows (TabTip / osk) — no-op ailleurs. */
  showVirtualKeyboard: () =>
    ipcRenderer.invoke(IpcChannels.APP_SHOW_VIRTUAL_KEYBOARD),

  library: {
    selectRoot: () => ipcRenderer.invoke(IpcChannels.LIBRARY_SELECT_ROOT),
    selectImport: () => ipcRenderer.invoke(IpcChannels.LIBRARY_SELECT_IMPORT),
    /** @param {{ force?: boolean }} [opts] force=true = réindex complet */
    scan: (opts) =>
      ipcRenderer.invoke(IpcChannels.LIBRARY_SCAN, sanitizeForIpc(opts || {})),
    list: () => ipcRenderer.invoke(IpcChannels.LIBRARY_LIST),
    getCover: (bookId) => ipcRenderer.invoke(IpcChannels.LIBRARY_GET_COVER, bookId),
    updateBook: (id, patch) =>
      ipcRenderer.invoke(IpcChannels.LIBRARY_UPDATE_BOOK, {
        id,
        patch: sanitizeForIpc(patch),
      }),
    deleteBook: (id) => ipcRenderer.invoke(IpcChannels.LIBRARY_DELETE_BOOK, id),
    continue: () => ipcRenderer.invoke(IpcChannels.LIBRARY_CONTINUE),
    recent: (limit) => ipcRenderer.invoke(IpcChannels.LIBRARY_RECENT, limit),
    lastAccessed: (excludeId) =>
      ipcRenderer.invoke(IpcChannels.LIBRARY_LAST_ACCESSED, excludeId),
    series: () => ipcRenderer.invoke(IpcChannels.LIBRARY_SERIES),
    nextUnread: (payload) =>
      ipcRenderer.invoke(
        IpcChannels.LIBRARY_NEXT_UNREAD,
        sanitizeForIpc(payload),
      ),
  },

  import: {
    scan: (importRoot) => ipcRenderer.invoke(IpcChannels.IMPORT_SCAN, importRoot),
    commit: (payload) =>
      ipcRenderer.invoke(IpcChannels.IMPORT_COMMIT, sanitizeForIpc(payload)),
    previewCover: (filePath) =>
      ipcRenderer.invoke(IpcChannels.IMPORT_PREVIEW_COVER, filePath),
    previewCoverFromUrl: (coverUrl) =>
      ipcRenderer.invoke(IpcChannels.IMPORT_PREVIEW_COVER_URL, coverUrl),
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
    testProvider: (provider) =>
      ipcRenderer.invoke(IpcChannels.METADATA_TEST_PROVIDER, provider),
    openHelp: (payload) =>
      ipcRenderer.invoke(IpcChannels.METADATA_OPEN_HELP, sanitizeForIpc(payload)),
    /** Dump raw+normalized+fields (dev) → userData/.debug/meta-apply/ */
    debugDumpApply: (payload) =>
      ipcRenderer.invoke(
        IpcChannels.METADATA_DEBUG_DUMP_APPLY,
        sanitizeForIpc(payload),
      ),
  },

  reader: {
    open: (filePath) => ipcRenderer.invoke(IpcChannels.READER_OPEN, filePath),
    getPage: (index) => ipcRenderer.invoke(IpcChannels.READER_GET_PAGE, index),
    getBytes: () => ipcRenderer.invoke(IpcChannels.READER_GET_BYTES),
    getChapters: () => ipcRenderer.invoke(IpcChannels.READER_GET_CHAPTERS),
    close: () => ipcRenderer.invoke(IpcChannels.READER_CLOSE),
  },

  progress: {
    save: (payload) =>
      ipcRenderer.invoke(IpcChannels.PROGRESS_SAVE, sanitizeForIpc(payload)),
    load: (filePath) => ipcRenderer.invoke(IpcChannels.PROGRESS_LOAD, filePath),
  },

  profiles: {
    list: () => ipcRenderer.invoke(IpcChannels.PROFILES_LIST),
    create: (payload) =>
      ipcRenderer.invoke(IpcChannels.PROFILES_CREATE, sanitizeForIpc(payload)),
    update: (id, patch) =>
      ipcRenderer.invoke(IpcChannels.PROFILES_UPDATE, {
        id,
        patch: sanitizeForIpc(patch),
      }),
    delete: (id) => ipcRenderer.invoke(IpcChannels.PROFILES_DELETE, id),
    setActive: (id) => ipcRenderer.invoke(IpcChannels.PROFILES_SET_ACTIVE, id),
    getActive: () => ipcRenderer.invoke(IpcChannels.PROFILES_GET_ACTIVE),
    getPrefs: (profileId) =>
      ipcRenderer.invoke(IpcChannels.PROFILES_GET_PREFS, profileId),
    setPrefs: (patch, profileId) =>
      ipcRenderer.invoke(IpcChannels.PROFILES_SET_PREFS, {
        patch: sanitizeForIpc(patch),
        profileId,
      }),
    defaultPaths: (payload) =>
      ipcRenderer.invoke(
        IpcChannels.PROFILES_DEFAULT_PATHS,
        sanitizeForIpc(payload || {}),
      ),
  },

  bookmarks: {
    list: (bookId, profileId) =>
      ipcRenderer.invoke(IpcChannels.BOOKMARKS_LIST, { bookId, profileId }),
    listAll: (profileId) =>
      ipcRenderer.invoke(IpcChannels.BOOKMARKS_LIST_ALL, profileId),
    add: (payload) =>
      ipcRenderer.invoke(IpcChannels.BOOKMARKS_ADD, sanitizeForIpc(payload)),
    remove: (id) => ipcRenderer.invoke(IpcChannels.BOOKMARKS_REMOVE, id),
    removeAt: (bookId, page) =>
      ipcRenderer.invoke(IpcChannels.BOOKMARKS_REMOVE_AT, { bookId, page }),
  },

  watch: {
    status: () => ipcRenderer.invoke(IpcChannels.WATCH_STATUS),
    onLibraryChanged: (handler) => subscribe(IpcChannels.WATCH_LIBRARY_CHANGED, handler),
    onImportChanged: (handler) => subscribe(IpcChannels.WATCH_IMPORT_CHANGED, handler),
  },

  /** Auto-update GitHub Releases (packaged only). */
  update: {
    check: () => ipcRenderer.invoke(IpcChannels.UPDATE_CHECK),
    quitAndInstall: () => ipcRenderer.invoke(IpcChannels.UPDATE_QUIT_AND_INSTALL),
    getStatus: () => ipcRenderer.invoke(IpcChannels.UPDATE_GET_STATUS),
    onStatus: (handler) => subscribe(IpcChannels.UPDATE_STATUS, handler),
  },
});
