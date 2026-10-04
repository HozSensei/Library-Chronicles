<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ReaderHud from '../components/ReaderHud.vue';
import { useReaderStore } from '../stores/reader';
import { useUiStore } from '../stores/ui';

const router = useRouter();
const route = useRoute();
const reader = useReaderStore();
const ui = useUiStore();
const stripEl = ref(null);
const planeEl = ref(null);

const stripStyle = computed(() => ({
  filter: reader.filterCss,
  transform: `translate3d(${reader.panX}px, ${reader.panY}px, 0) scale(${reader.scale})`,
  transformOrigin: 'center top',
}));

/**
 * Ouverture fichier uniquement.
 * Le resize / setSessionMode est géré UNE FOIS par App.vue (watch route → reader).
 */
onMounted(async () => {
  const filePath = route.query.path;
  try {
    if (filePath) {
      await reader.open(String(filePath));
      return;
    }
    const config = await window.vdr.getConfig();
    if (config.phase1TestCbz) {
      await reader.open(config.phase1TestCbz);
    } else if (config.lastOpenedPath) {
      await reader.open(config.lastOpenedPath);
    }
  } catch (err) {
    console.warn('[VDR] open:', err.message);
  }
});

onUnmounted(() => {
  reader.close();
  // Pas d’exitReaderMode ici — App.vue watch (reader → autre) le fait une seule fois.
});

watch(
  () => route.query.path,
  async (path) => {
    if (path) await reader.open(String(path));
  },
);

/** Nav programmatique uniquement — ne pas combattre le scroll utilisateur. */
watch(
  () => reader.stripScrollToken,
  async () => {
    if (!reader.isStripMode) return;
    await nextTick();
    const el = stripEl.value?.querySelector(`[data-page="${reader.pageIndex}"]`);
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  },
);

async function leave() {
  await reader.close();
  router.push({ name: 'library' });
}

async function openAdjacent(delta) {
  const ok =
    delta < 0 ? await reader.openPrevVolume() : await reader.openNextVolume();
  if (!ok) return;
  router.replace({ name: 'reader', query: { path: reader.filePath } });
}

function endFocusId(id) {
  const ids = [];
  if (reader.prevVolumeOffer) ids.push('prev-volume');
  if (reader.nextVolumeOffer) ids.push('next-volume');
  return ids[reader.endFocusIndex] === id;
}

async function onStripScroll() {
  if (!stripEl.value || !reader.isStripMode) return;
  const el = stripEl.value;
  const nodes = [...el.querySelectorAll('[data-page]')];
  if (!nodes.length) return;
  const top = el.scrollTop + 40;
  let best = reader.pageIndex;
  for (const node of nodes) {
    if (node.offsetTop <= top) best = Number(node.dataset.page);
  }
  if (best === reader.pageIndex) return;
  const marker = el.querySelector(`[data-page="${best}"]`);
  const offsetBefore = marker?.offsetTop ?? 0;
  const scrollBefore = el.scrollTop;
  await reader.setPageFromStripScroll(best);
  await nextTick();
  const after = el.querySelector(`[data-page="${best}"]`);
  if (!after) return;
  const delta = after.offsetTop - offsetBefore;
  if (Math.abs(delta) > 0.5) el.scrollTop = scrollBefore + delta;
}
</script>

