/**
 * Re-export helpers série (implémentation partagée main + renderer).
 */
export {
  seriesIdFromName,
  groupBooksBySeries,
  bookTouchTime,
  listRecentSeries,
  findSeriesGroup,
  listSeriesVolumes,
  findNextUnreadVolume,
  findAdjacentVolume,
} from '../../shared/series.js';
