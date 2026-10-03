/**
 * Provider stub — offline, déterministe, aucune clé / aucun réseau.
 */

import { detectFromFilename } from '../parse-filename.js';
import { slug } from '../types.js';

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
      {
        id: `stub:${slug(q)}:1`,
        title: base.title || q,
        series: base.series || q,
        volume: base.volume,
        author: 'Auteur (stub)',
        year: base.year || 2020,
        description: `Résultat stub pour « ${q} ». Choisis un provider en ligne ou édite manuellement.`,
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
  },
};
