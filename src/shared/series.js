/**
 * Identifiants de série + regroupement tomes (pur, main + renderer).
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
      /** Cover « identité série » = premier tome (ordre volume). */
      seriesCoverBookId: g.volumes[0]?.id ?? null,
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
 * Horodatage « touché » : dernier accès, sinon date d’ajout.
 * @param {object} book
 */
export function bookTouchTime(book) {
  if (!book) return '';
  return String(book.lastAccess || book.createdAt || '');
}

/**
 * Récents dédupliqués par série : une entrée par series_id (dernier tome touché).
 * Les one-shots sans série restent une entrée chacun.
 *
 * @param {Array<object>} books
 * @param {number} [limit=14]
 * @returns {Array<{
 *   kind: 'series'|'tome',
 *   seriesId: string|null,
 *   series: string|null,
 *   volumeCount: number,
 *   lastBook: object,
 *   coverBookId: number|string|null,
 *   status: string,
 * }>}
 */
export function listRecentSeries(books, limit = 14) {
  const list = Array.isArray(books) ? books : [];
  const max = Math.max(0, Number(limit) || 0);
  if (!max || !list.length) return [];

  const { groups } = groupBooksBySeries(list);
  const byId = new Map(groups.map((g) => [g.seriesId, g]));

  const sorted = list.slice().sort((a, b) => {
    const ta = bookTouchTime(a);
    const tb = bookTouchTime(b);
    if (ta && tb) return tb.localeCompare(ta);
    if (ta) return -1;
    if (tb) return 1;
    const ca = a.createdAt || '';
    const cb = b.createdAt || '';
    if (ca && cb) return String(cb).localeCompare(String(ca));
    return Number(b.id) - Number(a.id);
  });

  /** @type {Set<string>} */
  const seen = new Set();
  const out = [];

  for (const book of sorted) {
    const sid = book.seriesId || seriesIdFromName(book.series);
    const key = sid || `book:${book.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (sid) {
      const group = byId.get(sid);
      const volumeCount = group?.volumeCount || 1;
      out.push({
        kind: volumeCount > 1 ? 'series' : 'tome',
        seriesId: sid,
        series: group?.series || book.series || sid,
        volumeCount,
        lastBook: book,
        coverBookId: book.id ?? group?.coverBookId ?? null,
        status: group?.status || book.status || 'unread',
      });
    } else {
      out.push({
        kind: 'tome',
        seriesId: null,
        series: null,
        volumeCount: 1,
        lastBook: book,
        coverBookId: book.id ?? null,
        status: book.status || 'unread',
      });
    }

    if (out.length >= max) break;
  }

  return out;
}

/**
 * Trouve un groupe série par id (series_id ou slug du titre).
 * @param {Array<object>} books
 * @param {string} seriesId
 */
export function findSeriesGroup(books, seriesId) {
  if (!seriesId) return null;
  const { groups } = groupBooksBySeries(books);
  return groups.find((g) => g.seriesId === String(seriesId)) || null;
}

/**
 * Tomes d’une série, triés par volume puis id.
 * @param {Array<object>} books
 * @param {string} seriesId
 */
export function listSeriesVolumes(books, seriesId) {
  if (!seriesId) return [];
  const sid = String(seriesId);
  return books
    .filter((b) => (b.seriesId || seriesIdFromName(b.series)) === sid)
    .sort((a, b) => {
      const va = a.volume ?? Number.POSITIVE_INFINITY;
      const vb = b.volume ?? Number.POSITIVE_INFINITY;
      if (va !== vb) return va - vb;
      return Number(a.id) - Number(b.id);
    });
}

/**
 * Trouve le prochain tome non terminé d’une série, après un volume donné.
 * @param {Array<object>} books
 * @param {object} opts
 */
export function findNextUnreadVolume(books, { seriesId, afterVolume = null, afterBookId = null } = {}) {
  if (!seriesId) return null;
  const volumes = listSeriesVolumes(books, seriesId);

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

/**
 * Tome adjacent d’une série (volume ±1, sinon voisin d’index si volume absent).
 * @param {Array<object>} books
 * @param {{ seriesId?: string|null, volume?: number|null, bookId?: number|string|null, delta?: number }} opts
 * @returns {object|null}
 */
export function findAdjacentVolume(
  books,
  { seriesId = null, volume = null, bookId = null, delta = 1 } = {},
) {
  const step = Number(delta);
  if (!seriesId || !Number.isFinite(step) || step === 0) return null;

  const volumes = listSeriesVolumes(books, seriesId);
  if (!volumes.length) return null;

  if (volume != null && Number.isFinite(Number(volume))) {
    const target = Number(volume) + step;
    const hit = volumes.find(
      (v) => v.volume != null && Number(v.volume) === target && v.id !== bookId,
    );
    if (hit) return hit;
    return null;
  }

  if (bookId == null) return null;
  const idx = volumes.findIndex((v) => v.id === bookId);
  if (idx < 0) return null;
  return volumes[idx + step] || null;
}
