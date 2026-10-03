# Architecture — Vertical Deck Reader

## Processus

```
┌────────── Renderer (Vue 3) ──────────┐   IPC    ┌────────── Main ──────────┐
│ Setup / Boot / Library / Import      │ ───────► │ extractors/ CBZ CBR PDF  │
│ Settings / Reader                    │ ◄─────── │ database/ SQLite|JSON    │
│ Pinia  ui · reader · library · import│          │ library/ scan+import     │
│ useGamepad  remap → key-bindings     │          │ metadata/ stub|comicvine │
│ CSS GPU  translate3d / scale         │          │ config + secrets userData│
└──────────────────────────────────────┘          └──────────────────────────┘
         ▲
         │ contextBridge
┌────────┴────────┐
│ preload         │  → window.vdr.*
└─────────────────┘
```

Build unifié via **electron-vite** :

- `npm run dev` — main + preload + renderer (HMR Vue)
- `npm run build` → `out/`
- `npm start` — preview du build

## Dossiers

| Chemin | Responsabilité |
|--------|----------------|
| `src/main/` | Cycle de vie, IPC, extracteurs, DB, import, metadata |
| `src/preload/` | API `window.vdr` |
| `src/renderer/src/views/` | Setup, Boot, Library, Import, Settings, Reader |
| `src/renderer/src/stores/` | Pinia |
| `src/shared/` | IPC, portrait-remap, key-bindings, gamepad-codes |

## Flux produit

1. **Setup** (si `!setupCompleted`) → dossiers / thème / orientation
2. **Import** → scan dossier import → review meta → copie library + SQLite
3. **Library** → grille + Continuer
4. **Reader** → `open` → `getPage` → blob URL + transforms GPU
5. **Settings** → thème, remapping, clé API

## Sécurité

- `contextIsolation: true`, `nodeIntegration: false`
- Pas d’accès FS depuis Vue ; tout passe par IPC
- Clés API dans `vdr-secrets.json` (hors repo)

## Tests

- `npm run test:remap` — portrait-remap + bindings + parse filename
- `npm run test:cbz` — extracteur CBZ minimal
