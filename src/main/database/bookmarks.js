/** Signets par livre et par profil. */

import {
  getDb,
  getDbMode,
  getJsonStore,
  persistJsonStore,
} from './db.js';
import { getActiveProfileId } from './profiles.js';
import { getBookById } from './books.js';

function mapBookmark(row) {
  if (!row) return null;
  return {
    id: row.id,
    profileId: row.profile_id,
    bookId: row.book_id,
    page: row.page,
    label: row.label || null,
    createdAt: row.created_at,
  };
}

export function listBookmarks(bookId, profileId = null) {
  const pid = profileId ?? getActiveProfileId();
  const mode = getDbMode();
  if (mode === 'sqlite') {
    return getDb()
      .prepare(
        `SELECT * FROM bookmarks
         WHERE profile_id = ? AND book_id = ?
         ORDER BY page ASC, id ASC`,
      )
      .all(pid, bookId)
      .map(mapBookmark);
  }
  return getJsonStore()
    .bookmarks.filter((b) => b.profile_id === pid && b.book_id === bookId)
    .sort((a, b) => a.page - b.page || a.id - b.id)
    .map(mapBookmark);
}

export function listAllBookmarks(profileId = null) {
  const pid = profileId ?? getActiveProfileId();
  const mode = getDbMode();
  if (mode === 'sqlite') {
    return getDb()
      .prepare(
        `SELECT * FROM bookmarks WHERE profile_id = ? ORDER BY created_at DESC`,
      )
      .all(pid)
      .map(mapBookmark);
  }
  return getJsonStore()
    .bookmarks.filter((b) => b.profile_id === pid)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map(mapBookmark);
}

export function addBookmark({ bookId, page, label = null, profileId = null }) {
  const pid = profileId ?? getActiveProfileId();
  const book = getBookById(bookId);
  if (!book) return { ok: false, error: 'Livre inconnu' };
  const pageNum = Math.max(0, Math.floor(Number(page) || 0));
  const lbl = label != null && String(label).trim() ? String(label).trim() : null;

  const mode = getDbMode();
  if (mode === 'sqlite') {
    const db = getDb();
    const existing = db
      .prepare(
        `SELECT id FROM bookmarks WHERE profile_id = ? AND book_id = ? AND page = ?`,
      )
      .get(pid, bookId, pageNum);
    if (existing) {
      if (lbl != null) {
        db.prepare(`UPDATE bookmarks SET label = ? WHERE id = ?`).run(lbl, existing.id);
      }
      return { ok: true, bookmark: mapBookmark(
        db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(existing.id),
      ), created: false };
    }
    const info = db
      .prepare(
        `INSERT INTO bookmarks (profile_id, book_id, page, label)
         VALUES (?, ?, ?, ?)`,
      )
      .run(pid, bookId, pageNum, lbl);
    return {
      ok: true,
      bookmark: mapBookmark(
        db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(info.lastInsertRowid),
      ),
      created: true,
    };
  }

  const store = getJsonStore();
  const existing = store.bookmarks.find(
    (b) => b.profile_id === pid && b.book_id === bookId && b.page === pageNum,
  );
  if (existing) {
    if (lbl != null) existing.label = lbl;
    persistJsonStore();
    return { ok: true, bookmark: mapBookmark(existing), created: false };
  }
  const row = {
    id: store.nextBookmarkId++,
    profile_id: pid,
    book_id: bookId,
    page: pageNum,
    label: lbl,
    created_at: new Date().toISOString(),
  };
  store.bookmarks.push(row);
  persistJsonStore();
  return { ok: true, bookmark: mapBookmark(row), created: true };
}

export function removeBookmark(id, profileId = null) {
  const pid = profileId ?? getActiveProfileId();
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const info = getDb()
      .prepare(`DELETE FROM bookmarks WHERE id = ? AND profile_id = ?`)
      .run(id, pid);
    return { ok: info.changes > 0 };
  }
  const store = getJsonStore();
  const before = store.bookmarks.length;
  store.bookmarks = store.bookmarks.filter(
    (b) => !(b.id === id && b.profile_id === pid),
  );
  persistJsonStore();
  return { ok: store.bookmarks.length < before };
}

export function removeBookmarkAtPage(bookId, page, profileId = null) {
  const pid = profileId ?? getActiveProfileId();
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const info = getDb()
      .prepare(
        `DELETE FROM bookmarks WHERE profile_id = ? AND book_id = ? AND page = ?`,
      )
      .run(pid, bookId, page);
    return { ok: info.changes > 0 };
  }
  const store = getJsonStore();
  const before = store.bookmarks.length;
  store.bookmarks = store.bookmarks.filter(
    (b) =>
      !(b.profile_id === pid && b.book_id === bookId && b.page === page),
  );
  persistJsonStore();
  return { ok: store.bookmarks.length < before };
}
