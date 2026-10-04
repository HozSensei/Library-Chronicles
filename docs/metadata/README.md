# Métadonnées — contrat & mappers API

Pipeline unique :

```
raw API response  →  mapper provider  →  NormalizedMeta  →  apply / cover
```

| Couche | Emplacement |
|--------|-------------|
| Contrat + helpers | [`src/shared/normalized-meta.js`](../../src/shared/normalized-meta.js) |
| JSON Schema | [`normalized-meta.schema.json`](./normalized-meta.schema.json) |
| Mappers | [`src/main/metadata/mappers/`](../../src/main/metadata/mappers/) |
| Providers (réseau) | [`src/main/metadata/providers/`](../../src/main/metadata/providers/) |
| Fixtures tests | [`src/main/metadata/fixtures/`](../../src/main/metadata/fixtures/) |
| Apply / jackets | [`src/shared/import-meta.js`](../../src/shared/import-meta.js), [`meta-apply-fields.js`](../../src/shared/meta-apply-fields.js) |
| UI / secrets | [`../METADATA.md`](../METADATA.md) |

## Contrat `NormalizedMeta`

Chaque mapper produit **tous** les champs (voir schéma). Règles critiques :

- `coverUrl` : **https absolu** ou `null` (http → https, `//` → https ; jamais relatif / data:)
- `volume` : tome **courant** uniquement (pas le total de série AniList / ComicVine `count_of_issues`)
- aliases peuplés : `author` = `authors[0]`, `description` = `synopsis`, `source` = `provider`, `id` = `` `${provider}:${providerId}` ``

Helpers : `createNormalizedMeta`, `absoluteHttpsCoverUrl`, `ensureNormalizedMeta`.

IPC : les objets Pinia/Vue sont **sanitized** (`sanitizeForIpc` / `toRaw`) avant
`library.updateBook` / `import.commit` — sinon Electron lève
« An object could not be cloned » (tableaux `authors` réactifs dans `metadata`).

## Debug dump (developer)

En mode dev (`import.meta.env.DEV` / `ELECTRON_IS_DEV=1` / `VDR_META_APPLY_DEBUG=1`),
chaque **Apply** méta écrit un JSON `{ raw, normalized, fieldsSelected, patch }` dans :

- `userData/.debug/meta-apply/`
- `.debug/meta-apply/` (cwd workspace, si `package.json` présent)

Dumps **gitignorés** (`.debug/`).

## Providers (docs réponses API)

| Id | Clé | Mapper | Doc réponse |
|----|-----|--------|-------------|
| `stub` | Non | [`mappers` via `createNormalizedMeta`](./stub.md) | [stub.md](./stub.md) |
| `openlibrary` | Non | `mapOpenLibraryDoc` | [openlibrary.md](./openlibrary.md) |
| `anilist` | Non | `mapAnilistItem` | [anilist.md](./anilist.md) |
| `mangadex` | Non | `mapMangadexItem` | [mangadex.md](./mangadex.md) |
| `comicvine` | **Oui** | `mapComicVineItem` | [comicvine.md](./comicvine.md) |
| `googlebooks` | **Oui** | `mapGoogleBooksItem` | [googlebooks.md](./googlebooks.md) |

## Secrets / probes live

Clés **jamais** commités. Stockage app : `userData/vdr-secrets.json`.

Probes optionnels (env shell uniquement) :

```bash
# Google Books
GOOGLE_BOOKS_API_KEY=xxx npm run probe:googlebooks -- "Solo Leveling"

# Couvertures multi-providers (ComicVine si COMICVINE_API_KEY présent)
COMICVINE_API_KEY=xxx GOOGLE_BOOKS_API_KEY=xxx npm run probe:covers
```

## Tests

```bash
npm run test:meta-mappers
npm run test:metadata
npm run test:import-meta-jacket
npm run test:meta-apply-fields
npm run test:plain-clone
```
