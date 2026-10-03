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
import { detectFromFilename } from './parse-filename.js';
import { stubProvider } from './providers/stub.js';
import { comicvineProvider } from './providers/comicvine.js';
import { openLibraryProvider } from './providers/openlibrary.js';
import { anilistProvider } from './providers/anilist.js';
import { mangadexProvider } from './providers/mangadex.js';
import { googleBooksProvider } from './providers/googlebooks.js';

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
  if (!key) delete apiKeys[providerId];
  else apiKeys[providerId] = String(key).trim();
  setConfig({ apiKeys });
  return { ok: true, hasKey: Boolean(apiKeys[providerId]) };
}

export function hasApiKey(providerId) {
  const cfg = getConfigInternal();
  return Boolean(cfg.apiKeys?.[providerId]);
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
  const q = String(query || '').trim();

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
          results.length > 0 && results.every((r) => r.source === 'stub' && impl.id !== 'stub');
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
  return {
    id: p.id,
    label: p.label,
    requiresApiKey: Boolean(p.requiresApiKey),
    /** @deprecated alias UI historique */
    needsKey: Boolean(p.requiresApiKey),
    freeLabel: p.freeLabel,
    helpText: p.helpText || null,
    helpUrl: p.helpUrl || null,
    helpLinkLabel: p.helpLinkLabel || null,
    hasKey: p.requiresApiKey ? hasApiKey(p.id) : false,
  };
}
