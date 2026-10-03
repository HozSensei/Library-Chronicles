/** Accès données livres — SQLite ou fallback JSON. */

import {
  getDb,
  getDbMode,
  getJsonStore,
  persistJsonStore,
} from './db.js';

function computeStatus(pageCurrent, pageTotal) {
  if (!pageTotal || pageCurrent <= 0) return 'unread';
  if (pageCurrent + 1 >= pageTotal) return 'finished';
  return 'reading';
}

function mapBookRow(row, progress) {
  if (!row) return null;
  const pageCurrent = progress?.page_current ?? 0;
  const status =
    progress?.status || row.status || computeStatus(pageCurrent, row.page_total);
  return {
    id: row.id,
    filePath: row.file_path,
    title: row.title,
    series: row.series || null,
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

export function upsertBook(meta) {
  const mode = getDbMode();
  if (mode === 'sqlite') return upsertSqlite(meta);
  if (mode === 'json') return upsertJson(meta);
  throw new Error('Base non initialisée');
}

function upsertSqlite(meta) {
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM books WHERE file_path = ?')
    .get(meta.filePath);

  if (existing) {
    db.prepare(
      `UPDATE books SET
        title = @title,
        series = @series,
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
      series: meta.series ?? null,
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
        file_path, title, series, volume, author, year, format,
        cover_path, page_total, metadata_json
      ) VALUES (
        @filePath, @title, @series, @volume, @author, @year, @format,
        @coverPath, @pageTotal, @metadataJson
      )`,
    )
    .run({
      filePath: meta.filePath,
      title: meta.title,
      series: meta.series ?? null,
      volume: meta.volume ?? null,
      author: meta.author ?? null,
      year: meta.year ?? null,
      format: meta.format ?? null,
      coverPath: meta.coverPath ?? null,
      pageTotal: meta.pageTotal ?? 0,
      metadataJson: meta.metadata ? JSON.stringify(meta.metadata) : null,
    });

  db.prepare(
    `INSERT OR IGNORE INTO reading_progress (book_id, page_current, status)
     VALUES (?, 0, 'unread')`,
  ).run(info.lastInsertRowid);

  return getBookById(Number(info.lastInsertRowid));
}

function upsertJson(meta) {
  const store = getJsonStore();
  let book = store.books.find((b) => b.file_path === meta.filePath);
  if (book) {
    Object.assign(book, {
      title: meta.title,
      series: meta.series ?? book.series,
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
      series: meta.series ?? null,
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
    store.progress[book.id] = {
      page_current: 0,
      status: 'unread',
      last_access: null,
    };
  }
  persistJsonStore();
  return mapBookRow(book, store.progress[book.id]);
}

export function getBookById(id) {
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const db = getDb();
    const row = db.prepare('SELECT * FROM books WHERE id = ?').get(id);
    const progress = db
      .prepare('SELECT * FROM reading_progress WHERE book_id = ?')
      .get(id);
    return mapBookRow(row, progress);
  }
  const store = getJsonStore();
  const row = store.books.find((b) => b.id === id);
  return mapBookRow(row, store.progress[id]);
}

export function getBookByPath(filePath) {
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const db = getDb();
    const row = db.prepare('SELECT * FROM books WHERE file_path = ?').get(filePath);
    if (!row) return null;
    const progress = db
      .prepare('SELECT * FROM reading_progress WHERE book_id = ?')
      .get(row.id);
    return mapBookRow(row, progress);
  }
  const store = getJsonStore();
  const row = store.books.find((b) => b.file_path === filePath);
  if (!row) return null;
  return mapBookRow(row, store.progress[row.id]);
}

export function listBooks() {
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT b.*, p.page_current, p.status AS progress_status, p.last_access
         FROM books b
         LEFT JOIN reading_progress p ON p.book_id = b.id
         ORDER BY
           CASE WHEN p.last_access IS NULL THEN 1 ELSE 0 END,
           p.last_access DESC,
           b.title COLLATE NOCASE ASC`,
      )
      .all();
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
    .map((b) => mapBookRow(b, store.progress[b.id]))
    .sort((a, b) => {
      if (a.lastAccess && b.lastAccess) return b.lastAccess.localeCompare(a.lastAccess);
      if (a.lastAccess) return -1;
      if (b.lastAccess) return 1;
      return a.title.localeCompare(b.title, 'fr');
    });
}

export function updateBook(id, patch) {
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const db = getDb();
    const fields = [];
    const params = { id };
    for (const [key, col] of [
      ['title', 'title'],
      ['series', 'series'],
      ['volume', 'volume'],
      ['author', 'author'],
      ['year', 'year'],
      ['coverPath', 'cover_path'],
      ['pageTotal', 'page_total'],
    ]) {
      if (patch[key] !== undefined) {
        fields.push(`${col} = @${key}`);
        params[key] = patch[key];
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
  if (patch.series !== undefined) book.series = patch.series;
  if (patch.volume !== undefined) book.volume = patch.volume;
  if (patch.author !== undefined) book.author = patch.author;
  if (patch.year !== undefined) book.year = patch.year;
  if (patch.coverPath !== undefined) book.cover_path = patch.coverPath;
  if (patch.pageTotal !== undefined) book.page_total = patch.pageTotal;
  if (patch.metadata !== undefined) book.metadata_json = JSON.stringify(patch.metadata);
  book.updated_at = new Date().toISOString();
  persistJsonStore();
  return mapBookRow(book, store.progress[id]);
}

export function saveProgress(bookId, pageCurrent, pageTotal) {
  const status = computeStatus(pageCurrent, pageTotal);
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const db = getDb();
    db.prepare(
      `INSERT INTO reading_progress (book_id, page_current, status, last_access)
       VALUES (@bookId, @pageCurrent, @status, datetime('now'))
       ON CONFLICT(book_id) DO UPDATE SET
         page_current = @pageCurrent,
         status = @status,
         last_access = datetime('now')`,
    ).run({ bookId, pageCurrent, status });
    db.prepare(
      `UPDATE books SET status = @status, page_total = COALESCE(@pageTotal, page_total),
       updated_at = datetime('now') WHERE id = @bookId`,
    ).run({ bookId, status, pageTotal: pageTotal ?? null });
    return { ok: true, status, pageCurrent };
  }

  const store = getJsonStore();
  store.progress[bookId] = {
    page_current: pageCurrent,
    status,
    last_access: new Date().toISOString(),
  };
  const book = store.books.find((b) => b.id === bookId);
  if (book) {
    book.status = status;
    if (pageTotal != null) book.page_total = pageTotal;
  }
  persistJsonStore();
  return { ok: true, status, pageCurrent };
}

export function saveProgressByPath(filePath, pageCurrent, pageTotal) {
  const book = getBookByPath(filePath);
  if (!book) return { ok: false, error: 'Livre inconnu' };
  return saveProgress(book.id, pageCurrent, pageTotal);
}

export function loadProgress(filePath) {
  const book = getBookByPath(filePath);
  if (!book) return null;
  return {
    bookId: book.id,
    pageCurrent: book.pageCurrent,
    pageTotal: book.pageTotal,
    status: book.status,
    lastAccess: book.lastAccess,
  };
}

export function getContinueBook() {
  const books = listBooks().filter((b) => b.status === 'reading' && b.lastAccess);
  if (!books.length) return null;
  return books[0];
}

/** Supprime un livre (et sa progression) par id. */
export function deleteBook(id) {
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const db = getDb();
    db.prepare('DELETE FROM reading_progress WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM books WHERE id = ?').run(id);
    return { ok: true };
  }
  const store = getJsonStore();
  store.books = store.books.filter((b) => b.id !== id);
  delete store.progress[id];
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
