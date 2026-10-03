/** Profils locaux + préférences de lecture par profil. */

import {
  getDb,
  getDbMode,
  getJsonStore,
  persistJsonStore,
  defaultPrefsRow,
} from './db.js';
import { getConfig, setConfig } from '../config.js';

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
    };
  }
  return {
    readingDirection: row.reading_direction || 'ltr',
    defaultFitMode: row.default_fit_mode || 'fit-height',
    webtoonMode: Boolean(row.webtoon_mode),
    brightness: Number(row.brightness ?? 1),
    contrast: Number(row.contrast ?? 1),
    sepia: Number(row.sepia ?? 0),
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

export function createProfile({ name, color } = {}) {
  const trimmed = String(name || '').trim() || 'Lecteur';
  const col =
    color || AVATAR_COLORS[listProfiles().length % AVATAR_COLORS.length];
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const db = getDb();
    const info = db
      .prepare(`INSERT INTO profiles (name, color) VALUES (?, ?)`)
      .run(trimmed, col);
    db.prepare(`INSERT OR IGNORE INTO profile_prefs (profile_id) VALUES (?)`).run(
      info.lastInsertRowid,
    );
    return getProfile(Number(info.lastInsertRowid));
  }
  const store = getJsonStore();
  const id = store.nextProfileId++;
  const row = {
    id,
    name: trimmed,
    color: col,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  store.profiles.push(row);
  store.prefs[id] = defaultPrefsRow(id);
  persistJsonStore();
  return mapProfile(row);
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
  row.updated_at = new Date().toISOString();
  persistJsonStore();
  return mapProfile(row);
}

export function deleteProfile(id) {
  const profiles = listProfiles();
  if (profiles.length <= 1) {
    return { ok: false, error: 'Au moins un profil est requis' };
  }
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const db = getDb();
    db.prepare('DELETE FROM bookmarks WHERE profile_id = ?').run(id);
    db.prepare('DELETE FROM reading_progress WHERE profile_id = ?').run(id);
    db.prepare('DELETE FROM profile_prefs WHERE profile_id = ?').run(id);
    db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
  } else {
    const store = getJsonStore();
    store.profiles = store.profiles.filter((p) => p.id !== id);
    store.bookmarks = (store.bookmarks || []).filter((b) => b.profile_id !== id);
    for (const key of Object.keys(store.progress)) {
      if (key.startsWith(`${id}:`)) delete store.progress[key];
    }
    delete store.prefs[id];
    persistJsonStore();
  }

  const cfg = getConfig();
  if (cfg.activeProfileId === id) {
    const next = listProfiles()[0];
    setConfig({ activeProfileId: next.id });
  }
  return { ok: true };
}

export function getActiveProfileId() {
  const cfg = getConfig();
  const profiles = listProfiles();
  if (!profiles.length) {
    const created = createProfile({ name: 'Lecteur' });
    setConfig({ activeProfileId: created.id });
    return created.id;
  }
  if (cfg.activeProfileId && profiles.some((p) => p.id === cfg.activeProfileId)) {
    return cfg.activeProfileId;
  }
  const id = profiles[0].id;
  setConfig({ activeProfileId: id });
  return id;
}

export function setActiveProfileId(id) {
  const profile = getProfile(id);
  if (!profile) return { ok: false, error: 'Profil inconnu' };
  setConfig({ activeProfileId: id });
  return { ok: true, profile };
}

export function getActiveProfile() {
  return getProfile(getActiveProfileId());
}

export function getProfilePrefs(profileId = null) {
  const pid = profileId ?? getActiveProfileId();
  const mode = getDbMode();
  if (mode === 'sqlite') {
    const row = getDb()
      .prepare('SELECT * FROM profile_prefs WHERE profile_id = ?')
      .get(pid);
    if (!row) {
      getDb()
        .prepare('INSERT OR IGNORE INTO profile_prefs (profile_id) VALUES (?)')
        .run(pid);
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
    store.prefs[pid] = defaultPrefsRow(pid);
    persistJsonStore();
  }
  return mapPrefs(store.prefs[pid]);
}

export function setProfilePrefs(patch = {}, profileId = null) {
  const pid = profileId ?? getActiveProfileId();
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
  };

  const mode = getDbMode();
  if (mode === 'sqlite') {
    getDb()
      .prepare(
        `INSERT INTO profile_prefs (
          profile_id, reading_direction, default_fit_mode, webtoon_mode,
          brightness, contrast, sepia, updated_at
        ) VALUES (
          @pid, @dir, @fit, @webtoon, @brightness, @contrast, @sepia, datetime('now')
        )
        ON CONFLICT(profile_id) DO UPDATE SET
          reading_direction = @dir,
          default_fit_mode = @fit,
          webtoon_mode = @webtoon,
          brightness = @brightness,
          contrast = @contrast,
          sepia = @sepia,
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
      });
    return getProfilePrefs(pid);
  }

  const store = getJsonStore();
  store.prefs[pid] = {
    profile_id: pid,
    reading_direction: next.readingDirection,
    default_fit_mode: next.defaultFitMode,
    webtoon_mode: next.webtoonMode ? 1 : 0,
    brightness: next.brightness,
    contrast: next.contrast,
    sepia: next.sepia,
    updated_at: new Date().toISOString(),
  };
  persistJsonStore();
  return getProfilePrefs(pid);
}

function clamp(n, min, max) {
  const v = Number.isFinite(n) ? n : min;
  return Math.min(max, Math.max(min, v));
}

export { AVATAR_COLORS };
