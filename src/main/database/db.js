/**
 * SQLite embarquée — Phase 3.
 * Schéma prévu : books + reading_progress.
 */

const path = require('path');
const { app } = require('electron');

let db = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  cover_path TEXT,
  page_total INTEGER DEFAULT 0,
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

function initDatabase() {
  // TODO[Phase 3]: require('better-sqlite3') et exécuter SCHEMA
  // Garder un stub pour ne pas bloquer le démarrage sans native rebuild.
  db = {
    ready: false,
    path: dbFilePath(),
    schema: SCHEMA,
  };
  console.info('[VDR] DB stub initialisé →', db.path);
  return db;
}

function getDb() {
  return db;
}

module.exports = { initDatabase, getDb, SCHEMA };
