/**
 * Canaux IPC partagés Main ↔ Preload ↔ Renderer.
 */
export const IpcChannels = Object.freeze({
  LIBRARY_SELECT_ROOT: 'library:select-root',
  LIBRARY_SELECT_IMPORT: 'library:select-import',
  LIBRARY_SCAN: 'library:scan',
  LIBRARY_LIST: 'library:list',
  LIBRARY_GET_COVER: 'library:get-cover',
  LIBRARY_UPDATE_BOOK: 'library:update-book',
  LIBRARY_CONTINUE: 'library:continue',
  LIBRARY_RECENT: 'library:recent',
  LIBRARY_LAST_ACCESSED: 'library:last-accessed',
  LIBRARY_SERIES: 'library:series',
  LIBRARY_NEXT_UNREAD: 'library:next-unread',

  IMPORT_SCAN: 'import:scan',
  IMPORT_COMMIT: 'import:commit',
  IMPORT_PREVIEW_COVER: 'import:preview-cover',
  /** Jacket distante → data-URL (CSP img-src sans https). */
  IMPORT_PREVIEW_COVER_URL: 'import:preview-cover-url',

  METADATA_DETECT: 'metadata:detect',
  METADATA_SEARCH: 'metadata:search',
  METADATA_SET_API_KEY: 'metadata:set-api-key',
  METADATA_HAS_API_KEY: 'metadata:has-api-key',
  METADATA_LIST_PROVIDERS: 'metadata:list-providers',
  METADATA_SET_PROVIDER: 'metadata:set-provider',
  METADATA_OPEN_HELP: 'metadata:open-help',

  READER_OPEN: 'reader:open',
  READER_GET_PAGE: 'reader:get-page',
  READER_CLOSE: 'reader:close',
  READER_GET_CHAPTERS: 'reader:get-chapters',

  PROGRESS_SAVE: 'progress:save',
  PROGRESS_LOAD: 'progress:load',

  PROFILES_LIST: 'profiles:list',
  PROFILES_CREATE: 'profiles:create',
  PROFILES_UPDATE: 'profiles:update',
  PROFILES_DELETE: 'profiles:delete',
  PROFILES_SET_ACTIVE: 'profiles:set-active',
  PROFILES_GET_ACTIVE: 'profiles:get-active',
  PROFILES_GET_PREFS: 'profiles:get-prefs',
  PROFILES_SET_PREFS: 'profiles:set-prefs',
  PROFILES_DEFAULT_PATHS: 'profiles:default-paths',

  BOOKMARKS_LIST: 'bookmarks:list',
  BOOKMARKS_LIST_ALL: 'bookmarks:list-all',
  BOOKMARKS_ADD: 'bookmarks:add',
  BOOKMARKS_REMOVE: 'bookmarks:remove',
  BOOKMARKS_REMOVE_AT: 'bookmarks:remove-at',

  APP_GET_CONFIG: 'app:get-config',
  APP_SET_CONFIG: 'app:set-config',
  APP_PICK_DIRECTORY: 'app:pick-directory',
  APP_GET_DEFAULT_PATHS: 'app:get-default-paths',
  /**
   * Bascule orientation session (fenêtre) sans exposer un choix setup.
   * Payload: { mode: 'ui' | 'reader' } → landscape / portrait-ccw.
   */
  APP_SET_SESSION_MODE: 'app:set-session-mode',
  /** Push Main → Renderer après bascule d’orientation fenêtre. */
  APP_ORIENTATION_CHANGED: 'app:orientation-changed',
  /** Ouvre le clavier tactile Windows (TabTip / osk). */
  APP_SHOW_VIRTUAL_KEYBOARD: 'app:show-virtual-keyboard',

  /** Événements push Main → Renderer (fs.watch). */
  WATCH_LIBRARY_CHANGED: 'watch:library-changed',
  WATCH_IMPORT_CHANGED: 'watch:import-changed',
  WATCH_STATUS: 'watch:status',
});
