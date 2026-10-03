/**
 * Re-export helpers série (implémentation partagée main + renderer).
 */
export {
  GENERIC_SERIES_FOLDER_NAMES,
  isGenericSeriesFolderName,
  parentFolderName,
  seriesFromParentFolder,
  seriesIdFromName,
  groupBooksBySeries,
  bookTouchTime,
  listRecentSeries,
  findSeriesGroup,
  listSeriesVolumes,
  findNextUnreadVolume,
  findAdjacentVolume,
} from '../../shared/series.js';
