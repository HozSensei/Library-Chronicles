/**
 * Garde-fous statut test providers (check vert Settings / Import).
 */
import assert from 'assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROVIDER_TEST_QUERY,
  interpretProviderTestResults,
  normalizeProviderTestStatus,
  providerShowsOkBadge,
} from '../src/shared/provider-test-status.js';
import { comicvineProvider } from '../src/main/metadata/providers/comicvine.js';
import { anilistProvider } from '../src/main/metadata/providers/anilist.js';
import { openLibraryProvider } from '../src/main/metadata/providers/openlibrary.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

assert.equal(PROVIDER_TEST_QUERY, 'One Piece');

assert.deepEqual(interpretProviderTestResults('anilist', [{ source: 'anilist' }]), {
  ok: true,
  error: null,
});
assert.equal(interpretProviderTestResults('anilist', [{ source: 'stub' }]).ok, false);
assert.equal(interpretProviderTestResults('comicvine', []).ok, false);
assert.equal(interpretProviderTestResults('stub', []).ok, true);

assert.equal(
  providerShowsOkBadge({
    id: 'comicvine',
    requiresApiKey: true,
    hasKey: true,
    testOk: true,
  }),
  true,
);
assert.equal(
  providerShowsOkBadge({
    id: 'comicvine',
    requiresApiKey: true,
    hasKey: true,
    testOk: false,
  }),
  false,
);
assert.equal(
  providerShowsOkBadge({
    id: 'comicvine',
    requiresApiKey: true,
    hasKey: false,
    testOk: true,
  }),
  false,
);
assert.equal(
  providerShowsOkBadge({
    id: 'anilist',
    requiresApiKey: false,
    hasKey: false,
    testOk: true,
  }),
  true,
);
assert.equal(
  providerShowsOkBadge({
    id: 'anilist',
    requiresApiKey: false,
    testOk: false,
  }),
  false,
);
assert.equal(
  providerShowsOkBadge({ id: 'stub', requiresApiKey: false, testOk: true }),
  false,
);

assert.deepEqual(
  normalizeProviderTestStatus({ ok: 1, testedAt: 42, error: 'x' }),
  { ok: true, testedAt: 42, error: 'x' },
);
assert.equal(normalizeProviderTestStatus(null), null);

// Ping search mock → résultats réels → interpret OK
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const href = String(url);
  if (href.includes('graphql.anilist.co')) {
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          data: {
            Page: {
              media: [
                {
                  id: 1,
                  title: { romaji: 'One Piece', english: 'One Piece' },
                  volumes: 100,
                  startDate: { year: 1997 },
                  description: 'Pirates',
                  coverImage: { large: null },
                  staff: { edges: [] },
                },
              ],
            },
          },
        };
      },
    };
  }
  if (href.includes('openlibrary.org')) {
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          docs: [{ key: '/works/OL1', title: 'One Piece', author_name: ['Oda'] }],
        };
      },
    };
  }
  if (href.includes('comicvine.gamespot.com')) {
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          results: [{ id: 9, name: 'One Piece', start_year: '1997', deck: 'Pirates' }],
        };
      },
    };
  }
  throw new Error(`Unexpected fetch: ${href} ${opts.method || ''}`);
};

try {
  const al = await anilistProvider.search(PROVIDER_TEST_QUERY);
  assert.equal(interpretProviderTestResults('anilist', al).ok, true);

  const ol = await openLibraryProvider.search(PROVIDER_TEST_QUERY);
  assert.equal(interpretProviderTestResults('openlibrary', ol).ok, true);

  const cv = await comicvineProvider.search(PROVIDER_TEST_QUERY, { apiKey: 'k' });
  assert.equal(interpretProviderTestResults('comicvine', cv).ok, true);

  const cvNoKey = await comicvineProvider.search(PROVIDER_TEST_QUERY, { apiKey: null });
  assert.equal(interpretProviderTestResults('comicvine', cvNoKey).ok, false);
} finally {
  globalThis.fetch = originalFetch;
}

// Soft-fail réseau → stub annoté → KO
globalThis.fetch = async () => {
  throw new Error('network down');
};
try {
  const offline = await anilistProvider.search(PROVIDER_TEST_QUERY);
  assert.equal(interpretProviderTestResults('anilist', offline).ok, false);
} finally {
  globalThis.fetch = originalFetch;
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

const channels = read('src/shared/ipc-channels.js');
assert.match(channels, /METADATA_TEST_PROVIDER/, 'IPC test provider');

const preload = read('src/preload/index.js');
assert.match(preload, /testProvider/, 'preload testProvider');

const providerMain = read('src/main/metadata/provider.js');
assert.match(providerMain, /export async function testProvider/, 'testProvider export');
assert.match(providerMain, /providerTestStatus|configuredOk/, 'status exposé');

const config = read('src/main/config.js');
assert.match(config, /providerTestStatus/, 'config providerTestStatus');

const settings = read('src/renderer/src/views/SettingsView.vue');
assert.match(settings, /testSelectedProvider|testProvider/, 'Settings bouton Tester');
assert.match(settings, /provider-ok|configuredOk/, 'Settings check vert');
assert.match(settings, /toast\.providerTestOk/, 'toast succès');
assert.match(settings, /data-provider-test/, 'Tester visible par provider');
assert.match(settings, /provider-card__test/, 'Tester inline sur chaque carte');
assert.match(settings, /providerCanTest/, 'filtre stub / canTest');

const importView = read('src/renderer/src/views/ImportView.vue');
assert.match(importView, /configuredOk/, 'Import configuredOk');
assert.match(importView, /import__provider-ok/, 'Import check vert');

const i18n = read('src/shared/i18n.js');
assert.match(i18n, /testProvider:\s*'Tester'/, 'i18n FR Tester');
assert.match(i18n, /testProvider:\s*'Test'/, 'i18n EN Test');
assert.match(i18n, /providerTestOk/, 'i18n toast OK');
assert.match(i18n, /providerTestFail/, 'i18n toast fail');
assert.match(i18n, /bouton Tester|Test button/, 'i18n hint mentionne Tester');

assert.match(providerMain, /canTest:\s*p\.id\s*!==\s*'stub'/, 'canTest exclut stub');

console.log('verify-provider-test-status: OK');
