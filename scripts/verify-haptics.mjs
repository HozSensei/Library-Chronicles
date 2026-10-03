#!/usr/bin/env node
/**
 * Tests haptics — no-op sans actuator, pulse avec mock, throttle stick-spam.
 */
import assert from 'assert';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const modUrl = pathToFileURL(
  path.join(root, 'src/renderer/src/composables/useHaptics.js'),
).href;

const {
  pulseHaptic,
  hasHaptics,
  resetHapticThrottle,
  MIN_HAPTIC_GAP_MS,
} = await import(modUrl);

assert.ok(
  MIN_HAPTIC_GAP_MS >= 80 && MIN_HAPTIC_GAP_MS <= 120,
  `MIN_HAPTIC_GAP_MS dans 80–120 (reçu ${MIN_HAPTIC_GAP_MS})`,
);

resetHapticThrottle();
assert.strictEqual(hasHaptics(null), false);
assert.strictEqual(await pulseHaptic(null, 'light'), false);
assert.strictEqual(await pulseHaptic({}, 'light', { enabled: false }), false);

let playCalls = 0;
const pad = {
  vibrationActuator: {
    async playEffect(type, params) {
      playCalls += 1;
      assert.strictEqual(type, 'dual-rumble');
      assert.ok(params.duration > 0);
      assert.ok(params.weakMagnitude >= 0);
    },
  },
};

assert.strictEqual(hasHaptics(pad), true);
resetHapticThrottle();
assert.strictEqual(await pulseHaptic(pad, 'confirm', { enabled: true }), true);
assert.strictEqual(playCalls, 1);

// Throttle : second pulse immédiat ignoré
assert.strictEqual(await pulseHaptic(pad, 'light', { enabled: true }), false);
assert.strictEqual(playCalls, 1);

// Actuator pulse() legacy
resetHapticThrottle();
let pulseLegacy = 0;
const pad2 = {
  hapticActuators: [
    {
      async pulse(mag, dur) {
        pulseLegacy += 1;
        assert.ok(mag > 0);
        assert.ok(dur > 0);
      },
    },
  ],
};
assert.strictEqual(hasHaptics(pad2), true);
assert.strictEqual(await pulseHaptic(pad2, 'nav'), true);
assert.strictEqual(pulseLegacy, 1);

// minGapMs custom (tests / overrides)
resetHapticThrottle();
playCalls = 0;
assert.strictEqual(
  await pulseHaptic(pad, 'nav', { enabled: true, minGapMs: 50 }),
  true,
);
assert.strictEqual(
  await pulseHaptic(pad, 'nav', { enabled: true, minGapMs: 50 }),
  false,
);
assert.strictEqual(playCalls, 1);

console.info('OK  haptics no-op / dual-rumble / pulse legacy / throttle 80–120');
console.info('Tous les tests haptics sont passés.');
