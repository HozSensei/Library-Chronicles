# AniList — réponse GraphQL → NormalizedMeta

- **Endpoint** : `POST https://graphql.anilist.co`
- **Clé** : non (public)
- **Docs** : [docs.anilist.co](https://docs.anilist.co/)
- **Mapper** : `src/main/metadata/mappers/anilist.js` → `mapAnilistItem`
- **Fixture** : `src/main/metadata/fixtures/anilist-one-piece.json`

## Query (extrait)

```graphql
media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
  id
  title { romaji english native }
  volumes
  startDate { year }
  description(asHtml: false)
  coverImage { large medium }
  staff(sort: RELEVANCE, perPage: 4) {
    edges { role node { name { full } } }
  }
}
```

## Exemple brut (media)

```json
{
  "id": 101759,
  "title": { "romaji": "One Piece", "english": "One Piece", "native": "ワンピース" },
  "volumes": 109,
  "startDate": { "year": 1997 },
  "description": "Gol D. Roger was known as the Pirate King...",
  "coverImage": {
    "large": "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/….jpg"
  },
  "staff": {
    "edges": [{ "role": "Story & Art", "node": { "name": { "full": "Eiichiro Oda" } } }]
  }
}
```

## Mapping

| Champ NormalizedMeta | Source brute |
|----------------------|--------------|
| `title` | `title.english` → `romaji` → `native` |
| `series` | `title.romaji` → `english` → title |
| `volume` | **toujours `null`** — `volumes` = total série, pas le tome courant |
| `authors` | staff edge role Story/Author/… → `node.name.full` |
| `year` | `startDate.year` |
| `synopsis` | `description` (HTML stripé) |
| `coverUrl` | `coverImage.large` → `medium` (https / `//` → https) |
| `provider` | `"anilist"` |
| `providerId` | `id` (stringifié) |
| `confidence` | `0.85` |

## Pagination

`Page(page, perPage)` max **50** ; `pageInfo.hasNextPage` / `total`.
