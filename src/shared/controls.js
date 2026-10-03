/**
 * Mapping manette ROG Ally X / XInput — référence unique.
 */

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
});

export const GamepadButtons = Object.freeze({
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  SELECT: 8,
  START: 9,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
});

export const GamepadAxes = Object.freeze({
  LEFT_X: 0,
  LEFT_Y: 1,
  RIGHT_X: 2,
  RIGHT_Y: 3,
});

export const DEFAULT_DEADZONE = 0.18;
export const ZOOM_STEP = 0.15;