<template>
  <section
    class="reader"
    aria-label="Lecteur"
    :data-strip="reader.isStripMode ? '1' : '0'"
    :data-reading-mode="reader.readingMode"
    :data-css-rotate="ui.readerCssRotate ? '1' : '0'"
  >
    <!--
      Plan lecteur : en css-rotate (stratégie B, fenêtre landscape),
      dimensions portrait (100vh × 100vw) puis rotate(+90° CW) pour Ally
      tenue CCW (D-Pad en bas). Inclut HUD pour rester dans le même repère.
    -->
    <div ref="planeEl" class="reader__plane">
      <div class="reader__viewport">
        <!-- Mode strip vertical (défaut) -->
        <div
          v-if="reader.isStripMode && reader.pageCount > 0"
          ref="stripEl"
          class="reader__strip"
          @scroll.passive="onStripScroll"
        >
          <div class="reader__strip-inner" :style="stripStyle">
            <img
              v-for="page in reader.stripPages"
              :key="page.index"
              class="reader__strip-page"
              :class="{ 'is-current': page.index === reader.pageIndex }"
              :src="page.url"
              :data-page="page.index"
              :alt="`Page ${page.index + 1}`"
              draggable="false"
            />
          </div>
        </div>

        <!-- Mode page par page -->
        <div
          v-else-if="reader.isPageMode && reader.pageCount > 0"
          class="reader__stage"
          :data-fit="reader.fitMode"
        >
          <div
            v-if="reader.pageUrl"
            class="reader__pan"
            :style="{ transform: `translate3d(${reader.panX}px, ${reader.panY}px, 0)` }"
          >
            <img
              class="reader__page"
              :class="{ 'is-zoom-smooth': reader.zoomTransition }"
              :src="reader.pageUrl"
              alt="Page courante"
              draggable="false"
              :style="reader.imageStyle"
            />
          </div>
          <div v-else class="reader__placeholder">
            <p class="reader__brand">Library Chronicles</p>
            <p v-if="reader.loading">Chargement…</p>
            <p v-else-if="reader.error">{{ reader.error }}</p>
            <template v-else>
              <p>Aucun livre chargé</p>
              <p class="dim">Ouvre un tome depuis la bibliothèque ou l’import.</p>
            </template>
            <button type="button" class="ghost" @click="leave">Retour</button>
          </div>
        </div>

        <div v-else class="reader__placeholder">
          <p class="reader__brand">Library Chronicles</p>
          <p v-if="reader.loading">Chargement…</p>
          <p v-else-if="reader.error">{{ reader.error }}</p>
          <template v-else>
            <p>Aucun livre chargé</p>
            <p class="dim">Ouvre un tome depuis la bibliothèque ou l’import.</p>
          </template>
          <button type="button" class="ghost" @click="leave">Retour</button>
        </div>
      </div>

      <div
        v-if="reader.showEndSeriesNav && !reader.hudVisible"
        class="reader__next"
        role="dialog"
        aria-label="Fin de tome — navigation série"
      >
        <p class="reader__next-label">Tome terminé</p>
        <p v-if="reader.series" class="reader__next-series">
          {{ reader.series }}
          <template v-if="reader.volume != null"> · T{{ reader.volume }}</template>
        </p>
        <div class="reader__next-actions">
          <button
            v-if="reader.prevVolumeOffer"
            type="button"
            class="ghost"
            data-end-focus
            :class="{ 'is-focused': endFocusId('prev-volume') }"
            @click="openAdjacent(-1)"
          >
            Tome précédent
            <span class="reader__next-title">{{ reader.prevVolumeOffer.title }}</span>
          </button>
          <button
            v-if="reader.nextVolumeOffer"
            type="button"
            class="btn-primary"
            data-end-focus
            :class="{ 'is-focused': endFocusId('next-volume') }"
            @click="openAdjacent(1)"
          >
            Tome suivant
            <span class="reader__next-title">{{ reader.nextVolumeOffer.title }}</span>
          </button>
        </div>
        <p class="reader__next-hint">A ouvrir · ↑↓ focus · Select pause · B quitter</p>
      </div>

      <ReaderHud />
    </div>
  </section>
</template>

<style scoped>
.reader {
  position: relative;
  height: 100%;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  overflow-x: hidden;
  background: var(--reader-bg);
}

/* Plan plein cadre (fenêtre déjà portrait rare / tests). */
.reader__plane {
  position: absolute;
  inset: 0;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}

/*
 * Stratégie B — fenêtre landscape fixe :
 * plan local portrait (largeur = hauteur fenêtre, hauteur = largeur fenêtre),
 * puis +90° CW pour lecture Ally CCW (D-Pad en bas).
 * Après rotation le plan remplit exactement le viewport landscape.
 */
