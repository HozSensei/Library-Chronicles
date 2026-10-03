/** Profils locaux + préférences / bibliothèque isolée par profil. */

import fs from 'fs';
import path from 'path';
import {
  getDb,
  getDbMode,
  getJsonStore,
  persistJsonStore,
  defaultPrefsRow,
} from './db.js';
import { getConfig, setConfig, getDefaultPaths } from '../config.js';

const AVATAR_COLORS = [
  '#c4a35a',
  '#6b8f71',
  '#b85c38',
  '#4a7c9b',
  '#8b6b9e',
  '#c4785a',
];

function mapProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    color: row.color || '#c4a35a',
    avatarPath: row.avatar_path || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPrefs(row) {
  if (!row) {
    return {
      readingDirection: 'ltr',
      defaultFitMode: 'fit-height',
      webtoonMode: false,
      brightness: 1,
      contrast: 1,
      sepia: 0,
      libraryRoot: null,
      importRoot: null,
      theme: 'dark',
      language: 'fr',
      setupCompleted: false,
    };
  }
  return {
    readingDirection: row.reading_direction || 'ltr',
    defaultFitMode: row.default_fit_mode || 'fit-height',
    webtoonMode: Boolean(row.webtoon_mode),
    brightness: Number(row.brightness ?? 1),
    contrast: Number(row.contrast ?? 1),
    sepia: Number(row.sepia ?? 0),
    libraryRoot: row.library_root || null,
    importRoot: row.import_root || null,
    theme: row.theme || 'dark',
    language: row.language || 'fr',
    setupCompleted: Boolean(row.setup_completed),
  };
}

export function listProfiles() {
  const mode = getDbMode();
  if (mode === 'sqlite') {
    return getDb()
      .prepare('SELECT * FROM profiles ORDER BY id ASC')
      .all()
      .map(mapProfile);
  }
  return getJsonStore().profiles.map(mapProfile);
}

export function getProfile(id) {
  const mode = getDbMode();
  if (mode === 'sqlite') {
    return mapProfile(
      getDb().prepare('SELECT * FROM profiles WHERE id = ?').get(id),
    );
  }
  return mapProfile(getJsonStore().profiles.find((p) => p.id === id));
}

export function createProfile({ name, color, avatarPath } = {}) {
  const trimmed = String(name || '').trim() || 'Lecteur';
  const col =
    color || AVATAR_COLORS[listProfiles().length % AVATAR_COLORS.length];
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const db = getDb();
    const info = db
      .prepare(
        `INSERT INTO profiles (name, color, avatar_path) VALUES (?, ?, ?)`,
      )
      .run(trimmed, col, avatarPath || null);
    const id = Number(info.lastInsertRowid);
    const defaults = getDefaultPathsForProfile(id, trimmed);
    db.prepare(
      `INSERT OR IGNORE INTO profile_prefs (
        profile_id, library_root, import_root, theme, language, setup_completed
      ) VALUES (?, ?, ?, 'dark', 'fr', 0)`,
    ).run(id, defaults.libraryRoot, defaults.importRoot);
    return getProfile(id);
  }
  const store = getJsonStore();
  const id = store.nextProfileId++;
  const row = {
    id,
    name: trimmed,
    color: col,
    avatar_path: avatarPath || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  store.profiles.push(row);
  const defaults = getDefaultPathsForProfile(id, trimmed);
  store.prefs[id] = {
    ...defaultPrefsRow(id),
    library_root: defaults.libraryRoot,
    import_root: defaults.importRoot,
  };
  persistJsonStore();
  return mapProfile(row);
}

/** Chemins par défaut scoped au profil (bibliothèque isolée). */
export function getDefaultPathsForProfile(profileId, name = 'Lecteur') {
  const base = getDefaultPaths();
  const slug = String(name || 'lecteur')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'lecteur';
  const folder = `profile-${profileId}-${slug}`;
  return {
    libraryRoot: path.join(path.dirname(base.libraryRoot), folder, 'library'),
    importRoot: path.join(path.dirname(base.importRoot), folder, 'import'),
    covers: path.join(base.covers, `profile-${profileId}`),
  };
}

export function updateProfile(id, patch = {}) {
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const db = getDb();
    const fields = [];
    const params = { id };
    if (patch.name !== undefined) {
      fields.push('name = @name');
      params.name = String(patch.name).trim() || 'Lecteur';
    }
    if (patch.color !== undefined) {
      fields.push('color = @color');
      params.color = patch.color;
    }
    if (patch.avatarPath !== undefined) {
      fields.push('avatar_path = @avatarPath');
      params.avatarPath = patch.avatarPath;
    }
    if (!fields.length) return getProfile(id);
    fields.push("updated_at = datetime('now')");
    db.prepare(`UPDATE profiles SET ${fields.join(', ')} WHERE id = @id`).run(
      params,
    );
    return getProfile(id);
  }
  const store = getJsonStore();
  const row = store.profiles.find((p) => p.id === id);
  if (!row) return null;
  if (patch.name !== undefined) row.name = String(patch.name).trim() || 'Lecteur';
  if (patch.color !== undefined) row.color = patch.color;
  if (patch.avatarPath !== undefined) row.avatar_path = patch.avatarPath;
  row.updated_at = new Date().toISOString();
  persistJsonStore();
  return mapProfile(row);
}

