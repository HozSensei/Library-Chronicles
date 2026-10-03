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

  IMPORT_SCAN: 'import:scan',
  IMPORT_COMMIT: 'import:commit',
  IMPORT_PREVIEW_COVER: 'import:preview-cover',

  METADATA_DETECT: 'metadata:detect',
  METADATA_SEARCH: 'metadata:search',
  METADATA_SET_API_KEY: 'metadata:set-api-key',
  METADATA_HAS_API_KEY: 'metadata:has-api-key',

  READER_OPEN: 'reader:open',
  READER_GET_PAGE: 'reader:get-page',
  READER_CLOSE: 'reader:close',
  READER_GET_CHAPTERS: 'reader:get-chapters',

  PROGRESS_SAVE: 'progress:save',
  PROGRESS_LOAD: 'progress:load',

  APP_GET_CONFIG: 'app:get-config',
  APP_SET_CONFIG: 'app:set-config',
  APP_PICK_DIRECTORY: 'app:pick-directory',
  APP_GET_DEFAULT_PATHS: 'app:get-default-paths',
});
