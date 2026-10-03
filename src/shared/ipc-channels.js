/**
 * Canaux IPC partagés Main ↔ Preload ↔ Renderer.
 * Ajouter ici tout nouveau canal pour éviter les chaînes magiques.
 */
const IpcChannels = Object.freeze({
  // Bibliothèque
  LIBRARY_SELECT_ROOT: 'library:select-root',
  LIBRARY_SCAN: 'library:scan',
  LIBRARY_LIST: 'library:list',
  LIBRARY_GET_COVER: 'library:get-cover',

  // Lecteur / extraction
  READER_OPEN: 'reader:open',
  READER_GET_PAGE: 'reader:get-page',
  READER_CLOSE: 'reader:close',

  // Progression
  PROGRESS_SAVE: 'progress:save',
  PROGRESS_LOAD: 'progress:load',

  // App
  APP_GET_CONFIG: 'app:get-config',
  APP_SET_CONFIG: 'app:set-config',
});

module.exports = { IpcChannels };
