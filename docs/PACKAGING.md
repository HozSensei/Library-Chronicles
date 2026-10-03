# Packaging Windows — Vertical Deck Reader

Cible principale : **ROG Ally X** (Windows 11, x64).

## Prérequis

```bash
npm install
npm run build
```

Sur la machine de build Windows (recommandé) :

- Node ≥ 20
- `electron-builder` (devDependency)
- Rebuild natif : `npm run rebuild:native` (better-sqlite3 pour Electron)

## Scripts

| Script | Résultat |
|--------|----------|
| `npm run dist` / `npm run dist:win` | Installeur **NSIS** + **portable** dans `dist/` |
| `npm run dist:dir` / `npm run pack` | Décompressé (smoke test sans installeur) |

Artefacts typiques :

- `Vertical Deck Reader-<version>-win-x64.exe` — setup NSIS
- `Vertical Deck Reader-<version>-portable.exe` — portable

## Configuration

Déclarée dans `package.json` → clé `"build"` (electron-builder) :

- `appId` : `com.librarychronicles.verticaldeckreader`
- Cibles Win : `nsis` + `portable` (x64)
- `asarUnpack` : binaires natifs (`better-sqlite3`)
- `npmRebuild: true` au packaging

## Notes Ally / CI

- Le build Windows **fidèle** se fait idéalement **sur Windows**. Cross-build Linux→Win avec Wine est possible mais fragile pour les modules natifs.
- Après packaging, vérifier : démarrage, ouverture CBZ, PDF (rendu Chromium), SQLite ou fallback JSON.
- Pas d’icône custom commitée pour l’instant (`build/` optionnel) — electron-builder utilise l’icône Electron par défaut.

## PDF & natifs

Voir [`NATIVE.md`](./NATIVE.md) : PDF via canvas Chromium (pas de `canvas` natif requis) ; `better-sqlite3` rebuild + fallback JSON.
