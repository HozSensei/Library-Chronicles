/**
 * SQLite embarquée — better-sqlite3 avec fallback JSON si le module natif échoue.
 */

import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { seriesIdFromName } from './series.js';

let db = null;
let mode = 'none'; // 'sqlite' | 'json' | 'none'
let jsonStore = emptyJsonStore();

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#c4a35a',
  avatar_path TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  title TEXT NOT NULL,
  series TEXT,
  series_id TEXT,
  volume INTEGER,
  author TEXT,
  year INTEGER,
  format TEXT,
  cover_path TEXT,
  page_total INTEGER DEFAULT 0,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'reading', 'finished')),
  metadata_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(profile_id, file_path)
);

CREATE TABLE IF NOT EXISTS reading_progress (
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page_current INTEGER DEFAULT 0,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'reading', 'finished')),
  last_access TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (profile_id, book_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  label TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(profile_id, book_id, page)
);

CREATE TABLE IF NOT EXISTS profile_prefs (
  profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  reading_direction TEXT DEFAULT 'ltr',
  default_fit_mode TEXT DEFAULT 'fit-height',
  webtoon_mode INTEGER DEFAULT 0,
  brightness REAL DEFAULT 1,
  contrast REAL DEFAULT 1,
  sepia REAL DEFAULT 0,
  library_root TEXT,
  import_root TEXT,
  theme TEXT DEFAULT 'dark',
  accent TEXT DEFAULT 'amber',
  language TEXT DEFAULT 'fr',
  setup_completed INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_books_series_id ON books(series_id);
CREATE INDEX IF NOT EXISTS idx_books_profile ON books(profile_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_book ON bookmarks(profile_id, book_id);
`;

function emptyJsonStore() {
  return {
    profiles: [],
    books: [],
    progress: {}, // key `${profileId}:${bookId}`
    bookmarks: [],
    prefs: {}, // key profileId
    nextId: 1,
    nextProfileId: 1,
    nextBookmarkId: 1,
  };
}

function dbFilePath() {
  return path.join(app.getPath('userData'), 'vdr-library.sqlite');
}

function jsonFilePath() {
  return path.join(app.getPath('userData'), 'vdr-library.json');
}

function loadJsonStore() {
  try {
    const raw = fs.readFileSync(jsonFilePath(), 'utf8');
    const parsed = JSON.parse(raw);
    jsonStore = { ...emptyJsonStore(), ...parsed };
    // Migration JSON ancien format (progress par bookId uniquement)
    if (parsed.progress && !parsed.profiles?.length) {
      migrateLegacyJsonProgress(parsed);
    }
    migrateJsonBooksProfileId();
    // Ne plus forcer un profil par défaut — écran profils peut être vide (+)
  } catch {
    jsonStore = emptyJsonStore();
  }
}

function migrateLegacyJsonProgress(parsed) {
  const profileId = 1;
  if (!jsonStore.profiles.length) {
    jsonStore.profiles.push({
      id: profileId,
      name: 'Lecteur',
      color: '#c4a35a',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    jsonStore.nextProfileId = 2;
  }
  const next = {};
  for (const [bookId, prog] of Object.entries(parsed.progress || {})) {
    if (String(bookId).includes(':')) {
      next[bookId] = prog;
    } else {
      next[`${profileId}:${bookId}`] = prog;
    }
  }
  jsonStore.progress = next;
  if (!jsonStore.bookmarks) jsonStore.bookmarks = [];
  if (!jsonStore.prefs) jsonStore.prefs = {};
}

/** Assigne profile_id aux livres JSON legacy (biblio globale → profil 1). */
function migrateJsonBooksProfileId() {
  let changed = false;
  const fallbackPid = jsonStore.profiles[0]?.id ?? 1;
  for (const book of jsonStore.books) {
    if (book.profile_id == null) {
      book.profile_id = fallbackPid;
      changed = true;
    }
  }
  for (const [pid, prefs] of Object.entries(jsonStore.prefs || {})) {
    if (prefs.setup_completed === undefined) {
      prefs.setup_completed = 1;
      changed = true;
    }
  }
  if (changed) saveJsonStore();
}

function ensureDefaultProfileJson() {
  if (!jsonStore.profiles.length) {
    jsonStore.profiles.push({
      id: jsonStore.nextProfileId++,
      name: 'Lecteur',
      color: '#c4a35a',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  const pid = jsonStore.profiles[0].id;
  if (!jsonStore.prefs[pid]) {
    jsonStore.prefs[pid] = defaultPrefsRow(pid);
  }
}

function defaultPrefsRow(profileId) {
  return {
    profile_id: profileId,
    reading_direction: 'ltr',
    default_fit_mode: 'fit-height',
    webtoon_mode: 0,
    brightness: 1,
    contrast: 1,
    sepia: 0,
    library_root: null,
    import_root: null,
    theme: 'dark',
    accent: 'amber',
    language: 'fr',
    setup_completed: 0,
    updated_at: new Date().toISOString(),
  };
}

function saveJsonStore() {
  fs.mkdirSync(path.dirname(jsonFilePath()), { recursive: true });
  fs.writeFileSync(jsonFilePath(), JSON.stringify(jsonStore, null, 2), 'utf8');
}

export function initDatabase() {
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const Database = require('better-sqlite3');
    const file = dbFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const instance = new Database(file);
    instance.pragma('journal_mode = WAL');
    instance.pragma('foreign_keys = ON');
    instance.exec(SCHEMA);
    migrateSqlite(instance);
    // Profils optionnels : l’écran « Qui lit ? » gère la création (+)
    ensureProfilePrefsSqlite(instance);
    db = instance;
    mode = 'sqlite';
    console.info('[VDR] SQLite prêt →', file);
    return { ready: true, mode, path: file };
  } catch (err) {
    console.warn(
      '[VDR] better-sqlite3 indisponible, fallback JSON:',
      err.message,
    );
    console.warn(
      '[VDR] Astuce: npm rebuild better-sqlite3 --runtime=electron --target=<version Electron>',
    );
    loadJsonStore();
    db = {
      prepare() {
        throw new Error('JSON mode — utiliser helpers database/*');
      },
    };
    mode = 'json';
    return { ready: true, mode, path: jsonFilePath() };
  }
}

function migrateSqlite(instance) {
  const bookCols = instance
    .prepare('PRAGMA table_info(books)')
    .all()
    .map((c) => c.name);
  const addBook = (name, ddl) => {
    if (!bookCols.includes(name)) {
      instance.exec(`ALTER TABLE books ADD COLUMN ${ddl}`);
    }
  };
  addBook('series', 'series TEXT');
  addBook('series_id', 'series_id TEXT');
  addBook('volume', 'volume INTEGER');
  addBook('author', 'author TEXT');
  addBook('year', 'year INTEGER');
  addBook('format', 'format TEXT');
  addBook('status', "status TEXT DEFAULT 'unread'");
  addBook('metadata_json', 'metadata_json TEXT');

  // avatar_path sur profiles
  const profileCols = instance
    .prepare('PRAGMA table_info(profiles)')
    .all()
    .map((c) => c.name);
  if (!profileCols.includes('avatar_path')) {
    instance.exec('ALTER TABLE profiles ADD COLUMN avatar_path TEXT');
  }

  // Migration ancienne reading_progress (PK book_id seul) → composite
  migrateLegacyProgressTable(instance);

  // profile_id sur books (biblio isolée par profil)
  migrateBooksProfileId(instance);

  // Colonnes prefs profil (dossiers / thème / setup)
  migrateProfilePrefsColumns(instance);

  // Remplir series_id manquants
  const missing = instance
    .prepare(
      `SELECT id, series FROM books WHERE series_id IS NULL AND series IS NOT NULL AND series != ''`,
    )
    .all();
  if (missing.length) {
    const upd = instance.prepare('UPDATE books SET series_id = ? WHERE id = ?');
    for (const row of missing) {
      upd.run(seriesIdFromName(row.series), row.id);
    }
  }
}

function migrateBooksProfileId(instance) {
  const cols = instance
    .prepare('PRAGMA table_info(books)')
    .all()
    .map((c) => c.name);
  if (cols.includes('profile_id')) return;

  // Ancienne table sans profile_id : reconstruire avec UNIQUE(profile_id, file_path)
  ensureProfilePrefsSqlite(instance);
  let profile = instance.prepare('SELECT id FROM profiles ORDER BY id LIMIT 1').get();
  if (!profile) {
    const info = instance
      .prepare(`INSERT INTO profiles (name, color) VALUES ('Lecteur', '#c4a35a')`)
      .run();
    instance
      .prepare(`INSERT OR IGNORE INTO profile_prefs (profile_id) VALUES (?)`)
      .run(info.lastInsertRowid);
    profile = { id: Number(info.lastInsertRowid) };
  }
  const pid = profile.id;

  instance.exec(`
    CREATE TABLE books_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      title TEXT NOT NULL,
      series TEXT,
      series_id TEXT,
      volume INTEGER,
      author TEXT,
      year INTEGER,
      format TEXT,
      cover_path TEXT,
      page_total INTEGER DEFAULT 0,
      status TEXT DEFAULT 'unread',
      metadata_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(profile_id, file_path)
    );
  `);
  instance
    .prepare(
      `INSERT INTO books_v2 (
        id, profile_id, file_path, title, series, series_id, volume, author, year,
        format, cover_path, page_total, status, metadata_json, created_at, updated_at
      )
      SELECT id, ?, file_path, title, series, series_id, volume, author, year,
        format, cover_path, page_total, status, metadata_json, created_at, updated_at
      FROM books`,
    )
    .run(pid);
  instance.exec(`
    DROP TABLE books;
    ALTER TABLE books_v2 RENAME TO books;
    CREATE INDEX IF NOT EXISTS idx_books_series_id ON books(series_id);
    CREATE INDEX IF NOT EXISTS idx_books_profile ON books(profile_id);
  `);
}

function migrateProfilePrefsColumns(instance) {
  const cols = instance
    .prepare('PRAGMA table_info(profile_prefs)')
    .all()
    .map((c) => c.name);
  const add = (name, ddl) => {
    if (!cols.includes(name)) instance.exec(`ALTER TABLE profile_prefs ADD COLUMN ${ddl}`);
  };
  add('library_root', 'library_root TEXT');
  add('import_root', 'import_root TEXT');
  add('theme', "theme TEXT DEFAULT 'dark'");
  add('accent', "accent TEXT DEFAULT 'amber'");
  add('language', "language TEXT DEFAULT 'fr'");
  add('setup_completed', 'setup_completed INTEGER DEFAULT 0');
}

function migrateLegacyProgressTable(instance) {
  const info = instance.prepare('PRAGMA table_info(reading_progress)').all();
  const cols = info.map((c) => c.name);
  if (!cols.length) return;
  if (cols.includes('profile_id')) return;

  // Ancienne table : book_id PRIMARY KEY
  instance.exec(`
    CREATE TABLE IF NOT EXISTS reading_progress_v2 (
      profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      page_current INTEGER DEFAULT 0,
      status TEXT DEFAULT 'unread',
      last_access TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (profile_id, book_id)
    );
  `);

  ensureProfilePrefsSqlite(instance);
  const profile = instance.prepare('SELECT id FROM profiles ORDER BY id LIMIT 1').get();
  const pid = profile?.id || 1;

  instance
    .prepare(
      `INSERT OR IGNORE INTO reading_progress_v2 (profile_id, book_id, page_current, status, last_access)
       SELECT ?, book_id, page_current, status, last_access FROM reading_progress`,
    )
    .run(pid);

  instance.exec(`
    DROP TABLE reading_progress;
    ALTER TABLE reading_progress_v2 RENAME TO reading_progress;
  `);
}

function ensureProfilePrefsSqlite(instance) {
  const profiles = instance.prepare('SELECT id FROM profiles').all();
  const ins = instance.prepare(
    `INSERT OR IGNORE INTO profile_prefs (profile_id) VALUES (?)`,
  );
  for (const p of profiles) ins.run(p.id);
}

/** @deprecated Conservé pour migrations legacy uniquement. */
function ensureDefaultProfileSqlite(instance) {
  const count = instance.prepare('SELECT COUNT(*) AS c FROM profiles').get().c;
  if (count === 0) {
    const info = instance
      .prepare(`INSERT INTO profiles (name, color) VALUES ('Lecteur', '#c4a35a')`)
      .run();
    instance
      .prepare(`INSERT OR IGNORE INTO profile_prefs (profile_id) VALUES (?)`)
      .run(info.lastInsertRowid);
  } else {
    ensureProfilePrefsSqlite(instance);
  }
}

export function getDb() {
  return db;
}

export function getDbMode() {
  return mode;
}

export function getJsonStore() {
  return jsonStore;
}

export function persistJsonStore() {
  saveJsonStore();
}

export function closeDatabase() {
  if (mode === 'sqlite' && db) {
    try {
      db.close();
    } catch {
      // ignore
    }
  }
  if (mode === 'json') saveJsonStore();
  db = null;
  mode = 'none';
}

export { defaultPrefsRow };
