import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { DEFAULT_KEY_BINDINGS } from '../shared/key-bindings.js';

const DEFAULTS = {
  setupCompleted: false,
  libraryRoot: null,
  importRoot: null,
  language: 'fr',
  theme: 'dark',
  readingDirection: 'ltr',
  defaultFitMode: 'fit-height',
  /** Ally portrait : 'portrait-ccw' | 'landscape' (dev). */
  orientation: 'portrait-ccw',
  lastOpenedPath: null,
  phase1TestCbz: null,
  /** Overrides partiels des bindings ; null = défauts complets. */
  keyBindings: null,
  /**
   * Clés API stockées localement (userData), jamais commitables.
   * Ex. { comicvine: 'xxx' }
   */
  apiKeys: {},
  /** Provider métadonnées actif. */
  metadataProvider: 'stub',
  /**
   * Feedback haptique manette (Ally / GamepadHapticActuator).
   * No-op si l’API ou le matériel est absent.
   */
  hapticsEnabled: true,
};

let cache = null;

function configPath() {
  return path.join(app.getPath('userData'), 'vdr-config.json');
}

function secretsPath() {
  return path.join(app.getPath('userData'), 'vdr-secrets.json');
}

export function getConfig() {
  if (cache) return sanitizePublic({ ...cache });
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    cache = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    cache = { ...DEFAULTS };
  }
  // Secrets séparés (clés API)
  try {
    const secrets = JSON.parse(fs.readFileSync(secretsPath(), 'utf8'));
    cache.apiKeys = { ...(cache.apiKeys || {}), ...(secrets.apiKeys || {}) };
  } catch {
    // ignore
  }
  return sanitizePublic({ ...cache });
}

/** Config complète côté main (avec clés API). */
export function getConfigInternal() {
  getConfig();
  return { ...cache };
}

export function setConfig(patch) {
  getConfig();
  const next = { ...cache, ...patch };

  // Séparer les secrets
  if (patch.apiKeys) {
    next.apiKeys = { ...(cache.apiKeys || {}), ...patch.apiKeys };
    writeSecrets({ apiKeys: next.apiKeys });
  }

  // Ne pas écrire les apiKeys dans le fichier config principal
  const { apiKeys, ...publicPart } = next;
  cache = next;

  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(publicPart, null, 2), 'utf8');
  return sanitizePublic({ ...cache });
}

function writeSecrets(data) {
  fs.mkdirSync(path.dirname(secretsPath()), { recursive: true });
  fs.writeFileSync(secretsPath(), JSON.stringify(data, null, 2), 'utf8');
  try {
    fs.chmodSync(secretsPath(), 0o600);
  } catch {
    // Windows / FS sans chmod
  }
}

/** Masque les clés API pour le renderer (présence seulement). */
function sanitizePublic(cfg) {
  const keys = cfg.apiKeys || {};
  const apiKeyPresence = {};
  for (const [k, v] of Object.entries(keys)) {
    apiKeyPresence[k] = Boolean(v && String(v).length > 0);
  }
  const { apiKeys: _omit, ...rest } = cfg;
  return {
    ...rest,
    apiKeyPresence,
    keyBindings: cfg.keyBindings || null,
    defaultKeyBindings: DEFAULT_KEY_BINDINGS,
  };
}

export function getDefaultPaths() {
  const documents = app.getPath('documents');
  const base = path.join(documents, 'VerticalDeckReader');
  return {
    libraryRoot: path.join(base, 'library'),
    importRoot: path.join(base, 'import'),
    covers: path.join(app.getPath('userData'), 'covers'),
  };
}

export { DEFAULTS };
