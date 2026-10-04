/**
 * Provider stub — offline, déterministe, aucune clé / aucun réseau.
 */

import { detectFromFilename } from '../parse-filename.js';
import { slug } from '../types.js';
import { createNormalizedMeta } from '../../../shared/normalized-meta.js';

/** @type {import('../types.js').MetadataProvider} */
export const stubProvider = {
  id: 'stub',
  label: 'Local (stub)',
  requiresApiKey: false,
  freeLabel: 'Gratuit — aucune clé',
  helpText: 'Fonctionne hors ligne. Résultats fictifs pour tester l’UI ; édite manuellement les champs.',
  helpUrl: null,
  helpLinkLabel: null,

  async search(query) {
    const q = String(query || '').trim();
    if (!q) return [];

    const base = detectFromFilename(`${q}.cbz`);
    return [
      createNormalizedMeta({
        title: base.title || q,
        series: base.series || q,
        volume: base.volume,
        authors: ['Auteur (stub)'],
        year: base.year || 2020,
        synopsis: `Résultat stub pour « ${q} ». Choisis un provider en ligne ou édite manuellement.`,
        coverUrl: null,
        provider: 'stub',
        providerId: `${slug(q)}:1`,
        confidence: 0.5,
      }),
      createNormalizedMeta({
        title: `${base.title || q} — édition collector`,
        series: base.series || q,
        volume: base.volume != null ? base.volume : 1,
        authors: ['Studio (stub)'],
        year: (base.year || 2020) - 1,
        synopsis: 'Variante stub pour comparer / choisir manuellement.',
        coverUrl: null,
        provider: 'stub',
        providerId: `${slug(q)}:2`,
        confidence: 0.35,
      }),
    ];
  },
};
