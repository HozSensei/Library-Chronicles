const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = {
  libraryRoot: null,
  lastOpenedPath: null,
  readingDirection: 'ltr',
  defaultFitMode: 'fit-height',
  /** Chemin CBZ de test pour Phase 1 (à renseigner). */
  phase1TestCbz: null,
};

let cache = null;

function configPath() {
  return path.join(app.getPath('userData'), 'vdr-config.json');
}

function getConfig() {
  if (cache) return { ...cache };
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    cache = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return { ...cache };
}

function setConfig(patch) {
  cache = { ...getConfig(), ...patch };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(cache, null, 2), 'utf8');
  return { ...cache };
}

module.exports = { getConfig, setConfig, DEFAULTS };
