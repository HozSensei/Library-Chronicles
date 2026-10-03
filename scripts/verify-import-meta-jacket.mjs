/**
 * Garde-fous : coverUrl persisté à l’import + fiche livre éditable + proxy CSP.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  META_SOURCE,
  normalizeImportMetadata,
  resolveItemMetadata,
} from '../src/shared/import-meta.js';
import {
  BOOK_FOCUS,
  isBookEditableFocus,
  resolveBookConfirmAction,
  bookFieldDomId,
} from '../src/shared/book-focus.js';
import { isTextInputElement } from '../src/shared/text-input-focus.js';
import {
  bufferToDataUrl,
  normalizeRemoteCoverUrl,
} from '../src/shared/cover-url.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else {
    console.log('OK  ', msg);
  }
}

// --- coverUrl préservé dans la chaîne méta ---
const apiMeta = normalizeImportMetadata({
  title: 'One Piece',
  series: 'One Piece',
  volume: 1,
  author: 'Eiichiro Oda',
  year: 1997,
  description: 'Pirates',
  coverUrl: 'https://example.com/jacket.jpg',
  source: 'anilist',
});
assert(apiMeta.coverUrl === 'https://example.com/jacket.jpg', 'normalize garde coverUrl');
assert(apiMeta.source === 'anilist', 'normalize garde source');
assert(apiMeta.provider === 'anilist', 'normalize provider = source');

const resolved = resolveItemMetadata({
  name: 'op.cbz',
  selectedMeta: apiMeta,
  detected: { title: 'file' },
});
assert(
  resolved.coverUrl === 'https://example.com/jacket.jpg',
  'resolveItemMetadata propage coverUrl',
);
assert(
  resolveItemMetadata(
    { name: 'op.cbz', selectedMeta: apiMeta },
    {
      draft: { title: 'Draft', coverUrl: 'https://example.com/draft.jpg' },
      preferDraft: true,
    },
  ).coverUrl === 'https://example.com/draft.jpg',
  'preferDraft propage coverUrl draft',
);

assert(META_SOURCE.SELECTED === 'selected', 'META_SOURCE.selected');

// --- normalisation URL jacket ---
assert(
  normalizeRemoteCoverUrl('http://covers.example/a.jpg') ===
    'https://covers.example/a.jpg',
  'http → https',
);
assert(
  normalizeRemoteCoverUrl('https://cdn.example/b.jpg') ===
    'https://cdn.example/b.jpg',
  'https inchangé',
);
assert(normalizeRemoteCoverUrl('ftp://x') === '', 'ftp rejeté');
assert(normalizeRemoteCoverUrl('') === '', 'vide → vide');

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]);
const dataUrl = bufferToDataUrl(jpeg);
assert(dataUrl?.startsWith('data:image/jpeg;base64,'), 'bufferToDataUrl jpeg');

// --- édition fiche ---
assert(isBookEditableFocus(BOOK_FOCUS.TITLE), 'titre éditable');
assert(isBookEditableFocus(BOOK_FOCUS.SYNOPSIS), 'synopsis éditable');
assert(!isBookEditableFocus(BOOK_FOCUS.STATUS), 'statut non éditable');
assert(!isBookEditableFocus(BOOK_FOCUS.PAGES), 'pages non éditables');
assert(!isBookEditableFocus(BOOK_FOCUS.PROVIDER), 'provider non éditable');
assert(
  resolveBookConfirmAction(BOOK_FOCUS.TITLE) === 'edit-field',
  'A sur titre → edit-field',
);
assert(
  resolveBookConfirmAction(BOOK_FOCUS.READ) === 'activate-action',
  'A sur Lire → activate-action',
);
assert(
  resolveBookConfirmAction(BOOK_FOCUS.STATUS) === 'noop',
  'A sur statut → noop',
);
assert(bookFieldDomId(BOOK_FOCUS.AUTHOR) === 'author', 'dom id author');

// readonly ≠ champ texte éditable (clavier virtuel / confirm)
function fakeEl(tag, props = {}) {
  return {
    tagName: tag.toUpperCase(),
    disabled: Boolean(props.disabled),
    readOnly: Boolean(props.readOnly),
    isContentEditable: false,
    getAttribute(name) {
      if (name === 'type') return props.type || 'text';
      return null;
    },
  };
}
assert(isTextInputElement(fakeEl('input', { type: 'text' })), 'input éditable');
assert(
  !isTextInputElement(fakeEl('input', { type: 'text', readOnly: true })),
  'input readonly ≠ texte éditable',
);
assert(
  !isTextInputElement(fakeEl('textarea', { readOnly: true })),
  'textarea readonly ≠ texte éditable',
);

// --- sources : commit jacket + store + fiche + CSP proxy ---
const importMain = readFileSync(
  join(root, 'src/main/library/import.js'),
  'utf8',
);
const thumbs = readFileSync(
  join(root, 'src/main/library/thumbnails.js'),
  'utf8',
);
const fetchSrc = readFileSync(
  join(root, 'src/main/metadata/fetch.js'),
  'utf8',
);
const importStore = readFileSync(
  join(root, 'src/renderer/src/stores/import.js'),
  'utf8',
);
const libraryStore = readFileSync(
  join(root, 'src/renderer/src/stores/library.js'),
  'utf8',
);
const bookView = readFileSync(
  join(root, 'src/renderer/src/views/BookDetailView.vue'),
  'utf8',
);
const gamepad = readFileSync(
  join(root, 'src/renderer/src/composables/useGamepad.js'),
  'utf8',
);
const ipcImport = readFileSync(
  join(root, 'src/main/ipc/import.js'),
  'utf8',
);
const preload = readFileSync(join(root, 'src/preload/index.js'), 'utf8');
const csp = readFileSync(join(root, 'src/renderer/index.html'), 'utf8');

assert(importMain.includes('ensureCoverFromUrl'), 'commitImport appelle ensureCoverFromUrl');
assert(importMain.includes('remoteCoverUrl'), 'commitImport lit coverUrl méta');
assert(importMain.includes('previewCoverFromUrl'), 'previewCoverFromUrl exporté');
assert(importMain.includes('findBookForImportSource'), 'scan déjà-importé persistant');
assert(thumbs.includes('export async function ensureCoverFromUrl'), 'ensureCoverFromUrl exporté');
assert(thumbs.includes('force: true'), 'jacket force overwrite cache');
assert(thumbs.includes('normalizeRemoteCoverUrl'), 'normalizeRemoteCoverUrl');
assert(thumbs.includes('bufferToDataUrl'), 'bufferToDataUrl');
assert(fetchSrc.includes('export async function fetchBuffer'), 'fetchBuffer dispo');
assert(importStore.includes('coverUrl'), 'store import draft coverUrl');
assert(importStore.includes('resolveCoverPreview'), 'store resolveCoverPreview');
assert(importStore.includes('previewCoverFromUrl'), 'store appelle previewCoverFromUrl');
assert(libraryStore.includes('async updateBook'), 'library.updateBook action');
assert(bookView.includes('v-model="draft.title"'), 'fiche titre éditable');
assert(bookView.includes('v-model="draft.series"'), 'fiche série éditable');
assert(bookView.includes('saveDraft'), 'fiche saveDraft');
assert(bookView.includes('activateEditableField'), 'fiche activate éditable');
assert(
  !/id="book-field-title"[\s\S]{0,200}readonly/.test(bookView),
  'titre sans readonly',
);
assert(
  /id="book-field-status"[\s\S]{0,120}readonly/.test(bookView),
  'statut reste readonly',
);
assert(gamepad.includes('resolveBookConfirmAction'), 'gamepad resolve book confirm');
assert(gamepad.includes('focusTextInputForEdit'), 'gamepad ouvre clavier fiche');
assert(gamepad.includes('edit-field'), 'gamepad intent edit-field');
assert(
  ipcImport.includes('IMPORT_PREVIEW_COVER_URL'),
  'IPC preview cover URL',
);
assert(preload.includes('previewCoverFromUrl'), 'preload previewCoverFromUrl');
assert(
  /img-src[^;]*data:/.test(csp),
  'CSP autorise data: images (proxy jackets)',
);
assert(
  !/img-src[^;]*https:/.test(csp),
  'CSP n’autorise pas https img (proxy obligatoire)',
);

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nimport-meta-jacket OK');
