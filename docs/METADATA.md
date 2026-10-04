# Métadonnées — providers

Enrichissement à l’import via une interface pluggable (`search` / métadonnées UI).  
**Aucune obligation réseau** : le stub offline + l’édition manuelle restent toujours disponibles.

## Providers

| Id | Label | Clé | Aide / doc |
|----|-------|-----|------------|
| `stub` | Local (stub) | Non — *Gratuit — aucune clé* | — |
| `openlibrary` | Open Library | Non | [API Open Library](https://openlibrary.org/developers/api) |
| `anilist` | AniList | Non | [docs.anilist.co](https://docs.anilist.co/) |
| `mangadex` | MangaDex | Non | [api.mangadex.org/docs](https://api.mangadex.org/docs/) |
| `comicvine` | ComicVine | **Oui** | [Obtenir une clé](https://comicvine.gamespot.com/api/) |
| `googlebooks` | Google Books | **Oui** | [Console Books API](https://console.cloud.google.com/apis/library/books.googleapis.com) |

## Secrets

Les clés API sont stockées dans `userData/vdr-secrets.json` (chmod 600 si possible),  
séparées de `vdr-config.json`. **Jamais** commités dans le dépôt.

## UI

- **Paramètres → API métadonnées** : liste des providers, badge gratuit / clé requise, champ clé seulement si `requiresApiKey`, texte d’aide + lien (`shell.openExternal`, pas de webview).
- **Import (fiche détail)** : sélecteur de provider + champ **mots-clés** éditable (clavier virtuel) ; `search(query)` via le provider actif ; choisir un résultat pour appliquer les méta (`metaSource: selected`, pastille verte), puis Importer ce tome (X) ou tout importer (Y).
- **Résolution méta (X/Y)** : `selectedMeta` si choix API, sinon méta détectées / nom de fichier. Pastilles liste : bleu = `detected`, rouge = `empty`, vert = `selected`.
- **Jackets** : `coverUrl` des résultats API est conservé dans `selectedMeta` / draft et téléchargé au commit (`ensureCoverFromUrl`) — fallback page 0 de l’archive si échec réseau. Le scan bibliothèque privilégie `metadata.coverUrl` (`coverSource: remote`) et ne laisse pas le watcher écraser une jaquette API avec la page 0.
- **Recherche** : deux chemins — (1) **préremplissage auto** depuis le nom de fichier / draft : `normalizeMetadataQuery` retire `Tome N` / `Vol. N` (« One Piece - Tome 03 » → « One Piece ») ; (2) **mots-clés tapés** : `prepareMetadataSearchQuery` (trim seulement) — « Solo Leveling Tome 44 » part tel quel vers l’API. Taille de page = max API (`METADATA_SEARCH_LIMITS` : AniList 50, MangaDex/Open Library/ComicVine 100, Google Books 40) ; **multi-pages** via `collectSearchPages` jusqu’à `METADATA_SEARCH_MAX_TOTAL` (250). UI : compteur « Résultats · N », jaquette (proxy CSP), titre, série, tome.
- **Fiche livre** : titre / série / tome / année / auteur / synopsis éditables post-import (`library.updateBook`) ; statut / pages / provider restent en lecture seule.
- **Défaut** : `anilist` (gratuit, sans clé) — plus `stub` par défaut.
- Warnings visibles si réseau / clé / résultats vides ; synopsis appliquée au draft.

## Comportement réseau

- Timeout ~8 s par requête, User-Agent identifié.
- Pagination : AniList `page`/`pageInfo`, MangaDex/ComicVine/Open Library `offset`, Google Books `startIndex` — arrêt sur page incomplète, `hasMore: false`, total atteint, ou plafond 250. Échec page 2+ : conserve les hits déjà collectés.
- Erreur / timeout / clé manquante → résultats stub annotés + `warning` IPC (pas de crash).
- Provider actif persisté dans la config (`metadataProvider`).

## Tests

```bash
npm run test:metadata
```
