<script setup>
import { storeToRefs } from 'pinia';
import { useToastStore } from '../stores/toast';
import { useUiStore } from '../stores/ui';

const toast = useToastStore();
const ui = useUiStore();
const { items } = storeToRefs(toast);
</script>

<template>
  <div
    class="app-toast"
    :class="{ 'app-toast--static': ui.reducedMotion }"
    aria-live="polite"
    aria-atomic="true"
    role="status"
  >
    <TransitionGroup :name="ui.reducedMotion ? '' : 'toast'">
      <div
        v-for="item in items"
        :key="item.id"
        class="app-toast__item"
        :data-type="item.type"
      >
        <span class="app-toast__dot" aria-hidden="true" />
        <span class="app-toast__msg">{{ item.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.app-toast {
  position: absolute;
  left: 50%;
  bottom: 1.1rem;
  transform: translateX(-50%);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  width: min(28rem, calc(100% - 2rem));
  pointer-events: none;
  box-sizing: border-box;
}

.app-toast__item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  max-width: 100%;
  padding: 0.65rem 0.9rem;
  background: color-mix(in srgb, var(--surface-strong) 94%, transparent);
  border: 1px solid color-mix(in srgb, var(--brass) 32%, var(--border));
  border-radius: var(--radius-sm);
  color: var(--paper);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--ink-950) 35%, transparent);
  box-sizing: border-box;
}

.app-toast__dot {
  flex-shrink: 0;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--brass-bright);
}

.app-toast__item[data-type='success'] .app-toast__dot {
  background: var(--success);
}

.app-toast__item[data-type='error'] .app-toast__dot {
  background: var(--danger);
}

.app-toast__item[data-type='info'] .app-toast__dot {
  background: var(--brass-bright);
}

.app-toast__msg {
  min-width: 0;
  font-family: var(--font-body);
  font-size: 0.9rem;
  line-height: 1.3;
  font-weight: 550;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 180ms var(--ease-out),
    transform 180ms var(--ease-out);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(0.4rem);
}

.app-toast--static .toast-enter-active,
.app-toast--static .toast-leave-active {
  transition: none;
}
</style>
