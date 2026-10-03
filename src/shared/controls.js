/**
 * Mapping manette ROG Ally X / XInput — référence unique.
 *
 * Important : en usage Ally portrait, les directions D-Pad / stick
 * doivent passer par `portrait-remap.js` (repère écran ≠ boutons physiques).
 */

export { DeviceOrientation, remapDpad, remapStick } from './portrait-remap.js';
export {
  DEFAULT_KEY_BINDINGS,
  BINDABLE_ACTIONS,
  resolveKeyBindings,
  actionForBinding,
  labelForBindingKey,
} from './key-bindings.js';
export {
  GamepadButtons,
  GamepadAxes,
  DEFAULT_DEADZONE,
  ZOOM_STEP,
} from './gamepad-codes.js';

export const ReadingMode = Object.freeze({
  FIT_HEIGHT: 'fit-height',
  FIT_WIDTH: 'fit-width',
  ZOOM_100: 'zoom-100',
});

export const ReadingDirection = Object.freeze({
  LTR: 'ltr',
  RTL: 'rtl',
});

export const Actions = Object.freeze({
  PAN: 'pan',
  TOGGLE_ZOOM: 'toggle-zoom',
  ZOOM_IN: 'zoom-in',
  ZOOM_OUT: 'zoom-out',
  PAGE_NEXT: 'page-next',
  PAGE_PREV: 'page-prev',
  TOGGLE_DIRECTION: 'toggle-direction',
  CLOSE_BOOK: 'close-book',
  TOGGLE_OVERLAY: 'toggle-overlay',
  CHAPTER_NEXT: 'chapter-next',
  CHAPTER_PREV: 'chapter-prev',
  FIT_WIDTH: 'fit-width',
  SCROLL: 'scroll',
  CONFIRM: 'confirm',
  CURSOR_UP: 'cursor-up',
  CURSOR_DOWN: 'cursor-down',
  CURSOR_LEFT: 'cursor-left',
  CURSOR_RIGHT: 'cursor-right',
  OPEN_BOOK: 'open-book',
  BACK: 'back',
  BOOK_OPTIONS: 'book-options',
  TAB_NEXT: 'tab-next',
  TAB_PREV: 'tab-prev',
  IMPORT: 'import',
  SETTINGS: 'settings',
  ENRICH: 'enrich',
  TOGGLE_PAUSE: 'toggle-pause',
});
