# Vertical Deck Reader (VDR) — Plan des fonctionnalités

Document de cadrage opérationnel pour **Library Chronicles / Vertical Deck Reader**.  
Lecteur BD · Comics · Manga en mode portrait, optimisé manette (ROG Ally X).

---

## Vision

Application Electron légère qui relie une ergonomie manette naturelle à la lecture de formats compressés (CBZ/CBR/PDF/ZIP), en fenêtre portrait 1080×1920.

---

## Architecture cible

```
Renderer                          Main (Electron)
─────────────────────             ─────────────────────────────
Gamepad Loop (60/120 Hz)  ──IPC──► Extractors (ZIP / RAR / PDF)
Moteur de rendu (CSS GPU) ──IPC──► SQLite (progression / covers)
UI Bibliothèque / HUD     ──IPC──► FS watcher + cache miniatures
```

| Couche | Rôle |
|--------|------|
| `src/main` | Fenêtre, IPC, extraction, SQLite, scan bibliothèque |
| `src/preload` | Bridge sécurisé `contextBridge` |
| `src/renderer` | **Vue 3 + Pinia + Router** — UI console-first, gamepad, zoom/pan |

Voir aussi [`docs/UX.md`](./docs/UX.md) pour la stratégie front / qualité UX.

---

## Mapping manette (référence)

> **Portrait Ally (90° CCW)** : les directions ci-dessous sont **logiques (écran)**.  
> Physique ↑ = logique ←, etc. Voir `docs/CONTROLS.md` et `src/shared/portrait-remap.js`.

| Contrôle (écran) | Mode Lecture | Mode Bibliothèque |
|----------|--------------|-------------------|
| Stick L | Pan / drag planche | Scroll liste |
| L3 / R3 | Toggle Fit Height ↔ Zoom 100 % | Valider / sélectionner |
| D-Pad Haut / Bas | Zoom ±15 % | Curseur |
| D-Pad Gauche / Droite | Page ±1 | Catégorie |
| A | Sens Occidental ↔ Manga | Ouvrir album |
| B | Fermer livre → bibliothèque | Retour menu |
| Y | Overlay options | Options du livre |
| LT / RT | Chapitre ±1 | Onglet ±1 |

---

## Phases

### Phase 0 — Squelette *(actuel)*

- [x] Projet Electron + structure dossiers
- [x] Fenêtre portrait 1080×1920
- [x] Preload / IPC stubs
- [x] Modules stub : gamepad, reader, library, extractors, database
- [x] Ce plan (`ROADMAP.md`)
- [x] Front **Vue 3 + Vite + Pinia + Vue Router** (`electron-vite`)
- [x] UI boot console-first (marque, focus manette, motion, tokens)
- [x] Remap manette portrait 90° CCW (`portrait-remap.js`)

### Phase 1 — MVP Prototype Gamepad

**Objectif :** prouver que la lecture manette est fluide.

| # | Fonctionnalité | Critère de done |
|---|----------------|-----------------|
| 1.1 | Boucle Gamepad API (polling 60/120 Hz) | Détection ROG Ally / XInput, deadzone |
| 1.2 | Chargement CBZ en dur (chemin config) | Pages = images triées |
| 1.3 | Affichage Fit Height | Image = hauteur écran |
| 1.4 | Pan joystick (CSS `translate3d`) | 60 FPS ressenti |
| 1.5 | Zoom D-Pad ±15 % + toggle L3 | Fit Height ↔ 100 % |
| 1.6 | Pages D-Pad Gauche / Droite | Navigation sans souris |

**Hors scope Phase 1 :** bibliothèque, SQLite, CBR/PDF, overlay Y.

### Phase 2 — Lecteur complet

| # | Fonctionnalité | Critère de done |
|---|----------------|-----------------|
| 2.1 | Support CBR / RAR (`node-unrar-js`) | Ouverture + pages |
| 2.2 | Support PDF (`pdfjs-dist` → canvas) | Rendu page à page |
| 2.3 | Mode Manga (A) | Inversion Gauche/Droite |
| 2.4 | Overlay HUD (Y) | Progression, n° page, sens, retour |
| 2.5 | Fit Width | Scroll vertical joystick pour lire |
| 2.6 | LT / RT chapitres | Si structure multi-chapitre détectée |

### Phase 3 — Bibliothèque & persistance

| # | Fonctionnalité | Critère de done |
|---|----------------|-----------------|
| 3.1 | Choix dossier racine | Dialog + mémorisation |
| 3.2 | Scan récursif `.cbz|.cbr|.pdf|.zip` | Liste à jour |
| 3.3 | Miniatures (1ʳᵉ image) + cache disque | Couvertures affichées |
| 3.4 | SQLite (`better-sqlite3`) | Chemin, titre, cover, progression, last_access |
| 3.5 | Grille focus manette | Navigation console-first |
| 3.6 | Sauvegarde page à la fermeture | Reprise « Continuer » |
| 3.7 | Statuts Non lu / En cours / Terminé | Calcul auto |

### Phase 4 — Polish ROG Ally *(optionnel)*

| # | Fonctionnalité |
|---|----------------|
| 4.1 | Plein écran portrait + gestion DPI Ally |
| 4.2 | Watcher FS (ajouts/suppressions) |
| 4.3 | Thème UI console (focus glow, sans dépendance souris) |
| 4.4 | Packaging Windows (installeur / portable) |
| 4.5 | Raccourcis clavier miroir (dev / fallback) |

---

## Ordre d’implémentation recommandé

```
Phase 1.1 Gamepad  →  1.2 CBZ  →  1.3–1.6 Zoom/Pan/Pages
        ↓
Phase 2 formats + Manga + Overlay
        ↓
Phase 3 bibliothèque + SQLite + Continuer
        ↓
Phase 4 polish & packaging
```

Commencer par le **moteur de lecture + gamepad** avant la bibliothèque : c’est le risque UX principal sur Ally X.

---

## Stack

| Besoin | Choix |
|--------|--------|
| Shell | Electron |
| Archives ZIP/CBZ | JSZip |
| Archives RAR/CBR | node-unrar-js |
| PDF | pdfjs-dist |
| DB | better-sqlite3 |
| Rendu zoom/pan | CSS transform GPU (`translate3d` / `matrix`) |

---

## Conventions code

- **Main** : Node, accès disque, extracteurs lourds, DB.
- **Renderer** : UI, Gamepad, transforms ; pas d’accès FS direct.
- **IPC** : canaux nommés dans `src/shared/ipc-channels.js`.
- Stubs marqués `TODO[Phase X]` pour retrouver rapidement le travail restant.

---

## Prochaine action

Implémenter **Phase 1.1 + 1.2** : boucle gamepad réelle + ouverture d’un CBZ de test.
