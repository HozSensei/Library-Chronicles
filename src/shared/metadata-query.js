/**
 * Helpers query recherche métadonnées (import).
 *
 * Deux chemins distincts — ne pas les mélanger :
 *
 * 1. **Préremplissage auto** (`normalizeMetadataQuery`) : depuis le nom de
 *    fichier / draft (« One Piece - Tome 03 » → « One Piece »). Le strip
 *    tome/vol aide AniList / MangaDex / Open Library à matcher la série.
 *
 * 2. **Query manuelle** (`prepareMetadataSearchQuery`) : ce que l’utilisateur
 *    tape dans le champ mots-clés. On ne retire PAS « Tome N » / « Vol. N » —
 *    chercher « Solo Leveling Tome 44 » doit partir tel quel vers l’API.
 */

/**
 * Strip tome/volume pour le **préremplissage auto** uniquement
 * (nom de fichier / draft → champ mots-clés).
 *
 * Ne pas appeler sur une query saisie manuellement.
 *
 * « Solo Leveling Tome 1 » → « Solo Leveling »
 * « One Piece - Vol. 03 » → « One Piece »
 *
 * @param {string} query
 * @returns {string}
 */
export function normalizeMetadataQuery(query) {
  const raw = String(query || '').trim();
  if (!raw) return '';
  const stripped = raw
    .replace(/\b(?:tome|tomes|vol\.?|volume)\s*\d{1,4}\b/gi, ' ')
    .replace(/\b[tT]\d{1,3}\b/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || raw;
}

/**
 * Prépare une query **utilisateur** avant envoi API / IPC.
 * Trim + collapse espaces uniquement — conserve « Tome N » / « Vol. N ».
 *
 * @param {string} query
 * @returns {string}
 */
export function prepareMetadataSearchQuery(query) {
  return String(query || '')
    .trim()
    .replace(/\s+/g, ' ');
}
