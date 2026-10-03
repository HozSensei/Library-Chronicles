# Packaging Windows — Vertical Deck Reader

Cible principale : **ROG Ally X** (Windows 11, x64).

## Prérequis

Sur la machine de **build Windows** (recommandé) :

- Node ≥ 20
- Visual Studio Build Tools (C++ / Desktop) pour compiler `better-sqlite3`
- `npm install` puis rebuild natif Electron

```bash
npm install
npm run rebuild:native   # recommandé avant dist (postinstall est soft / non bloquant)
npm run build
npm run dist:win
```

`predist` / `predist:win` relancent automatiquement `rebuild:native` avant le packaging.

## Scripts

| Script | Résultat |
|--------|----------|
| `npm run rebuild:native` | Rebuild `better-sqlite3` pour la version Electron du projet |
| `npm run dist` / `npm run dist:win` | Rebuild natif + build + installeur **NSIS** + **portable** → `dist/` |
| `npm run dist:dir` / `npm run pack` | Décompressé (smoke test sans installeur) |

Artefacts typiques :

- `Vertical Deck Reader-<version>-win-x64.exe` — setup NSIS
- `Vertical Deck Reader-<version>-portable.exe` — portable

## Configuration electron-builder

Déclarée dans `package.json` → clé `"build"` :

- `appId` : `com.librarychronicles.verticaldeckreader`
- Cibles Win : `nsis` + `portable` (x64)
- `asarUnpack` : `**/*.{node,dll}` + `**/better-sqlite3/**/*`
- `npmRebuild: true` au packaging (filet de sécurité)

## better-sqlite3 & crash

1. Toujours rebuild **avant** `dist:win` sur Windows (`npm run rebuild:native`).
2. Si le `.node` est absent / ABI incompatible au runtime → **fallback JSON** automatique (`userData/vdr-library.json`) — l’app **ne crash pas** (voir [`NATIVE.md`](./NATIVE.md)).
3. Cross-build Linux→Win : possible via Wine mais **fragile** pour les modules natifs ; préférer un PC Windows (ou la Ally) pour le build fidèle.

## Checklist post-packaging (Ally)

- [ ] Démarrage app (SQLite **ou** message fallback JSON dans les logs)
- [ ] Ouverture CBZ / CBR
- [ ] PDF (rendu Chromium offscreen)
- [ ] Import + watcher (ajout fichier → refresh)
- [ ] Haptics Paramètres → Vibrations (si manette détectée)

## Notes

- Pas d’icône custom commitée pour l’instant (`build/` optionnel).
- PDF & natifs : [`NATIVE.md`](./NATIVE.md).
