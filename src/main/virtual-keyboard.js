/**
 * Lance le clavier tactile Windows (TabTip) ou OSK en secours.
 * No-op hors Windows.
 */
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function tabTipCandidates() {
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const win = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
  return [
    path.join(pf, 'Common Files', 'microsoft shared', 'ink', 'TabTip.exe'),
    path.join(pf86, 'Common Files', 'microsoft shared', 'ink', 'TabTip.exe'),
    path.join(win, 'System32', 'TabTip.exe'),
  ];
}

function oskPath() {
  const win = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
  return path.join(win, 'System32', 'osk.exe');
}

/**
 * @returns {Promise<{ ok: boolean, method?: string, reason?: string }>}
 */
export async function showWindowsVirtualKeyboard() {
  if (process.platform !== 'win32') {
    return { ok: false, reason: 'not-windows' };
  }

  for (const candidate of tabTipCandidates()) {
    if (!exists(candidate)) continue;
    try {
      // detached : ne bloque pas le process Electron
      execFile(candidate, [], {
        windowsHide: true,
        detached: true,
        stdio: 'ignore',
      }).unref?.();
      return { ok: true, method: 'TabTip' };
    } catch {
      // essayer suivant
    }
  }

  const osk = oskPath();
  if (exists(osk)) {
    try {
      execFile(osk, [], {
        windowsHide: false,
        detached: true,
        stdio: 'ignore',
      }).unref?.();
      return { ok: true, method: 'osk' };
    } catch (err) {
      return {
        ok: false,
        reason: err?.message || 'osk-failed',
        method: 'osk',
      };
    }
  }

  return { ok: false, reason: 'no-keyboard-binary' };
}
