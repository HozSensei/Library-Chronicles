/**
 * Registry des providers de métadonnées pluggables.
 *
 * - stub / openlibrary / anilist / mangadex : sans clé
 * - comicvine / googlebooks : clé API en userData (jamais commitée)
 *
 * Offline par défaut : stub + édition manuelle toujours possibles.
 */

import { getConfigInternal, setConfig } from '../config.js';
import { createTtlCache } from '../../shared/perf-cache.js';
import {
  PROVIDER_TEST_QUERY,
  interpretProviderTestResults,
  normalizeProviderTestStatus,
  providerShowsOkBadge,
} from '../../shared/provider-test-status.js';
import { detectFromFilename } from './parse-filename.js';
import {
  normalizeMetadataQuery,
  prepareMetadataSearchQuery,
} from './types.js';
import { stubProvider } from './providers/stub.js';
import { comicvineProvider } from './providers/comicvine.js';
import { openLibraryProvider } from './providers/openlibrary.js';
import { anilistProvider } from './providers/anilist.js';
import { mangadexProvider } from './providers/mangadex.js';
import { googleBooksProvider } from './providers/googlebooks.js';

export {
  normalizeMetadataQuery,
  prepareMetadataSearchQuery,
  PROVIDER_TEST_QUERY,
  interpretProviderTestResults,
  providerShowsOkBadge,
};

/** @type {import('./types.js').MetadataProvider[]} */
const PROVIDERS = [
  stubProvider,
  openLibraryProvider,
  anilistProvider,
  mangadexProvider,
  comicvineProvider,
  googleBooksProvider,
];

const BY_ID = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));

/** Cache recherche API (TTL 90s) + dedupe in-flight. */
const searchCache = createTtlCache({ maxEntries: 48, ttlMs: 90_000 });

/** Métadonnées UI (sans la fonction search). */
export function listProviders() {
  return PROVIDERS.map(publicMeta);
}

export function getProvider(id) {
  return BY_ID[id] || null;
}

export function setApiKey(providerId, key) {
  const cfg = getConfigInternal();
  const apiKeys = { ...(cfg.apiKeys || {}) };
  const nextKey = key ? String(key).trim() : '';
  const prev = apiKeys[providerId] ? String(apiKeys[providerId]) : '';
  if (!nextKey) delete apiKeys[providerId];
  else apiKeys[providerId] = nextKey;
  // Clé changée / effacée → invalider le dernier test (évite check vert stale).
  if (prev !== nextKey) {
    clearProviderTestStatus(providerId);
  }
  setConfig({ apiKeys });
  return { ok: true, hasKey: Boolean(apiKeys[providerId]) };
}

export function hasApiKey(providerId) {
  const cfg = getConfigInternal();
  return Boolean(cfg.apiKeys?.[providerId]);
}

function readTestStatusMap() {
  const cfg = getConfigInternal();
  return { ...(cfg.providerTestStatus || {}) };
}

export function getProviderTestStatus(providerId) {
  return normalizeProviderTestStatus(readTestStatusMap()[providerId]);
}

function writeProviderTestStatus(providerId, status) {
  const map = readTestStatusMap();
  if (!status) delete map[providerId];
  else map[providerId] = normalizeProviderTestStatus(status);
  setConfig({ providerTestStatus: map });
  return map[providerId] || null;
}

export function clearProviderTestStatus(providerId) {
  const map = readTestStatusMap();
  if (!(providerId in map)) return;
  delete map[providerId];
  setConfig({ providerTestStatus: map });
}

/**
 * Ping search minimal pour valider clé / disponibilité.
 * Persiste `{ ok, testedAt, error }` dans la config publique.
 * @param {string} providerId
 * @returns {Promise<{
 *   ok: boolean,
 *   error?: string|null,
 *   testedAt: number|null,
 *   provider: string,
 *   providers: ReturnType<typeof listProviders>,
 *   activeProvider: string,
 * }>}
 */
export async function testProvider(providerId) {
  const impl = BY_ID[providerId];
  if (!impl) {
    return {
      ok: false,
      error: 'Provider inconnu',
      testedAt: null,
      provider: String(providerId || ''),
      providers: listProviders(),
      activeProvider: getActiveProviderId(),
    };
  }

  const testedAt = Date.now();

  if (impl.id === 'stub') {
    const status = writeProviderTestStatus(impl.id, {
      ok: true,
      testedAt,
      error: null,
    });
    return {
      ok: true,
      error: null,
      testedAt: status?.testedAt ?? testedAt,
      provider: impl.id,
      providers: listProviders(),
      activeProvider: getActiveProviderId(),
    };
  }

  if (impl.requiresApiKey && !hasApiKey(impl.id)) {
    const status = writeProviderTestStatus(impl.id, {
      ok: false,
      testedAt,
      error: 'Clé API manquante',
    });
    return {
      ok: false,
      error: status?.error || 'Clé API manquante',
      testedAt: status?.testedAt ?? testedAt,
      provider: impl.id,
      providers: listProviders(),
      activeProvider: getActiveProviderId(),
    };
  }

  const cfg = getConfigInternal();
  const apiKey = cfg.apiKeys?.[impl.id] || null;

  try {
    const results = await impl.search(PROVIDER_TEST_QUERY, { apiKey });
    const verdict = interpretProviderTestResults(impl.id, results);
    const status = writeProviderTestStatus(impl.id, {
      ok: verdict.ok,
      testedAt,
      error: verdict.error,
    });
    return {
      ok: verdict.ok,
      error: verdict.error,
      testedAt: status?.testedAt ?? testedAt,
      provider: impl.id,
      providers: listProviders(),
      activeProvider: getActiveProviderId(),
    };
  } catch (err) {
    const message = err?.message || String(err);
    const status = writeProviderTestStatus(impl.id, {
      ok: false,
      testedAt,
      error: message,
    });
    return {
      ok: false,
      error: status?.error || message,
      testedAt: status?.testedAt ?? testedAt,
      provider: impl.id,
      providers: listProviders(),
      activeProvider: getActiveProviderId(),
    };
  }
}

