/**
 * Boucle Gamepad API — polling 60/120 Hz.
 * Phase 0 : détection + événements basiques UI.
 * Phase 1 : pan / zoom / pages en mode lecture.
 */

const BUTTON = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LT: 6,
  RT: 7,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
};

const AXIS = { LX: 0, LY: 1, RX: 2, RY: 3 };
const DEADZONE = 0.18;

export class GamepadLoop {
  /**
   * @param {{ onStatus?: (msg: string) => void, onAction?: (action: string, payload?: object) => void }} handlers
   */
  constructor(handlers = {}) {
    this.onStatus = handlers.onStatus || (() => {});
    this.onAction = handlers.onAction || (() => {});
    this.running = false;
    this.rafId = null;
    this.prevButtons = [];
    this.padIndex = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.onStatus('scan…');
    this.tick();
  }

  stop() {
    this.running = false;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  tick = () => {
    if (!this.running) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = this.pickPad(pads);

    if (!pad) {
      this.onStatus('aucune manette');
      this.prevButtons = [];
    } else {
      this.onStatus(`${pad.id.slice(0, 42)}…`);
      this.processAxes(pad);
      this.processButtons(pad);
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  pickPad(pads) {
    if (this.padIndex != null && pads[this.padIndex]) {
      return pads[this.padIndex];
    }
    for (let i = 0; i < pads.length; i += 1) {
      if (pads[i]) {
        this.padIndex = i;
        return pads[i];
      }
    }
    this.padIndex = null;
    return null;
  }

  applyDeadzone(value) {
    return Math.abs(value) < DEADZONE ? 0 : value;
  }

  processAxes(pad) {
    const x = this.applyDeadzone(pad.axes[AXIS.LX] || 0);
    const y = this.applyDeadzone(pad.axes[AXIS.LY] || 0);
    if (x !== 0 || y !== 0) {
      this.onAction('stick', { x, y });
    }
  }

  processButtons(pad) {
    const pressed = (index) => Boolean(pad.buttons[index]?.pressed);
    const edge = (index) => pressed(index) && !this.prevButtons[index];

    if (edge(BUTTON.A)) this.onAction('a');
    if (edge(BUTTON.B)) this.onAction('b');
    if (edge(BUTTON.Y)) this.onAction('y');
    if (edge(BUTTON.L3) || edge(BUTTON.R3)) this.onAction('toggle-zoom');
    if (edge(BUTTON.DPAD_UP)) this.onAction('dpad-up');
    if (edge(BUTTON.DPAD_DOWN)) this.onAction('dpad-down');
    if (edge(BUTTON.DPAD_LEFT)) this.onAction('dpad-left');
    if (edge(BUTTON.DPAD_RIGHT)) this.onAction('dpad-right');
    if (edge(BUTTON.LT)) this.onAction('lt');
    if (edge(BUTTON.RT)) this.onAction('rt');

    this.prevButtons = pad.buttons.map((b) => Boolean(b?.pressed));
  }
}

export { BUTTON, AXIS, DEADZONE };
