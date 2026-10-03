/**
 * Feedback haptique manette (ROG Ally / Gamepad API).
 * Utilise GamepadHapticActuator ou vibrationActuator si présents ; no-op sinon.
 *
 * Throttle global (~100 ms) pour éviter le spam stick-repeat / focus rafale.
 */

/** @typedef {'light' | 'confirm' | 'nav'} HapticKind */

const PATTERNS = {
  light: { duration: 28, weakMagnitude: 0.18, strongMagnitude: 0.12 },
  nav: { duration: 22, weakMagnitude: 0.14, strongMagnitude: 0.08 },
  confirm: { duration: 48, weakMagnitude: 0.32, strongMagnitude: 0.22 },
};

let lastPulseAt = -Infinity;
/** Intervalle mini entre pulses — bande ~80–120 ms. */
export const MIN_HAPTIC_GAP_MS = 100;

/**
 * @param {Gamepad | null | undefined} pad
 * @returns {GamepadHapticActuator | null}
 */
function getActuator(pad) {
  if (!pad) return null;
  // Spec récente
  if (pad.vibrationActuator && typeof pad.vibrationActuator.playEffect === 'function') {
    return pad.vibrationActuator;
  }
  // Ancien / multi-actuators
  const list = pad.hapticActuators;
  if (list && list.length) {
    const first = list[0];
    if (first && typeof first.playEffect === 'function') return first;
    if (first && typeof first.pulse === 'function') return first;
  }
  return null;
}

/**
 * @param {Gamepad | null | undefined} pad
 * @param {HapticKind} [kind]
 * @param {{ enabled?: boolean, minGapMs?: number }} [opts]
 * @returns {Promise<boolean>} true si un pulse a été tenté
 */
export async function pulseHaptic(pad, kind = 'light', opts = {}) {
  if (opts.enabled === false) return false;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const gap = opts.minGapMs ?? MIN_HAPTIC_GAP_MS;
  if (now - lastPulseAt < gap) return false;

  const actuator = getActuator(pad);
  if (!actuator) return false;

  const pattern = PATTERNS[kind] || PATTERNS.light;
  lastPulseAt = now;

  try {
    if (typeof actuator.playEffect === 'function') {
      await actuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: pattern.duration,
        weakMagnitude: pattern.weakMagnitude,
        strongMagnitude: pattern.strongMagnitude,
      });
      return true;
    }
    if (typeof actuator.pulse === 'function') {
      await actuator.pulse(pattern.strongMagnitude, pattern.duration);
      return true;
    }
  } catch {
    // Pas de support / permission / matériel — silencieux
  }
  return false;
}

/**
 * Indique si le pad courant expose une API haptique.
 * @param {Gamepad | null | undefined} pad
 */
export function hasHaptics(pad) {
  return Boolean(getActuator(pad));
}

/**
 * Reset throttle (tests).
 */
export function resetHapticThrottle() {
  lastPulseAt = -Infinity;
}
