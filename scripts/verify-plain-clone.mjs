/**
 * Tests sanitize IPC / clone plain — reproduit le bug
 * « An object could not be cloned » (Proxy Pinia → structuredClone).
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reactive } from 'vue';
import {
  sanitizeForIpc,
  isStructuredCloneable,
  clonePlainMeta,
  isDevMode,
} from '../src/shared/plain-clone.js';
import {
  createNormalizedMeta,
  ensureNormalizedMeta,
} from '../src/shared/normalized-meta.js';
import {
  metadataPatchFromEnrichResult,
  normalizeImportMetadata,
} from '../src/shared/import-meta.js';
import { mapGoogleBooksItem } from '../src/main/metadata/mappers/googlebooks.js';
import {
  defaultMetaApplySelection,
  filterMetaPatchBySelection,
} from '../src/shared/meta-apply-fields.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadFixture(name) {
  return JSON.parse(
    readFileSync(join(root, 'src/main/metadata/fixtures', name), 'utf8'),
  );
}

// --- sanitize de base ---
{
  const plain = sanitizeForIpc({ a: 1, b: [2, 3], c: null });
  assert.deepEqual(plain, { a: 1, b: [2, 3], c: null });
  assert.equal(sanitizeForIpc(undefined), undefined);
  assert.equal(sanitizeForIpc(null), null);
  assert.ok(isStructuredCloneable(plain));
}

// --- repro Proxy Vue : metadata.authors réactif ne clone PAS ---
{
  const prev = reactive({
    description: 'old',
    authors: ['Chugong'],
    coverUrl: 'https://books.google.com/books/content?id=x&zoom=3',
    nested: { source: 'googlebooks' },
  });
  const naive = {
    metadata: {
      ...prev,
      description: 'new synopsis',
      coverUrl: 'https://books.google.com/books/content?id=y&zoom=3',
    },
  };
  assert.equal(
    isStructuredCloneable(naive),
    false,
    'spread Proxy laisse authors/nested non clonables',
  );

  const fixed = sanitizeForIpc(naive);
  assert.ok(isStructuredCloneable(fixed), 'sanitize → structuredClone OK');
  assert.deepEqual(fixed.metadata.authors, ['Chugong']);
  assert.equal(fixed.metadata.description, 'new synopsis');
  assert.equal(fixed.metadata.nested.source, 'googlebooks');
}

// --- mapper Google Books → plain cloneable ---
{
  const fixtureName = 'googlebooks-solo-leveling-vol9.json';
  const fixturePath = join(root, 'src/main/metadata/fixtures', fixtureName);
  assert.ok(existsSync(fixturePath), 'fixture GB présente');
  const raw = loadFixture(fixtureName);
  const item = raw?.items?.[0] || raw;
  const mapped = mapGoogleBooksItem(item);
  assert.equal(mapped.provider, 'googlebooks');
  assert.ok(Array.isArray(mapped.authors));
  assert.ok(isStructuredCloneable(mapped), 'NormalizedMeta GB clonable');
  assert.ok(isStructuredCloneable(sanitizeForIpc(reactive(mapped))));
}

// --- createNormalizedMeta / ensureNormalizedMeta plain ---
{
  const n = createNormalizedMeta({
    title: 'T',
    authors: ['A'],
    provider: 'googlebooks',
    providerId: 'abc',
    coverUrl: 'http://books.google.com/books/content?id=z',
  });
  assert.ok(n.coverUrl?.startsWith('https://'));
  assert.ok(isStructuredCloneable(n));
  const ensured = ensureNormalizedMeta(reactive({ ...n }));
  assert.ok(ensured);
  assert.ok(isStructuredCloneable(ensured));
}

// --- apply patch + filter : plain avant IPC ---
{
  const raw = loadFixture('googlebooks-solo-leveling-vol9.json');
  const result = mapGoogleBooksItem(raw?.items?.[0] || raw);
  const reactiveResult = reactive(result);
  const patch = metadataPatchFromEnrichResult(reactiveResult, {
    title: 'file',
    series: 'folder',
    volume: 9,
  });
  assert.ok(isStructuredCloneable(patch), 'patch enrich plain');
  const filtered = filterMetaPatchBySelection(patch, defaultMetaApplySelection());
  assert.ok(isStructuredCloneable(filtered));

  // Simule update.metadata = { ...prevReactive, ... } puis sanitize
  const bookMeta = reactive({
    authors: result.authors,
    description: 'prev',
    coverSource: 'archive',
  });
  const update = {
    title: patch.title,
    series: patch.series,
    metadata: {
      ...bookMeta,
      description: patch.description,
      coverUrl: patch.coverUrl,
      source: patch.source,
      provider: patch.provider,
    },
  };
  assert.equal(isStructuredCloneable(update), false, 'repro clone error');
  const safe = sanitizeForIpc(update);
  assert.ok(isStructuredCloneable(safe), 'sanitize updateBook OK');
  assert.ok(Array.isArray(safe.metadata.authors));
}

// --- normalizeImportMetadata copie authors (pas la ref Proxy) ---
{
  const src = reactive({
    title: 'Solo',
    author: 'Chugong',
    authors: ['Chugong', 'DUBU'],
    provider: 'googlebooks',
    coverUrl: 'https://books.google.com/x',
  });
  const norm = normalizeImportMetadata(src);
  assert.ok(isStructuredCloneable(norm));
  assert.deepEqual(norm.authors, ['Chugong', 'DUBU']);
  // Mutation source ne doit pas affecter la copie
  src.authors.push('X');
  assert.deepEqual(norm.authors, ['Chugong', 'DUBU']);
}

// --- clonePlainMeta + isDevMode ---
{
  assert.ok(clonePlainMeta({ a: 1 }));
  assert.equal(clonePlainMeta(null), null);
  assert.equal(typeof isDevMode(), 'boolean');
  assert.equal(isDevMode({ force: true }), true);
}

// --- wiring sources ---
{
  const store = readFileSync(
    join(root, 'src/renderer/src/stores/import.js'),
    'utf8',
  );
  assert.match(store, /toRaw/, 'import store toRaw');
  assert.match(store, /sanitizeForIpc/, 'import store sanitize');
  assert.match(store, /_debugDumpMetaApply/, 'dump apply');
  assert.match(store, /debugDumpApply/, 'IPC dump');

  const lib = readFileSync(
    join(root, 'src/renderer/src/stores/library.js'),
    'utf8',
  );
  assert.match(lib, /sanitizeForIpc\(toRaw\(patch\)\)/, 'library updateBook sanitize');

  const preload = readFileSync(join(root, 'src/preload/index.js'), 'utf8');
  assert.match(preload, /sanitizeForIpc\(patch\)/, 'preload updateBook sanitize');
  assert.match(preload, /METADATA_DEBUG_DUMP_APPLY/, 'preload dump channel');

  const gitignore = readFileSync(join(root, '.gitignore'), 'utf8');
  assert.match(gitignore, /\.debug\//, '.debug ignoré');

  assert.ok(
    existsSync(join(root, 'src/main/ipc/meta-apply-debug.js')),
    'IPC dump main',
  );
}

console.log('plain-clone / meta-apply sanitize OK');
