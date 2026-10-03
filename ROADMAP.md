# Vertical Deck Reader (VDR) — Plan des fonctionnalités

Document de cadrage opérationnel pour **Library Chronicles / Vertical Deck Reader**.  
Lecteur BD · Comics · Manga en mode portrait, optimisé manette (ROG Ally X).

---

## Vision

Application Electron légère qui relie une ergonomie manette naturelle à la lecture de formats compressés (CBZ/CBR/PDF/ZIP), avec **setup initial**, **import guidé**, **thèmes**, et **remapping des touches**.

---

## Architecture cible

```
Renderer                          Main (Electron)
─────────────────────             ─────────────────────────────
Setup / Import / Settings ──IPC──► Config + secrets (userData)
Gamepad (remap→bindings)  ──IPC──► Extractors (ZIP / RAR / PDF)
Moteur de rendu (CSS GPU) ──IPC──► SQLite (+ fallback JSON)
Bibliothèque / HUD        ──IPC──► Import + metadata providers
```

| Couche | Rôle |
|--------|------|
| `src/main` | Fenêtre, IPC, extraction, SQLite, import, metadata |
| `src/preload` | Bridge sécurisé `contextBridge` |
| `src/renderer` | Vue 3 + Pinia + Router — UI console-first |
| `src/shared` | IPC, portrait-remap, key-bindings |

Voir [`docs/UX.md`](./docs/UX.md), [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md), [`docs/CONTROLS.md`](./docs/CONTROLS.md).

---

## Mapping manette (référence)

> **Portrait Ally (90° CCW)** puis **mapping utilisateur**.  
> Voir `docs/CONTROLS.md`, `portrait-remap.js`, `key-bindings.js`.

| Contrôle (écran) | Mode Lecture | Mode Bibliothèque |
|----------|--------------|-------------------|
| Stick L | Pan / drag planche | Scroll grille |
| L3 / R3 | Toggle Fit Height ↔ Zoom 100 % | Valider |
| D-Pad Haut / Bas | Zoom ±15 % | Curseur |
| D-Pad Gauche / Droite | Page ±1 | Catégorie |
| A | Sens Occidental ↔ Manga | Ouvrir album |
| B | Fermer livre → bibliothèque | Retour menu |
| X | Fit Width | Ouvrir Import |
| Y | Overlay options | Options |
| Start | — | Paramètres |
| LT / RT | Chapitre ±1 | Filtre ±1 |

---

## Phases

### Phase 0 — Squelette *(fait)*

- [x] Electron + Vue 3 + Pinia + Router
- [x] Fenêtre portrait 1080×1920
- [x] Remap manette portrait 90° CCW
- [x] UI boot console-first

### Phase Setup & préférences *(nouveau — fait)*

- [x] Wizard premier lancement (`setupCompleted`)
- [x] Dossiers library / import, langue, thème, orientation
- [x] Thème sombre / clair (tokens CSS + persistance)
- [x] Remapping touches (UI settings + persistance)
- [x] Intégration gamepad : remap orientation → bindings user

### Phase 1 — MVP lecteur *(fait)*

- [x] CBZ/ZIP réel via JSZip (pages triées, getPage)
- [x] Fit Height, pan stick (`translate3d`), zoom D-Pad ±15 %, toggle L3
- [x] Pages D-Pad (avec remap portrait)

### Phase 2 — Lecteur complet *(fait / partiel)*

- [x] CBR (`node-unrar-js`)
- [x] PDF (`pdfjs-dist`) — rendu canvas si dispo, placeholder sinon
- [x] Mode Manga LTR/RTL (A)
- [x] Overlay HUD (Y)
- [x] Fit Width (X)
- [x] LT/RT chapitres si structure dossiers détectée

### Phase 3 — Bibliothèque & import *(fait)*

- [x] SQLite `better-sqlite3` (+ fallback JSON si natif KO)
- [x] Grille couvertures, progression, Continuer, statuts
- [x] Flux import (scan → review métadonnées → commit)
- [x] Provider métadonnées pluggable (stub + ComicVine câblé)

### Phase 4 — Polish *(reporté / partiel)*

- [ ] Watcher FS
- [ ] Packaging Windows
- [ ] Haptics Ally
- [x] Notes rebuild native / fallback documentées

---

## Flux produit cible

```
Setup (1ʳᵉ fois)
  → Boot
  → Import (dossier import → métadonnées → bibliothèque)
  → Bibliothèque (grille / Continuer)
  → Lecteur (CBZ/CBR/PDF + manette)
  → Paramètres (thème / remap / clé API)
```

---

## Stack

| Besoin | Choix |
|--------|--------|
| Shell | Electron |
| Archives ZIP/CBZ | JSZip |
| Archives RAR/CBR | node-unrar-js |
| PDF | pdfjs-dist |
| DB | better-sqlite3 (fallback JSON) |
| Rendu zoom/pan | CSS transform GPU |
| Métadonnées | stub + ComicVine (clé en userData) |

---

## Conventions

- **Main** : Node, FS, extracteurs, DB, secrets
- **Renderer** : UI / Gamepad ; pas d’accès FS direct
- **IPC** : `src/shared/ipc-channels.js`
- Secrets API : `userData/vdr-secrets.json` (chmod 600 si possible), jamais dans le repo
