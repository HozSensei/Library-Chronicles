# Architecture — Vertical Deck Reader

## Processus

```
┌────────── Renderer (Vue 3) ──────────┐   IPC    ┌────────── Main ──────────┐
│ Vue Router  Boot / Library / Reader  │ ───────► │ extractors/              │
│ Pinia       ui / reader / library    │ ◄─────── │ database/ (SQLite)       │
│ useGamepad  rAF 60/120 Hz            │          │ library/ scanner+thumbs  │
│ CSS GPU     translate3d / scale      │          │ config.json userData     │
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
| `src/main/` | Cycle de vie, IPC, extracteurs, DB |
| `src/preload/` | API `window.vdr` |
| `src/renderer/src/views/` | Écrans Vue |
| `src/renderer/src/stores/` | Pinia |
| `src/renderer/src/composables/` | Gamepad, helpers |
| `src/renderer/src/components/` | Focus, HUD, hints |
| `src/shared/` | Canaux IPC & mapping manette |

## Flux lecture (cible Phase 1)

1. Vue : `readerStore.open(path)` → `vdr.reader.open`
2. Main : extracteur CBZ → session
3. Vue : `getPage` → blob URL → `<img>` + transform GPU

## Sécurité

- `contextIsolation: true`, `nodeIntegration: false`
- Pas d’accès FS depuis Vue ; tout passe par IPC

## Marqueurs TODO

Rechercher `TODO[Phase N]` dans le code.
