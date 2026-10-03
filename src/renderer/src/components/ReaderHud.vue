<script setup>
import { useReaderStore } from '../stores/reader';

const reader = useReaderStore();
</script>

<template>
  <aside v-show="reader.hudVisible" class="hud" aria-label="Options de lecture">
    <div class="hud__bar">
      <span class="hud__title">{{ reader.title || '—' }}</span>
      <span class="hud__page">{{ reader.pageLabel }}</span>
    </div>
    <div class="hud__track" aria-hidden="true">
      <div class="hud__fill" :style="{ width: `${reader.progress}%` }" />
    </div>
    <div class="hud__meta">
      <span>Sens : {{ reader.direction.toUpperCase() }}</span>
      <span>Y masquer · B quitter</span>
    </div>
  </aside>
</template>

<style scoped>
.hud {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-hud);
  padding: 1.25rem 1.35rem 1.6rem;
  background: linear-gradient(transparent, rgba(11, 12, 15, 0.92) 40%);
  animation: hud-up 220ms var(--ease-out);
}

.hud__bar {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.55rem;
  font-size: 0.95rem;
}

.hud__title {
  font-family: var(--font-display);
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hud__track {
  height: 3px;
  border-radius: 999px;
  background: rgba(242, 235, 224, 0.12);
  overflow: hidden;
}

.hud__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brass-deep), var(--brass-bright));
  transition: width 160ms var(--ease-soft);
}

.hud__meta {
  display: flex;
  justify-content: space-between;
  margin-top: 0.7rem;
  color: var(--paper-dim);
  font-size: 0.78rem;
}

@keyframes hud-up {
  from {
    opacity: 0;
    transform: translate3d(0, 12px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}
</style>
