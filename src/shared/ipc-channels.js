/**
 * Canaux IPC partagés Main ↔ Preload ↔ Renderer.
 */
export const IpcChannels = Object.freeze({
  LIBRARY_SELECT_ROOT: 'library:select-root',
  LIBRARY_SCAN: 'library:scan',
  LIBRARY_LIST: 'library:list',
  LIBRARY_GET_COVER: 'library:get-cover',

  READER_OPEN: 'reader:open',
  READER_GET_PAGE: 'reader:get-page',
  READER_CLOSE: 'reader:close',

  PROGRESS_SAVE: 'progress:save',
  PROGRESS_LOAD: 'progress:load',

  APP_GET_CONFIG: 'app:get-config',
  APP_SET_CONFIG: 'app:set-config',
});
