/**
 * Profils : cercle avatar focus (pas de clip) + palette couleur persistée.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  AVATAR_COLORS,
  normalizeAvatarColor,
} from '../src/shared/avatar-colors.js';
import { ACCENTS } from '../src/shared/theme-accents.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else {
    console.log('OK  ', msg);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

// --- palette ---
assert(AVATAR_COLORS.length >= 6, 'au moins 6 couleurs avatar');
assert(
  AVATAR_COLORS.every((c) => /^#[0-9a-f]{6}$/i.test(c)),
  'couleurs hex',
);
assert(normalizeAvatarColor('#c4a35a') === '#c4a35a', 'normalize laiton');
assert(normalizeAvatarColor('STEAM') === AVATAR_COLORS[0], 'inconnu → défaut');
assert(
  normalizeAvatarColor('#ABCDEF') === '#abcdef',
  'hex legacy hors palette conservé',
);

const accentSwatches = ACCENTS.map((a) => a.swatch.toLowerCase());
assert(
  AVATAR_COLORS.every((c) => accentSwatches.includes(c.toLowerCase())),
  'palette avatar alignée sur swatches accent',
);

// --- ProfilesView CSS / UX ---
const view = read('src/renderer/src/views/ProfilesView.vue');

assert(view.includes('avatar__halo'), 'halo scale hors overflow');
assert(view.includes('profiles__colors'), 'rangée couleurs dans le formulaire');
assert(view.includes('profiles__locales'), 'rangée drapeaux dans le formulaire');
assert(
  /v-if="!isNaming"[\s\S]*?profiles__grid|profiles__grid[\s\S]*?v-if="!isNaming"/.test(
    view,
  ) || /v-if="!isNaming"\s*\n\s*class="profiles__grid"/.test(view),
  'grille pick masquée pendant naming (pas de + sous aperçu ?)',
);
assert(
  /class="profiles__create"[\s\S]*?profiles__colors/.test(view),
  'palette couleurs uniquement dans le formulaire create/edit',
);
assert(
  /class="profiles__create"[\s\S]*?profiles__locales/.test(view),
  'drapeaux uniquement dans le formulaire create/edit',
);
assert(view.includes('selectedColor'), 'état couleur sélectionnée');
assert(
  /color:\s*selectedColor\.value/.test(view) ||
    /color:\s*selectedColor/.test(view),
  'couleur persistée à la création/édition',
);
assert(
  /\.profiles__grid\s*\{[\s\S]*?overflow-x:\s*visible/.test(view),
  'grille overflow-x visible (pas de clip horizontal)',
);
assert(
  /\.profiles__grid\s*\{[\s\S]*?flex-wrap:\s*nowrap/.test(view),
  'grille en rangée horizontale (nowrap)',
);
assert(
  !/\.profiles__grid\s*\{[\s\S]*?overflow-y:\s*auto/.test(view),
  'grille sans overflow-y auto (pas de scroll parasite)',
);
assert(
  !/\.profiles__grid\s*\{[\s\S]*?max-height:/.test(view),
  'grille sans max-height forcé',
);
assert(
  /\.avatar__disk\s*\{[\s\S]*?border-radius:\s*50%/.test(view),
  'disque border-radius 50%',
);
assert(
  /\.avatar__disk\s*\{[\s\S]*?overflow:\s*hidden/.test(view),
  'disque overflow hidden (cercle net)',
);
assert(
  !/\.avatar\.is-focused\s*\{[^}]*scale\(/.test(view),
  'scale focus sur halo, pas sur le bouton entier',
);
assert(view.includes('vdr-profile-form-nav'), 'écoute nav manette formulaire');
assert(view.includes('cycleColor'), 'cycle couleur API');

// --- gamepad naming ---
const pad = read('src/renderer/src/composables/useGamepad.js');
assert(
  pad.includes('vdr-profile-form-nav'),
  'manette dispatch nav formulaire profil',
);
assert(pad.includes('profiles__colors'), 'manette gère focus palette');
assert(pad.includes('profiles__locales'), 'manette gère focus drapeaux');

// --- DB update color ---
const db = read('src/main/database/profiles.js');
assert(db.includes('normalizeAvatarColor'), 'normalize importé DB');
assert(
  /patch\.color !== undefined[\s\S]*normalizeAvatarColor/.test(db),
  'updateProfile normalise color',
);

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nprofile-avatar-color OK');
