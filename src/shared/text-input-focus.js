/**
 * Détection focus champ texte (manette ne doit pas valider le formulaire).
 */

const TEXT_INPUT_TYPES = new Set([
  'text',
  'password',
  'search',
  'email',
  'url',
  'tel',
  'number',
  '',
]);

/**
 * @param {Element | EventTarget | null | undefined} el
 * @returns {boolean}
 */
export function isTextInputElement(el) {
  if (!el || typeof el !== 'object') return false;
  const node = /** @type {HTMLElement} */ (el);
  if (typeof node.tagName !== 'string') return false;

  const tag = node.tagName.toUpperCase();
  if (tag === 'TEXTAREA') return !/** @type {HTMLTextAreaElement} */ (node).disabled;

  if (tag === 'INPUT') {
    const input = /** @type {HTMLInputElement} */ (node);
    if (input.disabled) return false;
    const type = String(input.getAttribute('type') || 'text').toLowerCase();
    return TEXT_INPUT_TYPES.has(type);
  }

  if (node.isContentEditable) return true;
  return false;
}

/**
 * @param {Document | null | undefined} [doc]
 * @returns {HTMLElement | null}
 */
export function getFocusedTextInput(doc) {
  const d =
    doc ??
    (typeof document !== 'undefined' ? document : null);
  if (!d?.activeElement) return null;
  return isTextInputElement(d.activeElement)
    ? /** @type {HTMLElement} */ (d.activeElement)
    : null;
}

/**
 * @param {Document | null | undefined} [doc]
 * @returns {boolean}
 */
export function isTextInputFocused(doc) {
  return getFocusedTextInput(doc) != null;
}

/**
 * Confirm/A ne doit pas soumettre tant qu’un champ texte a le focus DOM.
 * Le CTA Valider focusé (bouton) laisse passer confirm.
 * @param {Document | null | undefined} [doc]
 * @returns {boolean}
 */
export function shouldBlockGamepadConfirmForText(doc) {
  return isTextInputFocused(doc);
}
