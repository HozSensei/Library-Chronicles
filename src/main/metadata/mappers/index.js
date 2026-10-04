/**
 * Mappers raw API → NormalizedMeta (contrat unique).
 */

export { mapGoogleBooksItem, parseGoogleBookTitle, upgradeGoogleCover } from './googlebooks.js';
export { mapAnilistItem } from './anilist.js';
export { mapMangadexItem } from './mangadex.js';
export { mapOpenLibraryDoc } from './openlibrary.js';
export { mapComicVineItem, pickComicVineCover } from './comicvine.js';
