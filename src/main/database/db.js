/**
 * SQLite embarquée — better-sqlite3 avec fallback JSON si le module natif échoue.
 */

import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let db = null;
let mode = 'none'; // 'sqlite' | 'json' | 'none'
let jsonStore = { books: [], progress: {}, nextId: 1 };

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  series TEXT,
  volume INTEGER,
  author TEXT,
  year INTEGER,
  format TEXT,
  cover_path TEXT,
  page_total INTEGER DEFAULT 0,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'reading', 'finished')),
  metadata_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reading_progress (
  book_id INTEGER PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  page_current INTEGER DEFAULT 0,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'reading', 'finished')),
  last_access TEXT DEFAULT (datetime('now'))
);
`;

function dbFilePath() {
  return path.join(app.getPath('userData'), 'vdr-library.sqlite');
}

function jsonFilePath() {
  return path.join(app.getPath('userData'), 'vdr-library.json');
}

function loadJsonStore() {
  try {
    const raw = fs.readFileSync(jsonFilePath(), 'utf8');
    jsonStore = { books: [], progress: {}, nextId: 1, ...JSON.parse(raw) };
  } catch {
    jsonStore = { books: [], progress: {}, nextId: 1 };
  }
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
    // Migrations soft (colonnes ajoutées)
    migrateSqlite(instance);
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
        throw new Error('JSON mode — utiliser books.js helpers');
      },
    };
    mode = 'json';
    return { ready: true, mode, path: jsonFilePath() };
  }
}

function migrateSqlite(instance) {
  const cols = instance.prepare('PRAGMA table_info(books)').all().map((c) => c.name);
  const add = (name, ddl) => {
    if (!cols.includes(name)) {
      instance.exec(`ALTER TABLE books ADD COLUMN ${ddl}`);
    }
  };
  add('series', 'series TEXT');
  add('volume', 'volume INTEGER');
  add('author', 'author TEXT');
  add('year', 'year INTEGER');
  add('format', 'format TEXT');
  add('status', "status TEXT DEFAULT 'unread'");
  add('metadata_json', 'metadata_json TEXT');
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
