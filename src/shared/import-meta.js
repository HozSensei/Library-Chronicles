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
  };
}

/**
 * Normalise un objet méta (sélection API ou draft).
 * @param {object|null|undefined} meta
 * @param {{ name?: string }|null} [fallbackItem]
 */
export function normalizeImportMetadata(meta, fallbackItem = null) {
  const m = meta || {};
  return {
    title: m.title || fallbackItem?.name || '',
    series: m.series || '',
    volume: m.volume ?? null,
    author: m.author || '',
    year: m.year ?? null,
    description: m.description || null,
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
