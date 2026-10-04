# Open Library — réponse search.json → NormalizedMeta

- **Endpoint** : `GET https://openlibrary.org/search.json?q=…&limit=100&offset=…`
- **Clé** : non
- **Docs** : [Open Library API](https://openlibrary.org/developers/api)
- **Mapper** : `src/main/metadata/mappers/openlibrary.js` → `mapOpenLibraryDoc`
- **Fixture** : `src/main/metadata/fixtures/openlibrary-akira.json`

## Exemple brut (`docs[]`)

```json
{
  "key": "/works/OL82563W",
  "title": "Akira",
  "author_name": ["Katsuhiro Otomo"],
  "first_publish_year": 1984,
  "cover_i": 8234151,
  "subtitle": "Book One",
  "series": ["Akira"]
}
```

## Mapping

| Champ NormalizedMeta | Source brute |
|----------------------|--------------|
| `title` | `title` (fallback query) |
| `series` | `series[0]` ou `series` string |
| `volume` | `null` |
| `authors` | `author_name[]` |
| `year` | `first_publish_year` |
| `synopsis` | `subtitle` (souvent le seul résumé court) |
| `coverUrl` | `https://covers.openlibrary.org/b/id/{cover_i}-L.jpg` si `cover_i` |
| `provider` | `"openlibrary"` |
| `providerId` | `key` (ex. `/works/OL82563W`) |
| `confidence` | `0.7` |

## Cover

Taille **-L** (large) — mieux pour jaquette catalogue que `-M`.

## Pagination

`offset` + `limit` **100** ; `numFound` / `num_found` pour total.
