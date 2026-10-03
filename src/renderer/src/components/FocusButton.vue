<script setup>
defineProps({
  focused: { type: Boolean, default: false },
  subtitle: { type: String, default: '' },
});

defineEmits(['select']);
</script>

<template>
  <button
    type="button"
    class="focus-btn"
    :class="{ 'is-focused': focused }"
    @click="$emit('select')"
  >
    <span class="focus-btn__label">
      <slot />
    </span>
    <span v-if="subtitle" class="focus-btn__sub">{{ subtitle }}</span>
    <span class="focus-btn__chev" aria-hidden="true">›</span>
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
</style>
