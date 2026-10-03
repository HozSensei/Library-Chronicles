/**
 * Providers de métadonnées pluggables.
 * - stub : enrichissement local fictif (toujours dispo)
 * - comicvine : squelette prêt ; nécessite une clé API dans userData
 */

import { getConfigInternal, setConfig } from '../config.js';
import { detectFromFilename } from './parse-filename.js';

/** @typedef {{ id: string, title: string, series?: string|null, volume?: number|null, author?: string|null, year?: number|null, description?: string|null, coverUrl?: string|null, source: string, confidence: number }} MetadataResult */

export function listProviders() {
  return [
    { id: 'stub', label: 'Local (stub)', needsKey: false },
    { id: 'comicvine', label: 'ComicVine', needsKey: true },
  ];
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

export function detectMetadata(filePath) {
  return detectFromFilename(filePath);
}

/**
 * Recherche d’enrichissement.
 * @returns {Promise<MetadataResult[]>}
 */
export async function searchMetadata(query, { provider } = {}) {
  const cfg = getConfigInternal();
  const providerId = provider || cfg.metadataProvider || 'stub';

  if (providerId === 'comicvine') {
    return searchComicVine(query, cfg.apiKeys?.comicvine);
  }
  return searchStub(query);
}

async function searchStub(query) {
  const q = String(query || '').trim();
  if (!q) return [];

  // Résultats fictifs déterministes pour UI / tests offline
  const base = detectFromFilename(`${q}.cbz`);
  return [
    {
      id: `stub:${slug(q)}:1`,
      title: base.title || q,
      series: base.series || q,
      volume: base.volume,
      author: 'Auteur (stub)',
      year: base.year || 2020,
      description: `Résultat stub pour « ${q} ». Remplace par ComicVine avec une clé API.`,
      coverUrl: null,
      source: 'stub',
      confidence: 0.5,
    },
    {
      id: `stub:${slug(q)}:2`,
      title: `${base.title || q} — édition collector`,
      series: base.series || q,
      volume: base.volume != null ? base.volume : 1,
      author: 'Studio (stub)',
      year: (base.year || 2020) - 1,
      description: 'Variante stub pour comparer / choisir manuellement.',
      coverUrl: null,
      source: 'stub',
      confidence: 0.35,
    },
  ];
}

/**
 * ComicVine — câblage prêt ; si pas de clé ou pas de réseau, fallback stub + message.
 * Docs: https://comicvine.gamespot.com/api/
 */
async function searchComicVine(query, apiKey) {
  if (!apiKey) {
    const stub = await searchStub(query);
    return stub.map((r) => ({
      ...r,
      description: `${r.description} (ComicVine : clé API manquante — ajoute-la dans Paramètres.)`,
    }));
  }

  try {
    const url = new URL('https://comicvine.gamespot.com/api/search/');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('format', 'json');
    url.searchParams.set('resources', 'volume,issue');
    url.searchParams.set('query', query);
    url.searchParams.set('limit', '8');

    const res = await fetch(url, {
      headers: { 'User-Agent': 'VerticalDeckReader/0.1 (Library-Chronicles)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const results = (data.results || []).map((item, i) => ({
      id: `comicvine:${item.id || i}`,
      title: item.name || item.volume?.name || query,
      series: item.volume?.name || item.name || null,
      volume: parseVolume(item.issue_number || item.count_of_issues),
      author: null,
      year: extractYear(item.start_year || item.cover_date),
      description: item.deck || item.description || null,
      coverUrl: item.image?.thumb_url || item.image?.small_url || null,
      source: 'comicvine',
      confidence: 0.8,
    }));
    return results.length ? results : searchStub(query);
  } catch (err) {
    console.warn('[VDR] ComicVine search failed:', err.message);
    const stub = await searchStub(query);
    return stub.map((r) => ({
      ...r,
      description: `${r.description} (ComicVine indisponible: ${err.message})`,
    }));
  }
}

function parseVolume(v) {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function extractYear(v) {
  if (!v) return null;
  const m = String(v).match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}
