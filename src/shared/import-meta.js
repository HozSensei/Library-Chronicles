/**
 * Résolution métadonnées Import — pastilles + commit X/Y.
 *
 * metaSource :
 * - selected : choix résultat API (utilisateur)
 * - detected : méta par défaut avec données trouvées/détectées
 * - empty    : méta par défaut mais aucune méta utile trouvée
 *
 * Commit : X = un tome (focus), Y = tous — chaque item utilise
 * selectedMeta si présent, sinon méta détectées / nom de fichier.
 */

export const META_SOURCE = Object.freeze({
  SELECTED: 'selected',
  DETECTED: 'detected',
  EMPTY: 'empty',
});

/**
 * Données « utiles » au-delà du seul nom de fichier brut.
 * @param {object|null|undefined} detected
 */
export function hasDetectedMeta(detected) {
  if (!detected || typeof detected !== 'object') return false;
  return Boolean(
    detected.series ||
      detected.volume != null ||
      detected.year != null ||
      detected.author ||
      detected.description,
  );
}

/**
 * @param {{ selectedMeta?: object|null, detected?: object|null }} opts
 * @returns {'selected'|'detected'|'empty'}
 */
export function computeMetaSource({ selectedMeta = null, detected = null } = {}) {
  if (selectedMeta && typeof selectedMeta === 'object') {
    return META_SOURCE.SELECTED;
  }
  if (hasDetectedMeta(detected)) return META_SOURCE.DETECTED;
  return META_SOURCE.EMPTY;
}

/**
 * Méta par défaut depuis détection fichier / nom.
 * @param {{ detected?: object, name?: string }|null|undefined} item
 */
export function metadataFromDetected(item) {
  const d = item?.detected || {};
  return {
    title: d.title || item?.name || '',
    series: d.series || '',
    volume: d.volume ?? null,
    author: d.author || '',
    year: d.year ?? null,
    description: d.description || null,
    coverUrl: d.coverUrl || null,
    source: d.source || null,
  };
}

/**
 * Normalise un objet méta (sélection API ou draft).
 * Préserve coverUrl / source pour le commit (jacket distante).
 * @param {object|null|undefined} meta
 * @param {{ name?: string }|null} [fallbackItem]
 */
export function normalizeImportMetadata(meta, fallbackItem = null) {
  const m = meta || {};
  const source = m.source || m.provider || null;
  return {
    title: m.title || fallbackItem?.name || '',
    series: m.series || '',
    volume: m.volume ?? null,
    author: m.author || '',
    year: m.year ?? null,
    description: m.description || null,
    coverUrl: m.coverUrl || null,
    source,
    provider: m.provider || source || null,
  };
}

/**
 * Patch draft depuis un résultat API (apply A / clic).
 *
 * Priorité série après apply : **API series → API title** — jamais
 * filename / dossier parent (draft.series local). Les providers qui
 * omettent `series` (ex. Open Library) ne doivent pas laisser le parse
 * fichier écraser le choix utilisateur.
 *
 * @param {object|null|undefined} result
 * @param {object|null|undefined} [draft] draft courant (autres champs)
 * @returns {object} patch pour draft / selectedMeta
 */
export function metadataPatchFromEnrichResult(result, draft = null) {
  const prev = draft && typeof draft === 'object' ? draft : {};
  const title = String(result?.title || '').trim() || String(prev.title || '').trim();
  const apiSeries = String(result?.series || '').trim();
  const apiTitle = String(result?.title || '').trim();
  // Volume fichier (tome N) > volume API (souvent total de la série)
  const volume =
    prev.volume != null ? prev.volume : (result?.volume ?? null);
  return {
    title: title || String(prev.title || ''),
    series: apiSeries || apiTitle || '',
    volume,
    author: result?.author || prev.author || '',
    year: result?.year ?? prev.year ?? null,
    description: result?.description || prev.description || '',
    coverUrl: result?.coverUrl || prev.coverUrl || null,
    source: result?.source || prev.source || null,
  };
}

/**
 * Résout les méta d’un item pour commit (X un tome / Y tous).
 * Priorité : draft forcé → selectedMeta → détectées.
 *
 * @param {{ selectedMeta?: object|null, detected?: object, name?: string }|null} item
 * @param {{ draft?: object|null, preferDraft?: boolean }} [opts]
 */
export function resolveItemMetadata(item, { draft = null, preferDraft = false } = {}) {
  if (preferDraft && draft) {
    return normalizeImportMetadata(draft, item);
  }
  if (item?.selectedMeta) {
    return normalizeImportMetadata(item.selectedMeta, item);
  }
  return metadataFromDetected(item);
}

/** Libellés accessibilité pastilles. */
export function metaSourceLabel(source) {
  if (source === META_SOURCE.SELECTED) return 'Méta sélectionnées (API)';
  if (source === META_SOURCE.DETECTED) return 'Méta détectées';
  return 'Aucune méta trouvée';
}

/** Longueur max synopsis sur carte résultat recherche API. */
export const ENRICH_SYNOPSIS_MAX = 160;

/**
 * Tronque un texte pour extrait carte (espaces normalisés + « … »).
 * @param {string|null|undefined} text
 * @param {number} [max]
 */
export function truncateExcerpt(text, max = ENRICH_SYNOPSIS_MAX) {
  const limit = Math.max(24, Number(max) || ENRICH_SYNOPSIS_MAX);
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  if (s.length <= limit) return s;
  return `${s.slice(0, limit).trimEnd()}…`;
}

/**
 * Libellés carte résultat enrichissement (jaquette / titre / série / tome / synopsis).
 * @param {object|null|undefined} result
 * @param {{ synopsisMax?: number, volumeLabel?: (n: string|number) => string }} [opts]
 */
export function enrichResultCardFields(result, opts = {}) {
  const title = String(result?.title || '').trim();
  const seriesRaw = String(result?.series || '').trim();
  const series = seriesRaw && seriesRaw !== title ? seriesRaw : seriesRaw;
  const volume = result?.volume;
  let volumeLabel = '';
  if (volume != null && volume !== '') {
    const fmt = opts.volumeLabel;
    volumeLabel = typeof fmt === 'function' ? String(fmt(volume) || '') : `Tome ${volume}`;
  }
  const synopsis = truncateExcerpt(
    result?.description || result?.synopsis || '',
    opts.synopsisMax ?? ENRICH_SYNOPSIS_MAX,
  );
  return {
    title,
    series,
    volume,
    volumeLabel,
    synopsis,
    coverUrl: result?.coverUrl || null,
  };
}
