<script setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import FocusButton from '../components/FocusButton.vue';
import GamepadBadge from '../components/GamepadBadge.vue';
import ControlHint from '../components/ControlHint.vue';
import { useUiStore } from '../stores/ui';
import { useLibraryStore } from '../stores/library';

const router = useRouter();
const ui = useUiStore();
const library = useLibraryStore();

const actions = computed(() => {
  const list = [
    {
      id: 'library',
      label: 'Bibliothèque',
      subtitle: 'Parcourir tes tomes',
      to: 'library',
    },
    {
      id: 'import',
      label: 'Import',
      subtitle: 'Scanner le dossier import',
      to: 'import',
    },
    {
      id: 'settings',
      label: 'Paramètres',
      subtitle: 'Thème · manette · API',
      to: 'settings',
    },
  ];
  if (library.continueBook) {
    list.unshift({
      id: 'continue',
      label: 'Continuer',
      subtitle: library.continueBook.title,
      to: 'reader',
      filePath: library.continueBook.filePath,
    });
  }
  return list;
});

const hints = [
  { key: '↑↓', label: 'naviguer' },
  { key: 'A', label: 'valider' },
];

const focusedIndex = computed(() =>
  Math.min(ui.bootFocusIndex, Math.max(0, actions.value.length - 1)),
);

onMounted(async () => {
  await library.refresh();
  ui.setBootFocus(0);
});

function select(index) {
  ui.setBootFocus(index);
  const action = actions.value[index];
  if (!action) return;
  if (action.filePath) {
    router.push({ name: 'reader', query: { path: action.filePath } });
    return;
  }
  router.push({ name: action.to });
}
</script>

<template>
  <section class="boot" aria-label="Accueil Vertical Deck Reader">
    <div class="boot__atmosphere" aria-hidden="true">
      <div class="boot__wash" />
      <div class="boot__grain" />
      <div class="boot__spine" />
    </div>

    <header class="boot__brand">
      <p class="boot__mark">Vertical Deck Reader</p>
      <h1 class="boot__headline">La planche, à la verticale.</h1>
      <p class="boot__lead">
        Lecture BD & manga pensée manette — portrait natif sur ROG Ally X.
      </p>
    </header>

    <div class="boot__meta">
      <GamepadBadge />
    </div>

    <nav class="boot__nav" aria-label="Menu principal">
      <FocusButton
        v-for="(action, index) in actions"
        :key="action.id"
        :focused="focusedIndex === index"
        :subtitle="action.subtitle"
        @select="select(index)"
      >
        {{ action.label }}
      </FocusButton>
    </nav>

    <footer class="boot__footer">
      <ControlHint :items="hints" />
      <p class="boot__phase">Setup · Import · Lecture</p>
    </footer>
  </section>
</template>

<style scoped>
.boot {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--pad);
  overflow: hidden;
}

.boot__atmosphere {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.boot__wash {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 90% 55% at 50% -10%, var(--wash-a), transparent 60%),
    radial-gradient(ellipse 70% 45% at 80% 90%, var(--wash-b), transparent 55%),
    linear-gradient(165deg, var(--ink-900) 0%, var(--ink-950) 48%, var(--ink-900) 100%);
}

.boot__grain {
  position: absolute;
  inset: 0;
  opacity: 0.18;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}

.boot__spine {
  position: absolute;
  left: 0;
  top: 12%;
  bottom: 18%;
  width: 3px;
  background: linear-gradient(
    180deg,
    transparent,
    var(--brass) 20%,
    var(--brass-bright) 50%,
    var(--brass) 80%,
    transparent
  );
  opacity: 0.55;
  animation: spine-glow 3.2s var(--ease-soft) infinite;
}

.boot__brand,
.boot__meta,
.boot__nav,
.boot__footer {
  position: relative;
  z-index: 1;
}

.boot__brand {
  margin-top: min(10vh, 5.5rem);
  max-width: 22rem;
  animation: rise 700ms var(--ease-out) both;
}

.boot__mark {
  margin: 0 0 1.1rem;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(2.4rem, 8vw, 3.4rem);
  line-height: 0.95;
  letter-spacing: -0.03em;
  color: var(--paper);
}

.boot__headline {
  margin: 0;
  font-family: var(--font-body);
  font-weight: 500;
  font-size: clamp(1.15rem, 3.6vw, 1.35rem);
  color: var(--brass-bright);
  letter-spacing: 0.01em;
}

.boot__lead {
  margin: 0.85rem 0 0;
  color: var(--paper-dim);
  font-size: 1rem;
  line-height: 1.45;
  max-width: 20rem;
}

.boot__meta {
  margin-top: 1.5rem;
  animation: rise 700ms var(--ease-out) 80ms both;
}

.boot__nav {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: min(100%, 24rem);
  animation: rise 700ms var(--ease-out) 140ms both;
}

.boot__footer {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  animation: rise 700ms var(--ease-out) 200ms both;
}

.boot__phase {
  margin: 0;
  color: var(--paper-dim);
  opacity: 0.7;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translate3d(0, 18px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes spine-glow {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 0.75;
  }
}

@media (prefers-reduced-motion: reduce) {
  .boot__brand,
  .boot__meta,
  .boot__nav,
  .boot__footer,
  .boot__spine {
    animation: none;
  }
}
</style>
