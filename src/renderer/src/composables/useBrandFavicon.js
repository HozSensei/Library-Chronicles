import { watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useProfilesStore } from '../stores/profiles';
import { normalizeAvatarColor } from '../../../shared/avatar-colors.js';
import glyphUrl from '../assets/library-chronicles-mark-glyph.png';

const SIZE = 64;
const PLATE = '#0a0a0a';

/** @type {HTMLLinkElement | null} */
let linkEl = null;
/** @type {HTMLImageElement | null} */
let glyphImg = null;
/** @type {Promise<HTMLImageElement> | null} */
let glyphReady = null;

function ensureLink() {
  if (linkEl && linkEl.isConnected) return linkEl;
  linkEl =
    document.querySelector("link[rel='icon'][data-lc-brand='1']") ||
    document.createElement('link');
  linkEl.rel = 'icon';
  linkEl.type = 'image/png';
  linkEl.dataset.lcBrand = '1';
  if (!linkEl.parentNode) document.head.appendChild(linkEl);
  return linkEl;
}

function loadGlyph() {
  if (glyphImg?.complete) return Promise.resolve(glyphImg);
  if (glyphReady) return glyphReady;
  glyphReady = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      glyphImg = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = glyphUrl;
  });
  return glyphReady;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Peint le favicon : squircle noir + « C » teinté (couleur profil).
 * @param {string} color
 */
export async function paintBrandFavicon(color) {
  const fill = normalizeAvatarColor(color);
  const img = await loadGlyph();
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  roundRect(ctx, 0, 0, SIZE, SIZE, SIZE * 0.22);
  ctx.fillStyle = PLATE;
  ctx.fill();

  const layer = document.createElement('canvas');
  layer.width = SIZE;
  layer.height = SIZE;
  const g = layer.getContext('2d');
  if (!g) return;
  g.drawImage(img, 0, 0, SIZE, SIZE);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = fill;
  g.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(layer, 0, 0);

  const link = ensureLink();
  link.href = canvas.toDataURL('image/png');
}

/**
 * Suit `activeProfile.color` (sinon laiton) pour le favicon renderer.
 */
export function useBrandFavicon() {
  const profiles = useProfilesStore();
  const { activeProfile } = storeToRefs(profiles);

  watch(
    () => activeProfile.value?.color,
    (color) => {
      paintBrandFavicon(color || '#c4a35a').catch(() => {
        /* ignore decode errors */
      });
    },
    { immediate: true },
  );
}
