<script setup>
import { useUiStore } from '../stores/ui';

const ui = useUiStore();
</script>

<template>
  <div class="pad-badge" :class="{ 'is-live': ui.gamepadConnected }" aria-live="polite">
    <span class="pad-badge__dot" aria-hidden="true" />
    <span class="pad-badge__text">{{ ui.gamepadLabel }}</span>
  </div>
</template>

<style scoped>
.pad-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  max-width: 100%;
  color: var(--paper-dim);
  font-size: 0.82rem;
  letter-spacing: 0.03em;
}

.pad-badge__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink-700);
  box-shadow: inset 0 0 0 1px rgba(242, 235, 224, 0.15);
  flex-shrink: 0;
}

.pad-badge.is-live .pad-badge__dot {
  background: var(--success);
  box-shadow: 0 0 10px rgba(124, 184, 154, 0.55);
  animation: pulse 1.8s var(--ease-soft) infinite;
}

.pad-badge__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pad-badge.is-live .pad-badge__dot {
    animation: none;
  }
}
</style>
