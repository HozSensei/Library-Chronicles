# Stub local — offline → NormalizedMeta

- **Réseau** : aucun
- **Clé** : non
- **Provider** : `src/main/metadata/providers/stub.js`
- **Construction** : `createNormalizedMeta` directement (pas de raw API distant)

## Comportement

À partir de la query (+ `detectFromFilename`) :

1. Résultat principal — confidence `0.5`, cover `null`
2. Variante « édition collector » — confidence `0.35`, cover `null`

## Mapping

| Champ | Valeur |
|-------|--------|
| `title` / `series` / `volume` / `year` | parse filename / query |
| `authors` | `['Auteur (stub)']` / `['Studio (stub)']` |
| `synopsis` | texte d’aide UI |
| `coverUrl` | toujours `null` |
| `provider` | `"stub"` |
| `providerId` | `` `${slug(q)}:1` `` / `:2` |

Utilisé aussi comme **fallback soft** quand un provider live échoue ou n’a pas de clé (note ajoutée dans synopsis/description).
