# Architecture — Vertical Deck Reader

## Processus

```
┌────────── Renderer (Vue 3) ──────────┐   IPC    ┌────────── Main ──────────┐
│ Setup / Boot / Library / Import      │ ───────► │ extractors/ CBZ CBR PDF  │
│ Settings / Reader                    │ ◄─────── │ database/ SQLite|JSON    │
│ Pinia  ui · reader · library · import│          │ library/ scan+import     │
│ useGamepad  remap → key-bindings     │          │ library/ watcher FS      │
│ CSS GPU  translate3d / scale         │          │ metadata/ stub|comicvine │
└──────────────────────────────────────┘          │ pdf-electron-canvas      │
         ▲                                        │ config + secrets userData│
         │ contextBridge                          └──────────────────────────┘
┌────────┴────────┐
│ preload         │  → window.vdr.* (+ watch events)
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
| `src/main/extractors/pdf-electron-canvas.js` | Rendu PDF fidèle via Chromium |
| `src/preload/` | API `window.vdr` |
| `src/renderer/src/views/` | Setup, Boot, Library, Import, Settings, Reader |
| `src/renderer/src/stores/` | Pinia |
| `src/shared/` | IPC, portrait-remap, key-bindings, gamepad-codes |

## Flux produit

1. **Setup** (si `!setupCompleted`) → dossiers / thème / orientation
2. **Import** → scan dossier import → review meta → copie library + SQLite
3. **Library** → grille + Continuer (+ refresh auto via watcher)
4. **Reader** → `open` → `getPage` → blob URL + transforms GPU
5. **Settings** → thème, remapping, clé API

## Watcher FS

`src/main/library/watcher.js` surveille `libraryRoot` et `importRoot` (`fs.watch` + debounce).  
Événements push : `watch:library-changed` / `watch:import-changed` → le renderer rescane.

## Sécurité

- `contextIsolation: true`, `nodeIntegration: false` (fenêtre principale)
- Pas d’accès FS depuis Vue ; tout passe par IPC
- Clés API dans `vdr-secrets.json` (hors repo)
- Fenêtre PDF offscreen : `webSecurity: false` uniquement pour charger pdfjs/`file://` locaux

## Tests

- `npm run test:remap` — portrait-remap + bindings + parse filename
- `npm run test:cbz` — extracteur CBZ minimal
- `npm run test:pdf` — extracteur PDF (placeholder hors Electron)
