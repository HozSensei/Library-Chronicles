# Architecture — Vertical Deck Reader

## Processus

```
┌──────────── Renderer ────────────┐     IPC      ┌────────── Main ──────────┐
│ GamepadLoop (rAF 60/120)         │ ───────────► │ extractors/ (cbz,cbr,pdf)│
│ ReaderEngine (translate3d/scale) │ ◄─────────── │ database/ (SQLite)       │
│ LibraryUI + FocusNav             │              │ library/ scanner+thumbs  │
│ screens: boot | library | reader │              │ config.json userData     │
└──────────────────────────────────┘              └──────────────────────────┘
         ▲
         │ contextBridge
┌────────┴────────┐
│ preload/index.js│  → window.vdr.*
└─────────────────┘
```

## Dossiers

| Chemin | Responsabilité |
|--------|----------------|
| `src/main/index.js` | Cycle de vie app + fenêtre 1080×1920 |
| `src/main/ipc/*` | Handlers `ipcMain.handle` |
| `src/main/extractors/*` | Ouverture livres → pages binaires |
| `src/main/database/*` | Schéma & requêtes progression |
| `src/main/library/*` | Scan dossier + cache covers |
| `src/preload/index.js` | API `window.vdr` |
| `src/renderer/js/gamepad.js` | Polling manette + edges boutons |
| `src/renderer/js/reader-engine.js` | Zoom, pan, pages, sens lecture |
| `src/renderer/js/library-ui.js` | Grille bibliothèque |
| `src/shared/ipc-channels.js` | Noms des canaux |
| `src/shared/controls.js` | Mapping actions / boutons |

## Flux lecture (cible Phase 1)

1. Renderer : `vdr.reader.open(path)`
2. Main : `openBook` → extracteur CBZ (JSZip) → session en mémoire
3. Renderer : `vdr.reader.getPage(i)` → base64 / buffer → `blob:` URL
4. `ReaderEngine` applique Fit Height + `translate3d` pour le pan joystick

## Flux bibliothèque (cible Phase 3)

1. `library.selectRoot` → dialog dossier
2. `library.scan` → walk FS + miniatures + upsert SQLite
3. `library.list` → grille focus manette
4. Ouverture tome → lecteur + `progress.load` pour reprise

## Sécurité

- `contextIsolation: true`, `nodeIntegration: false`
- Pas d’accès FS depuis le renderer
- Tout I/O fichier passe par IPC

## Marqueurs TODO

Rechercher `TODO[Phase N]` dans le code pour les points d’implémentation restants.
