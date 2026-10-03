/**
 * Scan récursif du dossier bibliothèque.
 * TODO[Phase 3]
 */

const SUPPORTED = new Set(['.cbz', '.cbr', '.pdf', '.zip']);

async function scanLibraryRoot(_rootDir) {
  // TODO[Phase 3]: walk récursif, filtrer SUPPORTED, upsert DB, générer covers
  return {
    root: _rootDir,
    found: [],
    supportedExtensions: [...SUPPORTED],
  };
}

module.exports = { scanLibraryRoot, SUPPORTED };
