/**
 * Garde-fous : coverUrl persisté à l’import + fiche livre éditable + proxy CSP.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  META_SOURCE,
  metadataPatchFromEnrichResult,
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

// --- apply API : série API > title API ; jamais draft filename/folder ---
const fromApiNullSeries = metadataPatchFromEnrichResult(
  {
    title: 'Akira',
    series: null,
    volume: 6,
    author: 'Otomo',
    coverUrl: 'https://example.com/a.jpg',
    source: 'openlibrary',
  },
  { title: 'file-name', series: 'ParentFolder', volume: 1 },
);
assert(fromApiNullSeries.series === 'Akira', 'API sans series → title API');
assert(fromApiNullSeries.series !== 'ParentFolder', 'pas de fallback folder');
assert(fromApiNullSeries.volume === 1, 'volume fichier conservé');
assert(
  fromApiNullSeries.coverUrl === 'https://example.com/a.jpg',
  'coverUrl API dans patch',
);

const fromApiSeries = metadataPatchFromEnrichResult(
  { title: 'Tome title', series: 'One Piece', volume: 100, source: 'anilist' },
  { title: 'op-t03', series: 'op-t03', volume: 3 },
);
assert(fromApiSeries.series === 'One Piece', 'API series prioritaire');
assert(fromApiSeries.volume === 3, 'volume détecté > total série API');

// Google Books style : cover + série parsée s’appliquent via modal (tous cochés)
const gbPatch = metadataPatchFromEnrichResult(
  {
    title: 'Solo Leveling, Vol. 9 (comic)',
    series: 'Solo Leveling',
    volume: 9,
    author: null,
    year: 2024,
    description: 'Jinwoo returns.',
    coverUrl:
      'https://books.google.com/books/content?id=o1wVEQAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api',
    source: 'googlebooks',
  },
  { title: 'solo-t09.cbz', series: 'solo', volume: 9, coverUrl: null },
);
assert(gbPatch.coverUrl?.includes('books.google.com'), 'GB coverUrl dans patch');
assert(gbPatch.series === 'Solo Leveling', 'GB series dans patch');
assert(gbPatch.volume === 9, 'GB volume fichier conservé');
assert(
  normalizeRemoteCoverUrl(gbPatch.coverUrl).startsWith('https://'),
  'GB cover normalisée https',
);

// --- normalisation URL jacket ---
assert(
  normalizeRemoteCoverUrl('http://covers.example/a.jpg') ===
    'https://covers.example/a.jpg',
  'http → https',
);
assert(
  normalizeRemoteCoverUrl('//cdn.example/proto.jpg') ===
    'https://cdn.example/proto.jpg',
  '// → https',
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
assert(importMain.includes('coverSource'), 'commitImport marque coverSource');
assert(importMain.includes('previewCoverFromUrl'), 'previewCoverFromUrl exporté');
assert(importMain.includes('findBookForImportSource'), 'scan déjà-importé persistant');
assert(thumbs.includes('export async function ensureCoverFromUrl'), 'ensureCoverFromUrl exporté');
assert(thumbs.includes('force: true'), 'jacket force overwrite cache');
assert(thumbs.includes('normalizeRemoteCoverUrl'), 'normalizeRemoteCoverUrl');
assert(thumbs.includes('bufferToDataUrl'), 'bufferToDataUrl');
assert(
  thumbs.includes('TOCTOU') || thumbs.includes('ne pas écraser'),
  'ensureCover protège jacket contre race page 0',
);
assert(fetchSrc.includes('export async function fetchBuffer'), 'fetchBuffer dispo');
assert(importStore.includes('Jaquette absente'), 'toast cover manquante à l’apply');
assert(importStore.includes('coverWarning'), 'toast coverWarning au commit');
assert(importMain.includes('coverWarning'), 'commitImport renvoie coverWarning');
assert(importMain.includes('normalizeRemoteCoverUrl'), 'commitImport normalise coverUrl');
assert(importStore.includes('resolveCoverPreview'), 'store resolveCoverPreview');
assert(importStore.includes('previewCoverFromUrl'), 'store appelle previewCoverFromUrl');
assert(importStore.includes('enrichCoverPreviews'), 'store previews résultats search');
assert(importStore.includes('loadEnrichCoverPreviews'), 'store charge jackets search');
assert(
  importStore.includes('metadataPatchFromEnrichResult'),
  'applyEnrich via metadataPatchFromEnrichResult (série API)',
);
assert(
  importStore.includes('applyEnrichCursor(focusIndex)'),
  'applyEnrichCursor accepte index UI',
);
const importView = readFileSync(
  join(root, 'src/renderer/src/views/ImportView.vue'),
  'utf8',
);
assert(importView.includes('import__enrich-cover'), 'UI résultat jaquette');
assert(importView.includes('enrichCoverSrc'), 'UI lit previewCover résultats');
assert(importView.includes('import__enrich-series'), 'UI résultat série');
assert(importView.includes('import__enrich-volume'), 'UI résultat tome');
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

// --- scan bibliothèque : priorité jacket API + réparation coverSource ---
const ipcLibrary = readFileSync(
  join(root, 'src/main/ipc/library.js'),
  'utf8',
);
const providerSrc = readFileSync(
  join(root, 'src/main/metadata/provider.js'),
  'utf8',
);
const querySrc = readFileSync(
  join(root, 'src/shared/metadata-query.js'),
  'utf8',
);
const importStoreSrc = readFileSync(
  join(root, 'src/renderer/src/stores/import.js'),
  'utf8',
);
assert(
  ipcLibrary.includes('ensureCoverFromUrl'),
  'LIBRARY_SCAN peut re-télécharger jacket API',
);
assert(
  ipcLibrary.includes('needsRemoteCover'),
  'scan détecte jacket API non appliquée',
);
assert(
  ipcLibrary.includes("coverSource !== 'remote'"),
  'scan ne skip pas si coverSource ≠ remote',
);
assert(
  ipcLibrary.includes('LIBRARY_UPDATE_BOOK') ||
    ipcLibrary.includes('updateBook jacket'),
  'updateBook télécharge jacket API',
);
assert(
  ipcLibrary.includes('normalizeRemoteCoverUrl'),
  'updateBook normalise coverUrl https',
);
assert(
  querySrc.includes('export function normalizeMetadataQuery'),
  'normalizeMetadataQuery exporté (préfill auto)',
);
assert(
  querySrc.includes('export function prepareMetadataSearchQuery'),
  'prepareMetadataSearchQuery exporté (query manuelle)',
);
assert(
  providerSrc.includes('prepareMetadataSearchQuery'),
  'searchMetadata utilise prepareMetadataSearchQuery (pas de strip tome)',
);
assert(
  !/const q = normalizeMetadataQuery\(/.test(providerSrc),
  'searchMetadata ne strippe plus via normalizeMetadataQuery',
);
assert(
  importStoreSrc.includes('normalizeMetadataQuery'),
  'préremplissage import strippe via normalizeMetadataQuery',
);

if (failed) {
  console.error(`\n${failed} échec(s)`);
  process.exit(1);
}
console.log('\nimport-meta-jacket OK');