export function deleteProfile(id) {
  const profiles = listProfiles();
  if (profiles.length <= 1 && profiles[0]?.id === id) {
    // Autoriser suppression du dernier profil → écran vide avec +
  } else if (profiles.length <= 0) {
    return { ok: false, error: 'Aucun profil' };
  }
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const db = getDb();
    db.prepare('DELETE FROM bookmarks WHERE profile_id = ?').run(id);
    db.prepare('DELETE FROM reading_progress WHERE profile_id = ?').run(id);
    db.prepare('DELETE FROM books WHERE profile_id = ?').run(id);
    db.prepare('DELETE FROM profile_prefs WHERE profile_id = ?').run(id);
    db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
  } else {
    const store = getJsonStore();
    store.profiles = store.profiles.filter((p) => p.id !== id);
    store.books = store.books.filter((b) => b.profile_id !== id);
    store.bookmarks = (store.bookmarks || []).filter((b) => b.profile_id !== id);
    for (const key of Object.keys(store.progress)) {
      if (key.startsWith(`${id}:`)) delete store.progress[key];
    }
    delete store.prefs[id];
    persistJsonStore();
  }

  // Covers scoped
  try {
    const covers = path.join(
      getDefaultPaths().covers,
      `profile-${id}`,
    );
    if (fs.existsSync(covers)) fs.rmSync(covers, { recursive: true, force: true });
  } catch {
    // ignore
  }

  const cfg = getConfig();
  if (cfg.activeProfileId === id) {
    const next = listProfiles()[0];
    setConfig({
      activeProfileId: next?.id ?? null,
      profileSelected: false,
      setupCompleted: false,
      libraryRoot: null,
      importRoot: null,
    });
  }
  return { ok: true };
}

/**
 * Retourne l’id profil actif, ou null s’il n’y a aucun profil.
 * Ne crée plus de profil automatique — l’UI propose « + ».
 */
export function getActiveProfileId() {
  const cfg = getConfig();
  const profiles = listProfiles();
  if (!profiles.length) {
    if (cfg.activeProfileId != null) {
      setConfig({ activeProfileId: null });
    }
    return null;
  }
  if (cfg.activeProfileId && profiles.some((p) => p.id === cfg.activeProfileId)) {
    return cfg.activeProfileId;
  }
  const id = profiles[0].id;
  setConfig({ activeProfileId: id });
  return id;
}

/**
 * Active un profil et synchronise config (chemins, thème, setup) + watchers.
 */
export function setActiveProfileId(id) {
  const profile = getProfile(id);
  if (!profile) return { ok: false, error: 'Profil inconnu' };
  const prefs = getProfilePrefs(id);

  // Migration douce : héritage config globale si prefs vides mais setup global ok
  const cfg = getConfig();
  let nextPrefs = prefs;
  if (!prefs.setupCompleted && cfg.setupCompleted && cfg.libraryRoot) {
    nextPrefs = setProfilePrefs(
      {
        libraryRoot: cfg.libraryRoot,
        importRoot: cfg.importRoot,
        theme: cfg.theme || 'dark',
        language: cfg.language || 'fr',
        setupCompleted: true,
      },
      id,
    );
  }

  setConfig({
    activeProfileId: id,
    profileSelected: true,
    libraryRoot: nextPrefs.libraryRoot,
    importRoot: nextPrefs.importRoot,
    theme: nextPrefs.theme,
    language: nextPrefs.language,
    setupCompleted: nextPrefs.setupCompleted,
    orientation: 'landscape',
  });

  return { ok: true, profile, prefs: nextPrefs };
}

export function getActiveProfile() {
  const id = getActiveProfileId();
  return id == null ? null : getProfile(id);
}

