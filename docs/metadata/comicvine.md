# ComicVine — réponse search → NormalizedMeta

- **Endpoint** : `GET https://comicvine.gamespot.com/api/search/?api_key=…&format=json&resources=volume,issue&query=…&limit=100&offset=…`
- **Clé** : requise (`COMICVINE_API_KEY` en probe ; Settings en app)
- **Docs** : [ComicVine API](https://comicvine.gamespot.com/api/)
- **Mapper** : `src/main/metadata/mappers/comicvine.js` → `mapComicVineItem`
- **Fixture** : `src/main/metadata/fixtures/comicvine-batman-1.json`

## Exemple brut (`results[]` issue)

```json
{
  "id": 40569,
  "name": "Batman #1",
  "issue_number": "1",
  "cover_date": "2011-11-01",
  "deck": "A New York Times Best Seller!",
  "description": "<p>A court of owls has risen.</p>",
  "volume": { "name": "Batman" },
  "image": {
    "medium_url": "http://comicvine.gamespot.com/a/uploads/scale_medium/…/01.jpg",
    "small_url": "http://comicvine.gamespot.com/a/uploads/scale_small/…/01.jpg"
  }
}
```

## Mapping

| Champ NormalizedMeta | Source brute |
|----------------------|--------------|
| `title` | `name` → `volume.name` |
| `series` | `volume.name` → `name` |
| `volume` | `issue_number` parsé ; **pas** `count_of_issues` (total série) |
| `authors` | `[]` (search ne renvoie pas les credits fiables) |
| `year` | `start_year` ou `cover_date` |
| `synopsis` | `deck` → `description` (HTML stripé) |
| `coverUrl` | `image.medium_url` → `small_url` → `thumb_url` → `original_url` (https) |
| `provider` | `"comicvine"` |
| `providerId` | `id` |
| `confidence` | `0.8` |

## Cover

http → https via `absoluteHttpsCoverUrl` / `pickComicVineCover`.

## Pagination

`offset` + `limit` max **100** ; `number_of_total_results`.