.reader[data-css-rotate='1'] .reader__plane {
  inset: auto;
  top: 50%;
  left: 50%;
  width: 100vh;
  height: 100vw;
  max-width: none;
  max-height: none;
  transform: translate(-50%, -50%) rotate(90deg);
  transform-origin: center center;
}

.reader__viewport {
  position: absolute;
  inset: 0;
  overflow: hidden;
  overscroll-behavior: none;
  min-width: 0;
  min-height: 0;
  touch-action: none;
}

.reader__stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  overscroll-behavior: none;
  touch-action: none;
  display: grid;
  /* unsafe : garder le vrai centre même si la page overflow (fit-width/height). */
  place-items: unsafe center;
}

/* Pan en translate local — indépendant du scale (origin centre image). */
.reader__pan {
  line-height: 0;
  will-change: transform;
  max-width: none;
  max-height: none;
}

.reader__page {
  /* Zoom D-Pad : scale ancré au centre image (= centre écran si pan=0). */
  display: block;
  transform-origin: center center;
  will-change: transform, filter;
  user-select: none;
  pointer-events: none;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

/* L3 fit toggle : transition width/height (le scale D-Pad est lerp rAF). */
.reader__page.is-zoom-smooth {
  transition:
    width 200ms ease-out,
    height 200ms ease-out,
    max-width 200ms ease-out,
    max-height 200ms ease-out;
}

/*
 * Fit modes dans le plan local (avant / sous rotate(+90°) CSS).
 * Fit Width  → width: 100%  (bord à bord gauche-droite).
 * Fit Height → height: 100%.
 */
.reader__stage[data-fit='fit-height'] .reader__page {
  height: 100%;
  width: auto;
  max-width: none;
  object-fit: unset;
}

.reader__stage[data-fit='fit-width'] .reader__page {
  width: 100%;
  height: auto;
  max-height: none;
  object-fit: unset;
}

/*
 * custom / zoom-100 : même gabarit que fit-height (base 1×).
 * Le zoom manuel ne doit PAS basculer en taille naturelle (saut vertical).
 */
.reader__stage[data-fit='zoom-100'] .reader__page,
.reader__stage[data-fit='custom'] .reader__page {
  height: 100%;
  width: auto;
  max-width: none;
  max-height: none;
  object-fit: unset;
}

.reader__strip {
  position: absolute;
  inset: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.reader__strip-inner {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  will-change: transform, filter;
  min-height: 100%;
}

/* Fit width implicite : pages bord à bord sur la largeur locale. */
.reader__strip-page {
  width: 100%;
  height: auto;
  display: block;
  user-select: none;
  pointer-events: none;
}

.reader__placeholder {
  display: grid;
  place-items: center;
  gap: 0.4rem;
  text-align: center;
  color: var(--paper);
  padding: 2rem;
  min-width: 0;
  height: 100%;
}

.reader__brand {
  margin: 0 0 0.5rem;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.4rem;
  color: var(--brass-bright);
}

.reader__next {
  position: absolute;
  left: 1rem;
  right: 1rem;
  top: 1.25rem;
  z-index: calc(var(--z-hud) + 1);
  display: grid;
  gap: 0.45rem;
  padding: 0.95rem 1rem;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  color: var(--paper);
  border: 1px solid color-mix(in srgb, var(--brass) 45%, transparent);
  min-width: 0;
  max-width: min(26rem, calc(100% - 2rem));
  margin-inline: auto;
  box-sizing: border-box;
}

.reader__next-label,
.reader__next-series,
.reader__next-hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--paper-dim);
  overflow-wrap: anywhere;
}

.reader__next-label {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--paper);
  font-size: 0.95rem;
}

.reader__next-actions {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}

.reader__next-actions > * {
  display: grid;
  gap: 0.15rem;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  text-align: center;
}

.reader__next-actions .is-focused {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-glow);
  border-color: var(--brass-bright);
}

.reader__next-title {
  display: block;
  font-size: 0.72rem;
  color: var(--paper-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reader__next-hint {
  text-align: center;
  letter-spacing: 0.02em;
  font-size: 0.72rem;
}

.dim {
  color: var(--paper-dim);
  margin: 0;
}
</style>
