/**
 * Vérifie isTextInputFocused / blocage confirm manette + API clavier virtuel.
 */
import {
  isTextInputElement,
  isTextInputFocused,
  getFocusedTextInput,
  shouldBlockGamepadConfirmForText,
} from '../src/shared/text-input-focus.js';
import {
  showVirtualKeyboard,
  focusTextInputForEdit,
  installVirtualKeyboardOnFocus,
} from '../src/shared/virtual-keyboard.js';
import { IpcChannels } from '../src/shared/ipc-channels.js';

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else {
    console.log('OK  ', msg);
  }
}

// --- hors DOM (node) ---
assert(isTextInputElement(null) === false, 'null → pas input');
assert(isTextInputElement(undefined) === false, 'undefined → pas input');
assert(isTextInputFocused() === false, 'sans document → pas focus');
assert(getFocusedTextInput() === null, 'sans document → null');
assert(
  shouldBlockGamepadConfirmForText() === false,
  'sans document → ne bloque pas',
);

// --- faux DOM minimal ---
function fakeEl(tag, attrs = {}, props = {}) {
  const upper = tag.toUpperCase();
  const el = {
    tagName: upper,
    disabled: Boolean(props.disabled),
    readOnly: Boolean(props.readOnly),
    isContentEditable: Boolean(props.isContentEditable),
    _focused: false,
    getAttribute(name) {
      return attrs[name] ?? null;
    },
    classList: {
      contains: () => false,
    },
    focus() {
      el._focused = true;
    },
  };
  return el;
}

assert(isTextInputElement(fakeEl('input')) === true, 'input sans type → texte');
assert(
  isTextInputElement(fakeEl('input', { type: 'text' })) === true,
  'input text',
);
assert(
  isTextInputElement(fakeEl('input', { type: 'password' })) === true,
  'input password',
);
assert(
  isTextInputElement(fakeEl('input', { type: 'search' })) === true,
  'input search',
);
assert(
  isTextInputElement(fakeEl('input', { type: 'number' })) === true,
  'input number',
);
assert(
  isTextInputElement(fakeEl('input', { type: 'checkbox' })) === false,
  'checkbox → non',
);
assert(
  isTextInputElement(fakeEl('input', { type: 'button' })) === false,
  'button input → non',
);
assert(
  isTextInputElement(fakeEl('input', { type: 'text' }, { disabled: true })) ===
    false,
  'input disabled → non',
);
assert(
  isTextInputElement(fakeEl('input', { type: 'text' }, { readOnly: true })) ===
    false,
  'input readonly → non',
);
assert(isTextInputElement(fakeEl('textarea')) === true, 'textarea');
assert(
  isTextInputElement(fakeEl('textarea', {}, { readOnly: true })) === false,
  'textarea readonly → non',
);
assert(
  isTextInputElement(fakeEl('div', {}, { isContentEditable: true })) === true,
  'contenteditable',
);
assert(isTextInputElement(fakeEl('button')) === false, 'button → non');
assert(isTextInputElement(fakeEl('div')) === false, 'div → non');

const textInput = fakeEl('input', { type: 'text' });
const submitBtn = fakeEl('button', { type: 'submit' });
const fakeDoc = { activeElement: textInput };

assert(isTextInputFocused(fakeDoc) === true, 'focus input → true');
assert(
  shouldBlockGamepadConfirmForText(fakeDoc) === true,
  'A bloqué si input focus',
);
assert(getFocusedTextInput(fakeDoc) === textInput, 'getFocusedTextInput');

fakeDoc.activeElement = submitBtn;
assert(isTextInputFocused(fakeDoc) === false, 'focus bouton → pas input');
assert(
  shouldBlockGamepadConfirmForText(fakeDoc) === false,
  'A autorisé si bouton Valider focus',
);

fakeDoc.activeElement = null;
assert(
  shouldBlockGamepadConfirmForText(fakeDoc) === false,
  'pas d’activeElement → A OK',
);

assert(
  IpcChannels.APP_SHOW_VIRTUAL_KEYBOARD === 'app:show-virtual-keyboard',
  'canal IPC app:show-virtual-keyboard',
);

assert(typeof showVirtualKeyboard === 'function', 'showVirtualKeyboard exporté');
assert(typeof focusTextInputForEdit === 'function', 'focusTextInputForEdit');
assert(
  typeof installVirtualKeyboardOnFocus === 'function',
  'installVirtualKeyboardOnFocus',
);

// showVirtualKeyboard hors browser : focus-only / no crash
const vkResult = await showVirtualKeyboard(textInput);
assert(
  vkResult && typeof vkResult.ok === 'boolean',
  'showVirtualKeyboard retourne { ok }',
);
assert(textInput._focused === true, 'showVirtualKeyboard focus l’élément');

const off = installVirtualKeyboardOnFocus(null);
assert(typeof off === 'function', 'install sans doc → unsubscribe no-op');
off();

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\ntext-input / virtual-keyboard OK');
