<script setup>
defineProps({
  focused: { type: Boolean, default: false },
  subtitle: { type: String, default: '' },
  /** Bouton normal (setup / choix) — pas full-bleed menu. */
  compact: { type: Boolean, default: false },
  /** Accent CTA (Continuer / Terminer) avec aplat brass. */
  tone: {
    type: String,
    default: 'default',
    validator: (v) => v === 'default' || v === 'primary',
  },
});

defineEmits(['select']);
</script>

<template>
  <button
    type="button"
    class="focus-btn"
    :class="{
      'is-focused': focused,
      'focus-btn--compact': compact,
      'focus-btn--primary': tone === 'primary',
    }"
    @click="$emit('select')"
  >
    <span class="focus-btn__label">
      <slot />
    </span>
    <span v-if="subtitle" class="focus-btn__sub">{{ subtitle }}</span>
    <span v-if="!compact" class="focus-btn__chev" aria-hidden="true">›</span>
  </button>
</template>

<style scoped>
.focus-btn {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: auto auto;
  column-gap: 0.75rem;
  align-items: center;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 1rem 1.2rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--surface-strong), var(--surface));
  text-align: left;
  cursor: pointer;
  transition:
    border-color 160ms var(--ease-soft),
    box-shadow 160ms var(--ease-soft),
    transform 160ms var(--ease-soft),
    background 160ms var(--ease-soft);
}

.focus-btn__label {
  grid-column: 1;
  grid-row: 1;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.01em;
  min-width: 0;
  overflow-wrap: anywhere;
}

.focus-btn__sub {
  grid-column: 1;
  grid-row: 2;
  margin-top: 0.2rem;
  color: var(--paper-dim);
  font-size: 0.85rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.focus-btn__chev {
  grid-column: 2;
  grid-row: 1 / span 2;
  font-size: 1.5rem;
  color: var(--brass);
  opacity: 0.55;
  transition: opacity 160ms var(--ease-soft), transform 160ms var(--ease-soft);
}

.focus-btn.is-focused,
.focus-btn:focus-visible {
  outline: none;
  border-color: var(--brass-bright);
  box-shadow:
    0 0 0 3px var(--focus-glow),
    0 10px 28px rgba(0, 0, 0, 0.35);
  transform: translate3d(3px, 0, 0) scale(1.01);
  background: var(--surface-strong);
}

.focus-btn.is-focused .focus-btn__chev {
  opacity: 1;
  transform: translate3d(3px, 0, 0);
}

/* Variante compacte : bouton normal (setup / prefs), pas full-bleed. */
.focus-btn--compact {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  width: auto;
  max-width: 100%;
  min-height: 2.5rem;
  padding: 0.5rem 1rem;
  background: var(--surface);
  box-shadow: none;
}

.focus-btn--compact .focus-btn__label {
  font-size: 0.95rem;
  font-weight: 700;
}

.focus-btn--compact .focus-btn__sub {
  margin-top: 0.1rem;
  font-size: 0.75rem;
}

.focus-btn--compact.is-focused,
.focus-btn--compact:focus-visible {
  box-shadow: 0 0 0 3px var(--focus-glow);
  transform: translate3d(0, -1px, 0);
}

.focus-btn--primary {
  border-color: var(--brass);
  background: color-mix(in srgb, var(--brass) 18%, var(--surface));
  color: var(--paper);
}

.focus-btn--primary.is-focused,
.focus-btn--primary:focus-visible {
  border-color: var(--brass-bright);
  background: color-mix(in srgb, var(--brass) 28%, var(--surface));
}

/* Disabled : gris neutre (jamais accent brass/bleu). */
.focus-btn:disabled,
.focus-btn:disabled.is-focused,
.focus-btn:disabled:focus-visible {
  cursor: not-allowed;
  transform: none;
  border-color: var(--border);
  background: color-mix(in srgb, var(--paper-dim) 14%, var(--surface));
  color: var(--paper-dim);
  box-shadow: none;
  opacity: 1;
}

.focus-btn:disabled .focus-btn__label,
.focus-btn:disabled .focus-btn__sub {
  color: var(--paper-dim);
}

.focus-btn:disabled .focus-btn__chev {
  color: var(--paper-dim);
  opacity: 0.4;
  transform: none;
}

.focus-btn--primary:disabled,
.focus-btn--primary:disabled.is-focused,
.focus-btn--primary:disabled:focus-visible {
  border-color: var(--border);
  background: color-mix(in srgb, var(--paper-dim) 14%, var(--surface));
  color: var(--paper-dim);
}
</style>
