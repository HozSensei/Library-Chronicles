# Architecture — Vertical Deck Reader

## Processus

```
┌────────── Renderer (Vue 3) ──────────┐   IPC    ┌────────── Main ──────────┐
│ Setup / Profiles / Boot / Library    │ ───────► │ extractors/ CBZ CBR PDF  │
│ Import / Settings / Reader           │ ◄─────── │ database/ SQLite|JSON    │
│ Pinia  ui · reader · library · …     │          │   books · profiles       │
│ useGamepad  remap → key-bindings     │          │   bookmarks · series     │
│ CSS GPU  translate3d / scale / filter│          │ library/ scan+import     │
└──────────────────────────────────────┘          │ library/ watcher FS      │
         ▲                                        │ metadata/ providers/*    │
         │ contextBridge                          │ pdf-electron-canvas      │
┌────────┴────────┐                               │ config + secrets userData│
│ preload         │  → window.vdr.* (+ watch)     └──────────────────────────┘
└─────────────────┘
```

Build unifié via **electron-vite** :

- `npm run dev` — main + preload + renderer (HMR Vue)
- `npm run build` → `out/`
- `npm start` — preview du build
- `npm run dist:win` — packaging NSIS + portable (`dist/`)

## Dossiers

| Chemin | Responsabilité |
|--------|----------------|
| `src/main/` | Cycle de vie, IPC, extracteurs, DB, import, metadata, watcher |
| `src/main/database/` | books, profiles, bookmarks, series helpers |
| `src/main/extractors/pdf-electron-canvas.js` | Rendu PDF fidèle via Chromium |
| `src/preload/` | API `window.vdr` |
| `src/renderer/src/views/` | Setup, Profiles, Boot, Library, Import, Settings, Reader |
| `src/renderer/src/stores/` | Pinia |
| `src/shared/` | IPC, portrait-remap, key-bindings, gamepad-codes |

## Flux produit

1. **Setup** (si `!setupCompleted`) → dossiers / thème / langue (orientation auto)
2. **Profils** (chaque lancement) → choix profil local actif
3. **Import** → scan dossier import → review meta → copie library + SQLite
4. **Library** → catalogue + vue séries (+ refresh auto via watcher)
5. **Reader** → `open` → `getPage` → blob URL + transforms/filtres GPU (+ webtoon strip)
6. **Settings** → thème, profils, remapping, providers métadonnées (+ clés si besoin)

## Données locales

- SQLite `vdr-library.sqlite` (fallback `vdr-library.json`)
- Tables : `profiles`, `books` (+ `series_id` / `volume`), `reading_progress` (composite profil+livre), `bookmarks`, `profile_prefs`
- Progression / signets / prefs lecture **scopés par profil**
- **Pas de sync cloud**, pas d’OPDS, pas de dossier distant

## Watcher FS

`src/main/library/watcher.js` surveille `libraryRoot` et `importRoot` :

- `fs.watch` récursif + debounce + fenêtre de stabilité ;
- **fallback polling** si watch indisponible ou erreurs répétées.

Événements push : `watch:library-changed` / `watch:import-changed` → le renderer rescane.

## Haptics

`useHaptics.js` + setting `hapticsEnabled` — pulse léger navigation / confirm / changement de route. No-op sans actuator.

## Sécurité

- `contextIsolation: true`, `nodeIntegration: false` (fenêtre principale)
- Pas d’accès FS depuis Vue ; tout passe par IPC
- Clés API dans `vdr-secrets.json` (hors repo)
- Fenêtre PDF offscreen : `webSecurity: false` uniquement pour charger pdfjs/`file://` locaux

## Tests

- `npm run test:remap` — portrait-remap + bindings + parse filename
- `npm run test:cbz` — extracteur CBZ minimal
- `npm run test:pdf` — extracteur PDF (placeholder hors Electron)
- `npm run test:watcher` — snapshot / diff FS (+ présence poll fallback)
- `npm run test:haptics` — no-op / dual-rumble / pulse legacy
- `npm run test:series` — détection série/tome + regroupement + `listRecentSeries`
- `npm run test:series-tome` — routes `/series/:id` + `/book/:id`, nav Récents/Séries
- `npm run test:metadata` — providers méta (stub + parse mock Open Library / AniList / MangaDex / ComicVine / Google Books)
- `npm run test:bounds` — tailles fenêtre portrait 1080×1920 / landscape 1920×1080