export function setMetadataProvider(providerId) {
  const provider = BY_ID[providerId];
  if (!provider) return { ok: false, error: 'Provider inconnu' };
  setConfig({ metadataProvider: provider.id });
  return { ok: true, provider: publicMeta(provider) };
}

export function getActiveProviderId() {
  const cfg = getConfigInternal();
  const id = cfg.metadataProvider || 'anilist';
  return BY_ID[id] ? id : 'anilist';
}

/**
 * Détection locale (pas d’appel API) : parsing nom de fichier,
 * puis fallback dossier parent si aucune série.
 * L’enrichissement API reste une étape séparée (searchMetadata) et prioritaire.
 */
export function detectMetadata(filePath) {
  return detectFromFilename(filePath);
}

/**
 * Recherche d’enrichissement via le provider choisi.
 * Erreurs réseau → fallback stub + flag warning (jamais d’obligation réseau).
 * @returns {Promise<{ results: import('./types.js').MetadataResult[], provider: string, warning?: string|null }>}
 */
export async function searchMetadata(query, { provider, force = false } = {}) {
  const cfg = getConfigInternal();
  const providerId = provider || cfg.metadataProvider || 'anilist';
  const impl = BY_ID[providerId] || stubProvider;
  const apiKey = cfg.apiKeys?.[impl.id] || null;
  // Query manuelle / IPC : trim minimal uniquement.
  // Ne PAS stripper « Tome N » — l’utilisateur peut chercher un tome précis.
  // Le strip auto (filename → « One Piece ») est dans normalizeMetadataQuery,
  // appliqué au préremplissage import (store), pas ici.
  const q = prepareMetadataSearchQuery(query);

  if (!q) {
    return {
      results: [],
      provider: impl.id,
      warning: 'Requête vide — renseigne un titre ou une série.',
    };
  }

  const cacheKey = `${impl.id}::${q.toLowerCase()}`;
  return searchCache.getOrLoad(
    cacheKey,
    async () => {
      if (impl.requiresApiKey && !apiKey) {
        const stub = await stubProvider.search(q);
        return {
          results: stub.map((r) => ({
            ...r,
            description: `${r.description || ''} (Clé API ${impl.label} manquante)`.trim(),
          })),
          provider: impl.id,
          warning: `Clé API requise pour ${impl.label}. Configure-la dans Paramètres → API.`,
        };
      }

      try {
        const results = await impl.search(q, { apiKey });
        const allStub =
          results.length > 0 &&
          results.every((r) => r.source === 'stub' && impl.id !== 'stub');
        return {
          results,
          provider: impl.id,
          warning: allStub
            ? `${impl.label} n’a pas renvoyé de résultats exploitables (réseau ou requête).`
            : null,
        };
      } catch (err) {
        console.warn(`[VDR] Provider ${impl.id} crashed:`, err.message);
        const stub = await stubProvider.search(q);
        return {
          results: stub.map((r) => ({
            ...r,
            description: `${r.description || ''} (${impl.label} indisponible: ${err.message})`.trim(),
          })),
          provider: impl.id,
          warning: `${impl.label} indisponible : ${err.message}`,
        };
      }
    },
    { force },
  );
}

function publicMeta(p) {
  const status = getProviderTestStatus(p.id);
  const hasKey = p.requiresApiKey ? hasApiKey(p.id) : false;
  const testOk = Boolean(status?.ok);
  const meta = {
    id: p.id,
    label: p.label,
    requiresApiKey: Boolean(p.requiresApiKey),
    /** @deprecated alias UI historique */
    needsKey: Boolean(p.requiresApiKey),
    freeLabel: p.freeLabel,
    helpText: p.helpText || null,
    helpUrl: p.helpUrl || null,
    helpLinkLabel: p.helpLinkLabel || null,
    hasKey,
    testOk,
    testedAt: status?.testedAt ?? null,
    testError: status?.error ?? null,
    /** true si le provider peut être testé (tous sauf absence totale) */
    canTest: true,
  };
  meta.configuredOk = providerShowsOkBadge(meta);
  return meta;
}
