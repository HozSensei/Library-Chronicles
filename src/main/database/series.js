/**
 * Identifiants de série + regroupement tomes.
 */

/** Slug stable pour series_id (ASCII basique). */
export function seriesIdFromName(series) {
  if (!series || !String(series).trim()) return null;
  return String(series)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || null;
}

/**
 * Regroupe une liste de livres par series_id / series.
 * @param {Array<object>} books
 */
export function groupBooksBySeries(books) {
  /** @type {Map<string, { seriesId: string, series: string, volumes: object[] }>} */
  const map = new Map();
  const singles = [];

  for (const book of books) {
    const sid = book.seriesId || seriesIdFromName(book.series);
    if (!sid) {
      singles.push(book);
      continue;
    }
    if (!map.has(sid)) {
      map.set(sid, {
        seriesId: sid,
        series: book.series || sid,
        volumes: [],
      });
    }
    const g = map.get(sid);
    if (book.series && (!g.series || g.series === sid)) g.series = book.series;
    g.volumes.push(book);
  }

  const groups = [...map.values()].map((g) => {
    g.volumes.sort((a, b) => {
      const va = a.volume ?? Number.POSITIVE_INFINITY;
      const vb = b.volume ?? Number.POSITIVE_INFINITY;
      if (va !== vb) return va - vb;
      return String(a.title || '').localeCompare(String(b.title || ''), 'fr');
    });
    const finished = g.volumes.filter((v) => v.status === 'finished').length;
    const reading = g.volumes.find((v) => v.status === 'reading');
    const nextUnread = g.volumes.find(
      (v) => v.status === 'unread' || v.status === 'reading',
    );
    return {
      ...g,
      volumeCount: g.volumes.length,
      finishedCount: finished,
      coverBookId: (reading || nextUnread || g.volumes[0])?.id ?? null,
      nextUnread: nextUnread || null,
      status:
        finished === g.volumes.length
          ? 'finished'
          : reading || finished
            ? 'reading'
            : 'unread',
    };
  });

  groups.sort((a, b) =>
    String(a.series).localeCompare(String(b.series), 'fr', { sensitivity: 'base' }),
  );

  return { groups, singles };
}

/**
 * Trouve le prochain tome non terminé d’une série, après un volume donné.
 * @param {Array<object>} books
 * @param {object} opts
 */
export function findNextUnreadVolume(books, { seriesId, afterVolume = null, afterBookId = null } = {}) {
  if (!seriesId) return null;
  const volumes = books
    .filter((b) => (b.seriesId || seriesIdFromName(b.series)) === seriesId)
    .sort((a, b) => {
      const va = a.volume ?? Number.POSITIVE_INFINITY;
      const vb = b.volume ?? Number.POSITIVE_INFINITY;
      if (va !== vb) return va - vb;
      return Number(a.id) - Number(b.id);
    });

  if (!volumes.length) return null;

  let startIdx = 0;
  if (afterBookId != null) {
    const i = volumes.findIndex((v) => v.id === afterBookId);
    if (i >= 0) startIdx = i + 1;
  } else if (afterVolume != null) {
    const i = volumes.findIndex((v) => (v.volume ?? -1) > afterVolume);
    startIdx = i >= 0 ? i : volumes.length;
  }

  for (let i = startIdx; i < volumes.length; i += 1) {
    if (volumes[i].status !== 'finished') return volumes[i];
  }
  // Reprise : premier non terminé de la série
  return volumes.find((v) => v.status !== 'finished') || null;
}
