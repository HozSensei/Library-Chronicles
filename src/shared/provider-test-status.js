/**
 * Statut de test des providers métadonnées (OK/KO + badge vert).
 * Logique pure — partagée main / tests / UI.
 */

/** Requête minimale pour un health-check search. */
export const PROVIDER_TEST_QUERY = 'One Piece';

/**
 * Interprète les résultats d’un ping search.
 * OK si au moins un résultat porte le `source` du provider (pas un soft-fallback stub).
 * @param {string} providerId
 * @param {Array<{ source?: string }>|null|undefined} results
 * @returns {{ ok: boolean, error: string|null }}
 */
export function interpretProviderTestResults(providerId, results) {
  const id = String(providerId || '').trim();
  if (!id) {
    return { ok: false, error: 'Provider inconnu' };
  }
  if (id === 'stub') {
    return { ok: true, error: null };
  }
  const list = Array.isArray(results) ? results : [];
  const real = list.filter((r) => r && r.source === id);
  if (real.length > 0) {
    return { ok: true, error: null };
  }
  return {
    ok: false,
    error: 'Aucun résultat API valide (réseau, clé ou quota)',
  };
}

/**
 * Normalise une entrée de statut persistée.
 * @param {unknown} raw
 * @returns {{ ok: boolean, testedAt: number|null, error: string|null }|null}
 */
export function normalizeProviderTestStatus(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const testedAt =
    typeof raw.testedAt === 'number' && Number.isFinite(raw.testedAt)
      ? raw.testedAt
      : null;
  return {
    ok: Boolean(raw.ok),
    testedAt,
    error: raw.error != null ? String(raw.error) : null,
  };
}

/**
 * Check vert Settings / Import :
 * - providers à clé : clé présente + dernier test OK
 * - providers gratuits (hors stub) : dernier test OK
 * - stub : jamais (offline local, pas une « source API configurée »)
 * @param {{
 *   id?: string,
 *   requiresApiKey?: boolean,
 *   hasKey?: boolean,
 *   testOk?: boolean,
 *   lastTestOk?: boolean,
 * }} meta
 */
export function providerShowsOkBadge(meta) {
  if (!meta || !meta.id || meta.id === 'stub') return false;
  const testOk = Boolean(meta.testOk ?? meta.lastTestOk);
  if (meta.requiresApiKey) {
    return Boolean(meta.hasKey) && testOk;
  }
  return testOk;
}