export function getProfilePrefs(profileId = null) {
  const pid = profileId ?? getActiveProfileId();
  if (pid == null) return mapPrefs(null);
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const row = getDb()
      .prepare('SELECT * FROM profile_prefs WHERE profile_id = ?')
      .get(pid);
    if (!row) {
      const defaults = getDefaultPathsForProfile(pid);
      getDb()
        .prepare(
          `INSERT OR IGNORE INTO profile_prefs (
            profile_id, library_root, import_root
          ) VALUES (?, ?, ?)`,
        )
        .run(pid, defaults.libraryRoot, defaults.importRoot);
      return mapPrefs(
        getDb()
          .prepare('SELECT * FROM profile_prefs WHERE profile_id = ?')
          .get(pid),
      );
    }
    return mapPrefs(row);
  }
  const store = getJsonStore();
  if (!store.prefs[pid]) {
    const defaults = getDefaultPathsForProfile(pid);
    store.prefs[pid] = {
      ...defaultPrefsRow(pid),
      library_root: defaults.libraryRoot,
      import_root: defaults.importRoot,
    };
    persistJsonStore();
  }
  return mapPrefs(store.prefs[pid]);
}

export function setProfilePrefs(patch = {}, profileId = null) {
  const pid = profileId ?? getActiveProfileId();
  if (pid == null) throw new Error('Aucun profil actif');
  const current = getProfilePrefs(pid);
  const next = {
    readingDirection:
      patch.readingDirection !== undefined
        ? patch.readingDirection
        : current.readingDirection,
    defaultFitMode:
      patch.defaultFitMode !== undefined
        ? patch.defaultFitMode
        : current.defaultFitMode,
    webtoonMode:
      patch.webtoonMode !== undefined ? Boolean(patch.webtoonMode) : current.webtoonMode,
    brightness: clamp(
      patch.brightness !== undefined ? Number(patch.brightness) : current.brightness,
      0.4,
      1.6,
    ),
    contrast: clamp(
      patch.contrast !== undefined ? Number(patch.contrast) : current.contrast,
      0.5,
      2,
    ),
    sepia: clamp(
      patch.sepia !== undefined ? Number(patch.sepia) : current.sepia,
      0,
      1,
    ),
    libraryRoot:
      patch.libraryRoot !== undefined ? patch.libraryRoot : current.libraryRoot,
    importRoot:
      patch.importRoot !== undefined ? patch.importRoot : current.importRoot,
    theme: patch.theme !== undefined ? patch.theme : current.theme,
    language: patch.language !== undefined ? patch.language : current.language,
    setupCompleted:
      patch.setupCompleted !== undefined
        ? Boolean(patch.setupCompleted)
        : current.setupCompleted,
  };

  const mode = getDbMode();
  if (mode === 'sqlite') {
    getDb()
      .prepare(
        `INSERT INTO profile_prefs (
          profile_id, reading_direction, default_fit_mode, webtoon_mode,
          brightness, contrast, sepia,
          library_root, import_root, theme, language, setup_completed, updated_at
        ) VALUES (
          @pid, @dir, @fit, @webtoon, @brightness, @contrast, @sepia,
          @libraryRoot, @importRoot, @theme, @language, @setup, datetime('now')
        )
        ON CONFLICT(profile_id) DO UPDATE SET
          reading_direction = @dir,
          default_fit_mode = @fit,
          webtoon_mode = @webtoon,
          brightness = @brightness,
          contrast = @contrast,
          sepia = @sepia,
          library_root = @libraryRoot,
          import_root = @importRoot,
          theme = @theme,
          language = @language,
          setup_completed = @setup,
          updated_at = datetime('now')`,
      )
      .run({
        pid,
        dir: next.readingDirection,
        fit: next.defaultFitMode,
        webtoon: next.webtoonMode ? 1 : 0,
        brightness: next.brightness,
        contrast: next.contrast,
        sepia: next.sepia,
        libraryRoot: next.libraryRoot,
        importRoot: next.importRoot,
        theme: next.theme,
        language: next.language,
        setup: next.setupCompleted ? 1 : 0,
      });
  } else {
    const store = getJsonStore();
    store.prefs[pid] = {
      profile_id: pid,
      reading_direction: next.readingDirection,
      default_fit_mode: next.defaultFitMode,
      webtoon_mode: next.webtoonMode ? 1 : 0,
      brightness: next.brightness,
      contrast: next.contrast,
      sepia: next.sepia,
      library_root: next.libraryRoot,
      import_root: next.importRoot,
      theme: next.theme,
      language: next.language,
      setup_completed: next.setupCompleted ? 1 : 0,
      updated_at: new Date().toISOString(),
    };
    persistJsonStore();
  }

  // Miroir config active si c’est le profil courant
  const cfg = getConfig();
  if (cfg.activeProfileId === pid) {
    setConfig({
      libraryRoot: next.libraryRoot,
      importRoot: next.importRoot,
      theme: next.theme,
      language: next.language,
      setupCompleted: next.setupCompleted,
    });
  }

  return getProfilePrefs(pid);
}

function clamp(n, min, max) {
  const v = Number.isFinite(n) ? n : min;
  return Math.min(max, Math.max(min, v));
}

export { AVATAR_COLORS };
