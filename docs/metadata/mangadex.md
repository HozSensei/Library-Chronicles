# MangaDex — réponse API v5 → NormalizedMeta

- **Endpoint** : `GET https://api.mangadex.org/manga?title=…&limit=100&offset=…&includes[]=author&includes[]=artist&includes[]=cover_art`
- **Clé** : non
- **Docs** : [api.mangadex.org/docs](https://api.mangadex.org/docs/)
- **Mapper** : `src/main/metadata/mappers/mangadex.js` → `mapMangadexItem`
- **Fixture** : `src/main/metadata/fixtures/mangadex-solo-leveling.json`

## Exemple brut (`data[]`)

```json
{
  "id": "a1c7c5b8-0c8f-4c5e-9a2b-7e4d1f0a9b3c",
  "attributes": {
    "title": { "en": "Solo Leveling", "ja": "俺だけレベルアップな件" },
    "year": 2018,
    "description": { "en": "10 years ago, after the Gate…" }
  },
  "relationships": [
    { "type": "author", "attributes": { "name": "Chugong" } },
    { "type": "cover_art", "attributes": { "fileName": "abc123-cover.jpg" } }
  ]
}
```

## Mapping

| Champ NormalizedMeta | Source brute |
|----------------------|--------------|
| `title` | `attributes.title.en` → `ja` → `ja-ro` → 1ʳᵉ valeur |
| `series` | `ja-ro` → `en` → `ja` → title |
| `volume` | `null` (pas de tome courant en search manga) |
| `authors` | relationships `author` / `artist` → `attributes.name` |
| `year` | `attributes.year` |
| `synopsis` | `description.en` → `fr` → 1ʳᵉ (≤ 600) |
| `coverUrl` | `https://uploads.mangadex.org/covers/{mangaId}/{fileName}.512.jpg` |
| `provider` | `"mangadex"` |
| `providerId` | `id` |
| `confidence` | `0.8` |

## Cover

Construit depuis relationship `cover_art.attributes.fileName` ; **null** si absent.

## Pagination

`offset` + `limit` max **100** ; `total` dans la réponse.
