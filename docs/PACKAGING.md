# Packaging Windows — Library Chronicles

Cible principale : **ROG Ally X** (Windows 11, x64).

## Prérequis

Sur la machine de **build Windows** (recommandé) :

- Node ≥ 22.12.0 (exigence Electron ≥ 41 ; voir [`SECURITY.md`](./SECURITY.md))
- Visual Studio Build Tools (C++ / Desktop) pour compiler `better-sqlite3`
- `npm install` puis rebuild natif Electron
- Compte GitHub avec droit de push/release sur `HozSensei/Library-Chronicles`
- Pour publier : `GH_TOKEN` (ou login `gh`) avec scope `repo`

```bash
npm install
npm run rebuild:native   # recommandé avant dist (postinstall est soft / non bloquant)
npm run build
npm run dist:win
```

`predist` / `predist:win` relancent automatiquement `rebuild:native` avant le packaging.

### Cloud Agent / Linux

Le cross-build Linux → Windows **n’est pas fiable** :

1. `better-sqlite3` est reconstruit en **ELF Linux** même dans `dist/win-unpacked` (ABI incompatible Ally).
2. La finalisation NSIS exige **Wine** (`spawn wine ENOENT` si absent) → l’`.exe` produit peut être un stub incomplet (~200 Ko), **pas** un installeur réel.
3. Ne **jamais** publier / installer ces artefacts cloud sur l’Ally.

**Source de vérité :** builder sur **PC Windows x64** ou sur l’**Ally** (`npm run dist:win`), puis Release GitHub.

Exemple d’échec observé (agent Linux, 2026-10) :

```
⨯ wine process failed ENOENT
file better_sqlite3.node: ELF 64-bit LSB shared object (Linux)
```

## Scripts

| Script | Résultat |
|--------|----------|
| `npm run rebuild:native` | Installe `better-sqlite3` si absent, puis rebuild pour Electron |
| `npm run dist` / `npm run dist:win` | Rebuild natif + build + installeur **NSIS** + **portable** → `dist/` |
| `npm run dist:dir` / `npm run pack` | Décompressé (smoke test sans installeur) |

Artefacts typiques :

- `Library Chronicles-<version>-win-x64.exe` — setup NSIS
- `Library Chronicles-<version>-portable.exe` — portable
- `latest.yml` / `*.blockmap` — métadonnées **electron-updater** (nécessaires pour l’auto-update)

## Configuration electron-builder

Déclarée dans `package.json` → clé `"build"` :

- `appId` : `com.librarychronicles.app`
- `productName` / raccourci : **Library Chronicles**
- Icônes : `build/icon.png` (1024), `build/icon.ico` (Win), `build/icon.icns` (macOS)
- Cibles Win : `nsis` + `portable` (x64)
- `asarUnpack` : `**/*.{node,dll}` + `**/better-sqlite3/**/*`
- `npmRebuild: true` au packaging (filet de sécurité)
- `publish` : GitHub `HozSensei/Library-Chronicles` (provider pour Releases + updater)

## Auto-update (electron-updater)

Implémentation :

- Dépendance runtime `electron-updater`
- Check au boot (~4 s après fenêtre) **uniquement si packagé**
- Toasts UI FR/EN (`toast.update*`)
- Provider GitHub Releases ; `autoDownload` + `autoInstallOnAppQuit`
- IPC : `update:check`, `update:quit-and-install`, push `update:status`

Smoke Ally : voir section auto-update dans [`ALLY-SMOKE.md`](./ALLY-SMOKE.md).

## Tag + Release GitHub (machine Win, après smoke Ally OK)

Ne tagger `v0.1.0` **que** si `main` est stable, smoke Ally packagée OK, et branding présent.

```bash
# 1) Sur main à jour
git checkout main
git pull origin main

# 2) Build Win
npm ci
npm run dist:win

# 3) Tag annoté
git tag -a v0.1.0 -m "Library Chronicles v0.1.0"
git push origin v0.1.0

# 4) Release avec binaires + latest.yml (depuis dist/)
gh release create v0.1.0 \
  --title "Library Chronicles v0.1.0" \
  --notes "First packaged Ally release." \
  "dist/Library Chronicles-0.1.0-win-x64.exe" \
  "dist/Library Chronicles-0.1.0-portable.exe" \
  dist/latest.yml \
  dist/*.blockmap
```

Alternative publish intégré (si `GH_TOKEN` exporté) :

```bash
export GH_TOKEN=ghp_…
npx electron-builder --win --publish always
```

Pour une release suivante (`v0.1.1`) : bumper `package.json` `version`, rebuild, tag, upload — l’app `v0.1.0` détectera la mise à jour au prochain boot.

## better-sqlite3 & crash

1. Toujours rebuild **avant** `dist:win` sur Windows (`npm run rebuild:native`).
2. Si le `.node` est absent / ABI incompatible au runtime → **fallback JSON** automatique (`userData/vdr-library.json`) — l’app **ne crash pas** (voir [`NATIVE.md`](./NATIVE.md)).
3. Cross-build Linux→Win : possible via Wine mais **fragile** pour les modules natifs ; préférer un PC Windows (ou la Ally) pour le build fidèle.

## Checklist post-packaging (Ally)

Checklist exécutable détaillée : [`ALLY-SMOKE.md`](./ALLY-SMOKE.md).

Résumé :

- [ ] Démarrage app (SQLite **ou** message fallback JSON dans les logs)
- [ ] Ouverture CBZ / CBR
- [ ] PDF (rendu Chromium offscreen)
- [ ] EPUB
- [ ] Import + watcher (ajout fichier → refresh)
- [ ] Manette / haptics
- [ ] Quit / relance : progression & profils

## Notes

- Favicon renderer : `src/renderer/public/favicon.png` + teinte dynamique (`useBrandFavicon`) selon `profile.color`.
- Wordmark UI : `AppBrandLogo` ← `library-chronicles-logo.png`.
- Marque « C » teintable : `AppBrandMark` (mask CSS sur `library-chronicles-mark-glyph.png`).
- Path SVG calligraphique pur : non fourni (masque PNG embarqué dans `library-chronicles-mark.svg`).
- PDF & natifs : [`NATIVE.md`](./NATIVE.md).
- Plan ship : [`PLAN-v0.1.md`](./PLAN-v0.1.md).
