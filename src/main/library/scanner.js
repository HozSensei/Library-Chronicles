const SUPPORTED = new Set(['.cbz', '.cbr', '.pdf', '.zip']);

export async function scanLibraryRoot(rootDir) {
  // TODO[Phase 3]
  return {
    root: rootDir,
    found: [],
    supportedExtensions: [...SUPPORTED],
  };
}

export { SUPPORTED };
