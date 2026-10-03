import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const DEFAULTS = {
  libraryRoot: null,
  lastOpenedPath: null,
  readingDirection: 'ltr',
  defaultFitMode: 'fit-height',
  /** Ally portrait : 'portrait-ccw' | 'landscape' (dev). */
  orientation: 'portrait-ccw',
  phase1TestCbz: null,
};

let cache = null;

function configPath() {
  return path.join(app.getPath('userData'), 'vdr-config.json');
}

export function getConfig() {
  if (cache) return { ...cache };
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    cache = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return { ...cache };
}

export function setConfig(patch) {
  cache = { ...getConfig(), ...patch };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(cache, null, 2), 'utf8');
  return { ...cache };
}

export { DEFAULTS };
