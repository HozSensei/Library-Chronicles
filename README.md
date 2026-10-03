# Vertical Deck Reader (VDR)

Lecteur de BD, comics et mangas **vertical**, pensé manette pour **ROG Ally X** (Windows, portrait).

**Electron + Vue 3 + Vite + Pinia** — *Library Chronicles*.

## Démarrage

```bash
npm install
npm run dev
```

Build / preview :

```bash
npm run build
npm start
```

Fenêtre cible : **1080 × 1920** (portrait).

## Stack front (UX)

Pour une interface léchée et une UX console irréprochable :

| Couche | Techno |
|--------|--------|
| UI | Vue 3 (Composition API) |
| Bundler | Vite (`electron-vite`) |
| État | Pinia |
| Routes | Vue Router |
| Manette | Composable `useGamepad` (rAF) |

Détails des principes UI/UX : [`docs/UX.md`](./docs/UX.md).

## Documentation

| Fichier | Contenu |
|---------|---------|
| [`ROADMAP.md`](./ROADMAP.md) | Phases & critères de done |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Main / preload / renderer |
| [`docs/CONTROLS.md`](./docs/CONTROLS.md) | Mapping manette |
| [`docs/UX.md`](./docs/UX.md) | Principes UX & direction visuelle |

## Structure

```
src/
  main/           # Electron main (FS, extracteurs, DB, IPC)
  preload/        # contextBridge → window.vdr
  renderer/       # App Vue (vues, stores, composables)
  shared/         # IPC + mapping contrôles
```

## État

Phase 0 : squelette + **socle Vue** + UI boot soignée.  
Suite : Phase 1 — CBZ réel + pan / zoom / pages manette.
