# Google Books — réponse API → NormalizedMeta

- **Endpoint** : `GET https://www.googleapis.com/books/v1/volumes?q=…&maxResults=40&startIndex=…&printType=books&key=…`
- **Clé** : requise (`GOOGLE_BOOKS_API_KEY` en probe ; Settings en app)
- **Docs** : [Books API](https://developers.google.com/books/docs/v1/using)
- **Mapper** : `src/main/metadata/mappers/googlebooks.js` → `mapGoogleBooksItem`
- **Fixture** : `src/main/metadata/fixtures/googlebooks-solo-leveling-vol9.json`

## Exemple brut (extrait `items[]`)

```json
{
  "id": "o1wVEQAAQBAJ",
  "volumeInfo": {
    "title": "Solo Leveling, Vol. 9 (comic)",
    "authors": ["Chugong", "DUBU (REDICE STUDIO)"],
    "publishedDate": "2024-08-20",
    "description": "Jinwoo returns to the Demon Castle.",
    "seriesInfo": {
      "bookDisplayNumber": "9",
      "shortSeriesBookTitle": "Solo Leveling, Vol. 9"
    },
    "imageLinks": {
      "thumbnail": "http://books.google.com/books/content?id=…&zoom=1&edge=curl&…"
    }
  }
}
```

## Mapping

| Champ NormalizedMeta | Source brute |
|----------------------|--------------|
| `title` | `volumeInfo.title` |
| `series` | parse `seriesInfo.shortSeriesBookTitle` / titre (`Vol. N`, `Title 04`, `—`) |
| `volume` | `seriesInfo.bookDisplayNumber` **ou** parse titre |
| `authors` | `volumeInfo.authors[]` |
| `year` | année de `volumeInfo.publishedDate` |
| `synopsis` | `volumeInfo.description` (≤ 600) |
| `coverUrl` | meilleur `imageLinks.*` → https + `zoom=3` − `edge=curl` ; **null** si absent |
| `provider` | `"googlebooks"` |
| `providerId` | `id` |
| `confidence` | `0.75` |

## Cover

- http → https ; protocol-relative → https
- upgrade zoom à 3 ; retire `edge=curl`
- **Aucun placeholder** inventé si `imageLinks` manquant

## Pagination

`startIndex` (0-based) + `maxResults` max **40** ; `totalItems` pour `hasMore`.
