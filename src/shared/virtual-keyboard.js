/**
 * Ouvre le clavier virtuel OS / VirtualKeyboard API quand un champ texte
 * reçoit le focus (ROG Ally, tablette Windows, Steam Deck Desktop…).
 */

import { isTextInputElement } from './text-input-focus.js';

/**
 * @param {HTMLElement | null | undefined} [el]
 * @returns {Promise<{ ok: boolean, method?: string }>}
 */
export async function showVirtualKeyboard(el) {
  const target = el && isTextInputElement(el) ? el : null;
  if (target && typeof target.focus === 'function') {
    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
  }

  // Virtual Keyboard API (Chromium / Electron récents)
  try {
    const vk = typeof navigator !== 'undefined' ? navigator.virtualKeyboard : null;
    if (vk && typeof vk.show === 'function') {
      vk.overlaysContent = true;
      vk.show();
      return { ok: true, method: 'virtualKeyboard' };
    }
  } catch {
    // ignore
  }

  // IPC main → TabTip / osk (Windows)
  try {
    const api = typeof window !== 'undefined' ? window.vdr?.showVirtualKeyboard : null;
    if (typeof api === 'function') {
      const result = await api();
      if (result?.ok) return { ok: true, method: result.method || 'ipc' };
      return { ok: Boolean(result?.ok), method: result?.method };
    }
  } catch {
    // ignore
  }

  return { ok: false, method: 'focus-only' };
}

/**
 * Focus + clavier pour un champ (création profil, API key, etc.).
 * @param {HTMLElement | null | undefined} el
 */
export async function focusTextInputForEdit(el) {
  if (!el || !isTextInputElement(el)) return { ok: false };
  return showVirtualKeyboard(el);
}

/**
 * Délégation focusin : tout input/textarea déclenche le clavier virtuel.
 * @param {Document | null | undefined} [doc]
 * @returns {() => void} unsubscribe
 */
export function installVirtualKeyboardOnFocus(doc) {
  const d =
    doc ??
    (typeof document !== 'undefined' ? document : null);
  if (!d?.addEventListener) return () => {};

  /** @param {FocusEvent} ev */
  const onFocusIn = (ev) => {
    const t = /** @type {HTMLElement | null} */ (ev.target);
    if (!isTextInputElement(t)) return;
    // Ne pas await : fire-and-forget pour ne pas bloquer le focus
    void showVirtualKeyboard(t);
  };

  d.addEventListener('focusin', onFocusIn, true);
  return () => d.removeEventListener('focusin', onFocusIn, true);
}
