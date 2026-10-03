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
- **Défaut** : `anilist` (gratuit, sans clé) — plus `stub` par défaut.
- Warnings visibles si réseau / clé / résultats vides ; synopsis appliquée au draft.

## Comportement réseau

- Timeout ~8 s, User-Agent identifié.
- Erreur / timeout / clé manquante → résultats stub annotés + `warning` IPC (pas de crash).
- Provider actif persisté dans la config (`metadataProvider`).

## Tests

```bash
npm run test:metadata
```
