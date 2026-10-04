# Library Chronicles

**Gamepad-first comics · manga · EPUB reader for ROG Ally / SteamOS-like handhelds.**

Menus in landscape · reading in portrait (automatic window switch).  
Built with **Electron + Vue 3 + Vite + Pinia + Tailwind**. Historical code name: *VDR* (Vertical Deck Reader).

[Français ↓](#library-chronicles-fr)

---

## Why this project?

Desktop comic readers assume a mouse, a landscape monitor, and keyboard shortcuts. Handheld PCs like the **ROG Ally** need something else: D-Pad and sticks first, portrait reading, short paths from catalog to page.

**Library Chronicles** fills that gap — a local library and reader designed around the controller, not a desktop app with gamepad bolted on. No OPDS, no cloud sync, no accounts: your files, your profiles, your Ally.

---

## Features

- **Gamepad-first UX** — focus navigation, portrait remap in the reader, optional remapping in Settings, Ally haptics when available
- **Orientation** — landscape menus (1920×1080) · portrait reading (1080×1920), with optional landscape reading mode
- **Local profiles** — avatar / color, per-profile library paths, progress, bookmarks, theme & language
- **TV-style catalog** — Continue hero, recent adds, all books grid, series view
- **Guided import** — scan folder → metadata review → commit; already-imported check; FS watcher
- **Metadata providers** — Open Library, AniList, MangaDex (no key) · ComicVine, Google Books (user API key in `userData`)
- **Reader** — page mode, vertical strip, EPUB reflow · zoom / pan · Fit Width · Western ↔ manga · bookmarks · CSS reading filters
- **Branding** — Library Chronicles wordmark & product packaging name

## Formats

| Format | Notes |
|--------|--------|
| **CBZ / ZIP** | Image archives (JSZip) |
| **CBR / RAR** | via `node-unrar-js` |
| **PDF** | pdf.js + Chromium canvas |
| **EPUB** | epub.js viewport pagination + OPF spine |

MOBI is not supported (possible later on request). Network libraries / OPDS are out of scope.

## Stack

| Layer | Choice |
|-------|--------|
| Shell | Electron |
| UI | Vue 3 + Tailwind CSS |
| Bundler | electron-vite (Vite) |
| State / routes | Pinia · Vue Router |
| Gamepad | `useGamepad` (ui / reader contexts) |
| DB | better-sqlite3 (+ JSON fallback) |
| Packaging | electron-builder (NSIS + portable, Win x64) |

## Quick start

**Node ≥ 22.12.0** required. Dependency security: [`docs/SECURITY.md`](./docs/SECURITY.md).

```bash
npm install
npm run dev
```

Build / tests / run preview:

```bash
npm run build
npm test
npm start
```

Windows package (on a **Windows x64** machine):

```bash
npm run dist:win
```

See [`docs/PACKAGING.md`](./docs/PACKAGING.md).

### First launch

1. **Profiles** — pick or create a profile  
2. **Setup** — library / import folders, theme, language (per profile)  
3. **Library** → **Import** (CBZ/CBR/PDF/EPUB) → open a book  

### Library reset

```bash
npm run reset:library          # wipe books, progress, covers (profiles kept)
npm run reset:app              # + replay setup flags
npm run reset:app -- --all     # everything: profiles, config, secrets, DB, covers
```

Override userData: `VDR_USER_DATA=/path npm run reset:library`.

### Native module (better-sqlite3)

`postinstall` is soft and never blocks. If SQLite fails to load in Electron:

1. Install Windows C++ Build Tools  
2. `npm run rebuild:native`  
3. Otherwise the app falls back to JSON automatically  

Details: [`docs/NATIVE.md`](./docs/NATIVE.md).

## Screenshots

> Placeholders — add Ally / UI captures under `docs/screenshots/` when available.

| Library | Reader | Import |
|---------|--------|--------|
| _TBD_ | _TBD_ | _TBD_ |

## Roadmap & plan

| Doc | Content |
|-----|---------|
| [`ROADMAP.md`](./ROADMAP.md) | Shipped phases (0–7), architecture, controls |
| **[`docs/PLAN-v0.1.md`](./docs/PLAN-v0.1.md)** | **Next actions:** Ally packaged smoke → tag `v0.1.0` → auto-update + SQL migrations |

## Documentation

| File | Topic |
|------|--------|
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Main / preload / renderer |
| [`docs/CONTROLS.md`](./docs/CONTROLS.md) | Gamepad mapping + remap |
| [`docs/UX.md`](./docs/UX.md) | SteamOS-inspired UX principles |
| [`docs/METADATA.md`](./docs/METADATA.md) | Metadata providers & secrets |
| [`docs/metadata/README.md`](./docs/metadata/README.md) | NormalizedMeta contract |
| [`docs/PACKAGING.md`](./docs/PACKAGING.md) | Windows build + tag/Release + auto-update |
| [`docs/ALLY-SMOKE.md`](./docs/ALLY-SMOKE.md) | Ally packaged smoke checklist |
| [`docs/PERF.md`](./docs/PERF.md) | Performance notes |
| [`docs/SECURITY.md`](./docs/SECURITY.md) | npm audit / Electron |

## License

MIT — see `package.json` (`"license": "MIT"`).

---

<a id="library-chronicles-fr"></a>

# Library Chronicles (FR)

**Lecteur BD · comics · manga · EPUB pensé manette pour ROG Ally / machines type SteamOS.**

Menus en **paysage** · lecture en **portrait** (bascule automatique de la fenêtre).  
Stack : **Electron + Vue 3 + Vite + Pinia + Tailwind**. Nom de code historique : *VDR*.

## Pourquoi ce projet ?

Les lecteurs comics « bureau » supposent souris, écran paysage et raccourcis clavier. Sur un **ROG Ally**, il faut autre chose : D-Pad et sticks d’abord, lecture portrait, chemin court du catalogue à la page.

**Library Chronicles** comble ce manque — une bibliothèque et un lecteur locaux conçus pour la manette, pas un clone desktop avec pad en option. Pas d’OPDS, pas de sync cloud, pas de comptes : vos fichiers, vos profils, votre Ally.

## Fonctionnalités

- **UX manette** — focus, remap portrait en lecture, remapping Settings, haptics Ally si dispo
- **Orientation** — menus 1920×1080 · lecture 1080×1920 (mode landscape optionnel)
- **Profils locaux** — avatar / couleur, chemins & progression & signets par profil
- **Catalogue type TV** — héro Continuer, ajouts récents, grille, séries
- **Import guidé** — scan → méta → commit ; déjà importé ; watcher FS
- **Métadonnées** — Open Library, AniList, MangaDex · ComicVine & Google Books (clé API)
- **Lecteur** — page, strip vertical, EPUB reflow · zoom / pan · Fit Width · Occidental ↔ manga · signets · filtres
- **Marque** — wordmark Library Chronicles & `productName` packaging

## Formats

CBZ/ZIP · CBR/RAR · PDF · EPUB. Pas de MOBI pour l’instant. Pas de bibliothèque réseau / OPDS.

## Démarrage rapide

Prérequis : **Node ≥ 22.12.0**. Sécurité deps : [`docs/SECURITY.md`](./docs/SECURITY.md).

```bash
npm install
npm run dev
```

```bash
npm run build
npm test
npm start
```

Packaging Windows (machine **Win x64**) :

```bash
npm run dist:win
```

Voir [`docs/PACKAGING.md`](./docs/PACKAGING.md).

Au **premier lancement** : profils → setup (dossiers / thème / langue) → bibliothèque → import → lire.

### Reset bibliothèque

```bash
npm run reset:library
npm run reset:app
npm run reset:app -- --all
```

Override : `VDR_USER_DATA=/chemin npm run reset:library`.

### better-sqlite3

`postinstall` soft. Si le module manque : Build Tools Windows → `npm run rebuild:native` → sinon fallback JSON. Voir [`docs/NATIVE.md`](./docs/NATIVE.md).

## Captures d’écran

> Placeholders — ajouter des captures Ally / UI dans `docs/screenshots/` quand disponibles.

## Feuille de route

| Doc | Contenu |
|-----|---------|
| [`ROADMAP.md`](./ROADMAP.md) | Phases livrées (0–7) |
| **[`docs/PLAN-v0.1.md`](./docs/PLAN-v0.1.md)** | **Suite :** smoke Ally packagée → tag `v0.1.0` → auto-update + migrations SQL |
| [`docs/ALLY-SMOKE.md`](./docs/ALLY-SMOKE.md) | Checklist smoke Ally packagée |
| [`docs/PACKAGING.md`](./docs/PACKAGING.md) | Build Win, tag, Release, electron-updater |

## Licence

MIT (`package.json`).
