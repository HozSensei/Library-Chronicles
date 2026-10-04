/**
 * Dump debug apply méta (mode developer uniquement).
 * Écrit sous userData/.debug/meta-apply/ et, si possible, workspace/.debug/meta-apply/.
 */

import fs from 'fs';
import path from 'path';
import { app, ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels.js';
import { isDevMode, sanitizeForIpc } from '../../shared/plain-clone.js';

function debugRoots() {
  const roots = [];
  try {
    roots.push(path.join(app.getPath('userData'), '.debug', 'meta-apply'));
  } catch {
    /* app pas prêt */
  }
  // Workspace local (agents / dev) — ignore si hors repo
  try {
    const cwd = process.cwd();
    if (cwd && fs.existsSync(path.join(cwd, 'package.json'))) {
      roots.push(path.join(cwd, '.debug', 'meta-apply'));
    }
  } catch {
    /* ignore */
  }
  return roots;
}

/**
 * @param {object} payload
 * @returns {{ ok: boolean, paths?: string[], skipped?: boolean, error?: string }}
 */
export function writeMetaApplyDebugDump(payload) {
  if (!isDevMode() && process.env.VDR_META_APPLY_DEBUG !== '1') {
    return { ok: true, skipped: true };
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const provider = String(payload?.provider || payload?.normalized?.provider || 'unknown')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 40);
  const fileName = `apply-${stamp}-${provider}.json`;
  const body = sanitizeForIpc({
    dumpedAt: new Date().toISOString(),
    provider,
    fieldsSelected: payload?.fieldsSelected ?? null,
    raw: payload?.raw ?? null,
    normalized: payload?.normalized ?? null,
    patch: payload?.patch ?? null,
    bookId: payload?.bookId ?? null,
  });

  const written = [];
  for (const root of debugRoots()) {
    try {
      fs.mkdirSync(root, { recursive: true });
      const target = path.join(root, fileName);
      fs.writeFileSync(target, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
      written.push(target);
    } catch (err) {
      console.warn('[VDR] meta-apply dump:', err?.message || err);
    }
  }

  if (!written.length) {
    return { ok: false, error: 'aucun répertoire dump accessible' };
  }
  console.info('[VDR] meta-apply dump →', written.join(', '));
  return { ok: true, paths: written };
}

export function registerMetaApplyDebugIpc() {
  ipcMain.handle(IpcChannels.METADATA_DEBUG_DUMP_APPLY, async (_e, payload) =>
    writeMetaApplyDebugDump(payload || {}),
  );
}
