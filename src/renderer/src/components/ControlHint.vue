<script setup>
defineProps({
  items: {
    type: Array,
    default: () => [],
  },
});
</script>

<template>
  <ul class="hints" aria-label="Raccourcis manette">
    <li v-for="item in items" :key="item.key" class="hints__item">
      <kbd>{{ item.key }}</kbd>
      <span>{{ item.label }}</span>
    </li>
  </ul>
</template>

<style scoped>
.hints {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.65rem 1.1rem;
  color: var(--paper-dim);
  font-size: 0.8rem;
}

.hints__item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

kbd {
  display: inline-grid;
  place-items: center;
  min-width: 1.4rem;
  height: 1.4rem;
  padding: 0 0.35rem;
  border-radius: 5px;
  border: 1px solid rgba(212, 163, 92, 0.45);
  background: rgba(212, 163, 92, 0.12);
  color: var(--brass-bright);
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-weight: 700;
}
</style>
