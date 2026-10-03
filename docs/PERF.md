# Performance & propreté — Vertical Deck Reader

Audit et correctifs appliqués sur la branche `cursor/vdr-audit-perf-cleanup-ebcb`.

## Findings majeurs

| Zone | Problème | Impact |
|------|----------|--------|
| Watcher library | Appelait `library.scan()` **complet** (openBook sur chaque archive) à chaque event FS | CPU / I/O très élevés sur Ally |
| `library.refresh()` | 4× `listBooks` IPC (list + series + continue + lastAccessed) + refetch à chaque navigation fiche | Navigation lente |
| `reader.open` | Relisait **toute** la biblio via `library.list()` juste pour série/volume | Ouverture lecteur inutilement lourde |
| Covers | `coverToDataUrl` relisait le disque + re-encodait base64 à chaque `getCover` | Scroll grille / warm covers |
| Pages CBZ/CBR | Cache CBZ OK ; CBR **non borné** ; pas de prefetch page ±N côté renderer ; re-encode base64 IPC | Tourne-page / RAM |
| Metadata search | Aucun cache — double-clic / rescan = double fetch réseau | Import enrich |
| Import | `loadProviders` à chaque scan | IPC superflu |

## Correctifs appliqués

1. **Scan incrémental** — `library.scan({ force })` : watcher / `syncFromWatch` avec `force: false` saute les livres déjà indexés (cover + pageTotal). Bouton Scanner reste `force: true`.
2. **Refresh TTL + dedupe** — store library : TTL 12 s, promesse in-flight unique, `invalidate()` après scan / import / fermeture lecteur.
3. **Dérivation locale** — séries / continue / lastAccess calculés depuis `list()` (un seul IPC) via `groupBooksBySeries`.
4. **Navigation soft** — fiches tome/série : `refresh({ warmCovers: false })` réutilise le cache TTL.
5. **Reader** — `reader.open` renvoie series/seriesId/volume ; prefetch pages ±2 + ObjectURL cache + revoke ; cache base64 IPC LRU ; CBR LRU 12 comme CBZ.
6. **Covers** — cache mémoire LRU data-URL (mtime-aware) dans `thumbnails.js`.
7. **Metadata** — TTL 90 s + dedupe in-flight (`createTtlCache`).
8. **Import** — providers chargés une fois ; `invalidate()` library après commit.
9. **Propreté** — suppression getter mort `recentBooks` ; helper partagé `src/shared/perf-cache.js`.

## Gains attendus

- Watcher FS : de O(n archives ouvertes) → O(nouveaux fichiers) sur lib stables.
- Navigation catalogue → fiche : souvent **0** `listBooks` IPC (TTL).
- Ouverture lecteur : **1** lookup DB (déjà dans open) au lieu de list complète.
- Tourne-page : hit cache ±2 pages (renderer + IPC + extracteur).
- Enrichissement méta répété : hit cache 90 s.

## Reste / pistes

- [ ] IPC `library.getBook(id)` dédié (évite même soft-refresh si store vide).
- [ ] Indexer uniquement le `filePath` porté par l’event watcher (pas de walk complet).
- [ ] Prefetch cover disque → chemin `file://` / protocole custom (éviter data-URL géants).
- [ ] Debounce plus agressif si poll mode sur gros dossiers.
- [ ] Mesures chrono automatisées (script bench open/getPage/list) — hors scope de cet audit.

## Helpers

Voir `src/shared/perf-cache.js` (`createTtlCache`, `createLruMap`) — purs, testables sans Electron.
