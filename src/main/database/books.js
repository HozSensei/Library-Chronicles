/** Accès données livres — SQLite ou fallback JSON. */

import {
  getDb,
  getDbMode,
  getJsonStore,
  persistJsonStore,
} from './db.js';
import { seriesIdFromName, groupBooksBySeries, findNextUnreadVolume } from './series.js';
import { getActiveProfileId } from './profiles.js';

function computeStatus(pageCurrent, pageTotal) {
  if (!pageTotal || pageCurrent <= 0) return 'unread';
  if (pageCurrent + 1 >= pageTotal) return 'finished';
  return 'reading';
}

function progressKey(profileId, bookId) {
  return `${profileId}:${bookId}`;
}

function mapBookRow(row, progress) {
  if (!row) return null;
  const pageCurrent = progress?.page_current ?? 0;
  const status =
    progress?.status || row.status || computeStatus(pageCurrent, row.page_total);
  const series = row.series || null;
  const seriesId = row.series_id || seriesIdFromName(series);
  return {
    id: row.id,
    filePath: row.file_path,
    title: row.title,
    series,
    seriesId,
    volume: row.volume ?? null,
    author: row.author || null,
    year: row.year ?? null,
    format: row.format || null,
    coverPath: row.cover_path || null,
    pageTotal: row.page_total || 0,
    pageCurrent,
    status,
    lastAccess: progress?.last_access || null,
    metadata: row.metadata_json ? safeJson(row.metadata_json) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function resolveSeriesFields(meta) {
  const series = meta.series ?? null;
  const seriesId =
    meta.seriesId || seriesIdFromName(series) || null;
  return { series, seriesId };
}

export function upsertBook(meta) {
  const mode = getDbMode();
  if (mode === 'sqlite') return upsertSqlite(meta);
  if (mode === 'json') return upsertJson(meta);
  throw new Error('Base non initialisée');
}

function upsertSqlite(meta) {
  const db = getDb();
  const { series, seriesId } = resolveSeriesFields(meta);
  const existing = db
    .prepare('SELECT id FROM books WHERE file_path = ?')
    .get(meta.filePath);

  if (existing) {
    db.prepare(
      `UPDATE books SET
        title = @title,
        series = @series,
        series_id = @seriesId,
        volume = @volume,
        author = @author,
        year = @year,
        format = @format,
        cover_path = COALESCE(@coverPath, cover_path),
        page_total = COALESCE(@pageTotal, page_total),
        metadata_json = COALESCE(@metadataJson, metadata_json),
        updated_at = datetime('now')
      WHERE id = @id`,
    ).run({
      id: existing.id,
      title: meta.title,
      series,
      seriesId,
      volume: meta.volume ?? null,
      author: meta.author ?? null,
      year: meta.year ?? null,
      format: meta.format ?? null,
      coverPath: meta.coverPath ?? null,
      pageTotal: meta.pageTotal ?? null,
      metadataJson: meta.metadata ? JSON.stringify(meta.metadata) : null,
    });
    return getBookById(existing.id);
  }

  const info = db
    .prepare(
      `INSERT INTO books (
        file_path, title, series, series_id, volume, author, year, format,
        cover_path, page_total, metadata_json
      ) VALUES (
        @filePath, @title, @series, @seriesId, @volume, @author, @year, @format,
        @coverPath, @pageTotal, @metadataJson
      )`,
    )
    .run({
      filePath: meta.filePath,
      title: meta.title,
      series,
      seriesId,
      volume: meta.volume ?? null,
      author: meta.author ?? null,
      year: meta.year ?? null,
      format: meta.format ?? null,
      coverPath: meta.coverPath ?? null,
      pageTotal: meta.pageTotal ?? 0,
      metadataJson: meta.metadata ? JSON.stringify(meta.metadata) : null,
    });

  const pid = getActiveProfileId();
  db.prepare(
    `INSERT OR IGNORE INTO reading_progress (profile_id, book_id, page_current, status)
     VALUES (?, ?, 0, 'unread')`,
  ).run(pid, info.lastInsertRowid);

  return getBookById(Number(info.lastInsertRowid));
}

function upsertJson(meta) {
  const store = getJsonStore();
  const { series, seriesId } = resolveSeriesFields(meta);
  let book = store.books.find((b) => b.file_path === meta.filePath);
  if (book) {
    Object.assign(book, {
      title: meta.title,
      series: series ?? book.series,
      series_id: seriesId ?? book.series_id,
      volume: meta.volume ?? book.volume,
      author: meta.author ?? book.author,
      year: meta.year ?? book.year,
      format: meta.format ?? book.format,
      cover_path: meta.coverPath ?? book.cover_path,
      page_total: meta.pageTotal ?? book.page_total,
      metadata_json: meta.metadata
        ? JSON.stringify(meta.metadata)
        : book.metadata_json,
      updated_at: new Date().toISOString(),
    });
  } else {
    book = {
      id: store.nextId++,
      file_path: meta.filePath,
      title: meta.title,
      series,
      series_id: seriesId,
      volume: meta.volume ?? null,
      author: meta.author ?? null,
      year: meta.year ?? null,
      format: meta.format ?? null,
      cover_path: meta.coverPath ?? null,
      page_total: meta.pageTotal ?? 0,
      status: 'unread',
      metadata_json: meta.metadata ? JSON.stringify(meta.metadata) : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.books.push(book);
    const pid = getActiveProfileId();
    store.progress[progressKey(pid, book.id)] = {
      page_current: 0,
      status: 'unread',
      last_access: null,
    };
  }
  persistJsonStore();
  return getBookById(book.id);
}

function getProgressFor(bookId, profileId = null) {
  const pid = profileId ?? getActiveProfileId();
  const mode = getDbMode();
  if (mode === 'sqlite') {
    return getDb()
      .prepare(
        `SELECT * FROM reading_progress WHERE profile_id = ? AND book_id = ?`,
      )
      .get(pid, bookId);
  }
  return getJsonStore().progress[progressKey(pid, bookId)] || null;
}

export function getBookById(id, profileId = null) {
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const row = getDb().prepare('SELECT * FROM books WHERE id = ?').get(id);
    return mapBookRow(row, getProgressFor(id, profileId));
  }
  const store = getJsonStore();
  const row = store.books.find((b) => b.id === id);
  return mapBookRow(row, getProgressFor(id, profileId));
}

export function getBookByPath(filePath, profileId = null) {
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const row = getDb().prepare('SELECT * FROM books WHERE file_path = ?').get(filePath);
    if (!row) return null;
    return mapBookRow(row, getProgressFor(row.id, profileId));
  }
  const store = getJsonStore();
  const row = store.books.find((b) => b.file_path === filePath);
  if (!row) return null;
  return mapBookRow(row, getProgressFor(row.id, profileId));
}

export function listBooks(profileId = null) {
  const pid = profileId ?? getActiveProfileId();
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT b.*, p.page_current, p.status AS progress_status, p.last_access
         FROM books b
         LEFT JOIN reading_progress p
           ON p.book_id = b.id AND p.profile_id = ?
         ORDER BY
           CASE WHEN p.last_access IS NULL THEN 1 ELSE 0 END,
           p.last_access DESC,
           b.title COLLATE NOCASE ASC`,
      )
      .all(pid);
    return rows.map((r) =>
      mapBookRow(r, {
        page_current: r.page_current,
        status: r.progress_status || r.status,
        last_access: r.last_access,
      }),
    );
  }
  const store = getJsonStore();
  return store.books
    .map((b) => mapBookRow(b, store.progress[progressKey(pid, b.id)]))
    .sort((a, b) => {
      if (a.lastAccess && b.lastAccess) return b.lastAccess.localeCompare(a.lastAccess);
      if (a.lastAccess) return -1;
      if (b.lastAccess) return 1;
      return a.title.localeCompare(b.title, 'fr');
    });
}

export function listSeries(profileId = null) {
  return groupBooksBySeries(listBooks(profileId));
}

export function getNextUnreadInSeries(seriesId, { afterVolume = null, afterBookId = null, profileId = null } = {}) {
  return findNextUnreadVolume(listBooks(profileId), {
    seriesId,
    afterVolume,
    afterBookId,
  });
}

export function updateBook(id, patch) {
  const mode = getDbMode();
  const seriesPatch = {};
  if (patch.series !== undefined) {
    seriesPatch.series = patch.series;
    seriesPatch.seriesId =
      patch.seriesId !== undefined
        ? patch.seriesId
        : seriesIdFromName(patch.series);
  } else if (patch.seriesId !== undefined) {
    seriesPatch.seriesId = patch.seriesId;
  }

  if (mode === 'sqlite') {
    const db = getDb();
    const fields = [];
    const params = { id };
    for (const [key, col] of [
      ['title', 'title'],
      ['series', 'series'],
      ['seriesId', 'series_id'],
      ['volume', 'volume'],
      ['author', 'author'],
      ['year', 'year'],
      ['coverPath', 'cover_path'],
      ['pageTotal', 'page_total'],
    ]) {
      const val = key in seriesPatch ? seriesPatch[key] : patch[key];
      if (val !== undefined) {
        fields.push(`${col} = @${key}`);
        params[key] = val;
      }
    }
    if (patch.metadata !== undefined) {
      fields.push('metadata_json = @metadataJson');
      params.metadataJson = JSON.stringify(patch.metadata);
    }
    if (!fields.length) return getBookById(id);
    fields.push("updated_at = datetime('now')");
    db.prepare(`UPDATE books SET ${fields.join(', ')} WHERE id = @id`).run(params);
    return getBookById(id);
  }

  const store = getJsonStore();
  const book = store.books.find((b) => b.id === id);
  if (!book) return null;
  if (patch.title !== undefined) book.title = patch.title;
  if (seriesPatch.series !== undefined) book.series = seriesPatch.series;
  if (seriesPatch.seriesId !== undefined) book.series_id = seriesPatch.seriesId;
  if (patch.volume !== undefined) book.volume = patch.volume;
  if (patch.author !== undefined) book.author = patch.author;
  if (patch.year !== undefined) book.year = patch.year;
  if (patch.coverPath !== undefined) book.cover_path = patch.coverPath;
  if (patch.pageTotal !== undefined) book.page_total = patch.pageTotal;
  if (patch.metadata !== undefined) book.metadata_json = JSON.stringify(patch.metadata);
  book.updated_at = new Date().toISOString();
  persistJsonStore();
  return getBookById(id);
}

export function saveProgress(bookId, pageCurrent, pageTotal, profileId = null) {
  const pid = profileId ?? getActiveProfileId();
  const status = computeStatus(pageCurrent, pageTotal);
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const db = getDb();
    db.prepare(
      `INSERT INTO reading_progress (profile_id, book_id, page_current, status, last_access)
       VALUES (@pid, @bookId, @pageCurrent, @status, datetime('now'))
       ON CONFLICT(profile_id, book_id) DO UPDATE SET
         page_current = @pageCurrent,
         status = @status,
         last_access = datetime('now')`,
    ).run({ pid, bookId, pageCurrent, status });
    db.prepare(
      `UPDATE books SET page_total = COALESCE(@pageTotal, page_total),
       updated_at = datetime('now') WHERE id = @bookId`,
    ).run({ bookId, pageTotal: pageTotal ?? null });
    return { ok: true, status, pageCurrent, profileId: pid };
  }

  const store = getJsonStore();
  store.progress[progressKey(pid, bookId)] = {
    page_current: pageCurrent,
    status,
    last_access: new Date().toISOString(),
  };
  const book = store.books.find((b) => b.id === bookId);
  if (book) {
    if (pageTotal != null) book.page_total = pageTotal;
  }
  persistJsonStore();
  return { ok: true, status, pageCurrent, profileId: pid };
}

export function saveProgressByPath(filePath, pageCurrent, pageTotal, profileId = null) {
  const book = getBookByPath(filePath, profileId);
  if (!book) return { ok: false, error: 'Livre inconnu' };
  return saveProgress(book.id, pageCurrent, pageTotal, profileId);
}

export function loadProgress(filePath, profileId = null) {
  const book = getBookByPath(filePath, profileId);
  if (!book) return null;
  return {
    bookId: book.id,
    pageCurrent: book.pageCurrent,
    pageTotal: book.pageTotal,
    status: book.status,
    lastAccess: book.lastAccess,
    profileId: profileId ?? getActiveProfileId(),
  };
}

export function getContinueBook(profileId = null) {
  const books = listBooks(profileId).filter((b) => b.status === 'reading' && b.lastAccess);
  if (!books.length) return null;
  return books[0];
}

/** Dernier tome consulté (toute progression), hors lecture en cours si fourni. */
export function getLastAccessedBook(excludeId = null, profileId = null) {
  const books = listBooks(profileId)
    .filter((b) => b.lastAccess && b.id !== excludeId)
    .sort((a, b) => String(b.lastAccess).localeCompare(String(a.lastAccess)));
  return books[0] || null;
}

/** Ajouts récents triés par created_at DESC. */
export function listRecentBooks(limit = 12) {
  const books = listBooks()
    .slice()
    .sort((a, b) => {
      const ca = a.createdAt || '';
      const cb = b.createdAt || '';
      if (ca && cb) return String(cb).localeCompare(String(ca));
      if (ca) return -1;
      if (cb) return 1;
      return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
    });
  return books.slice(0, Math.max(0, limit));
}

/** Supprime un livre (et sa progression / signets) par id. */
export function deleteBook(id) {
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const db = getDb();
    db.prepare('DELETE FROM bookmarks WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM reading_progress WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM books WHERE id = ?').run(id);
    return { ok: true };
  }
  const store = getJsonStore();
  store.books = store.books.filter((b) => b.id !== id);
  for (const key of Object.keys(store.progress)) {
    if (key.endsWith(`:${id}`) || key === String(id)) delete store.progress[key];
  }
  store.bookmarks = (store.bookmarks || []).filter((b) => b.book_id !== id);
  persistJsonStore();
  return { ok: true };
}

/**
 * Retire de la base les livres dont le fichier n’existe plus.
 * @param {Set<string>|string[]} existingPaths
 */
export function pruneMissingBooks(existingPaths) {
  const keep = existingPaths instanceof Set ? existingPaths : new Set(existingPaths);
  const removed = [];
  for (const book of listBooks()) {
    if (!keep.has(book.filePath)) {
      deleteBook(book.id);
      removed.push(book.filePath);
    }
  }
  return removed;
}
