import path from 'path';
import { app } from 'electron';

export function cacheDir() {
  return path.join(app.getPath('userData'), 'covers');
}

export async function ensureCover(_bookFilePath, _getCoverBuffer) {
  throw new Error('TODO[Phase 3]: ensureCover');
}
