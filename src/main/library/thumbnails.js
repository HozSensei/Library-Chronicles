/**
 * Cache disque des miniatures (première image du tome).
 * TODO[Phase 3]
 */

const path = require('path');
const { app } = require('electron');

function cacheDir() {
  return path.join(app.getPath('userData'), 'covers');
}

async function ensureCover(_bookFilePath, _getCoverBuffer) {
  // TODO[Phase 3]: hash path → fichier .jpg dans cacheDir()
  throw new Error('TODO[Phase 3]: ensureCover');
}

module.exports = { cacheDir, ensureCover };
