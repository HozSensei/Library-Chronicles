# Vertical Deck Reader (VDR) — Plan des fonctionnalités

Document de cadrage opérationnel pour **Library Chronicles / Vertical Deck Reader**.  
Lecteur BD · Comics · Manga en mode portrait, optimisé manette (ROG Ally X).

---

## Vision

Application Electron légère qui relie une ergonomie manette naturelle à la lecture de formats compressés (CBZ/CBR/PDF/ZIP), avec **setup initial**, **import guidé**, **thèmes**, **profils locaux** et **remapping des touches**.  
**Pas de fonctionnalités réseau** (pas d’OPDS, pas de dossier distant).

---

## Architecture cible

```
Renderer                          Main (Electron)
─────────────────────             ─────────────────────────────
Setup / Profils / Import ──IPC──► Config + secrets (userData)
Gamepad (remap→bindings)  ──IPC──► Extractors (ZIP / RAR / PDF)
Moteur de rendu (CSS GPU) ──IPC──► SQLite (+ fallback JSON)
Bibliothèque / HUD        ──IPC──► Import + metadata + FS watch
```

| Couche | Rôle |
|--------|------|
| `src/main` | Fenêtre, IPC, extraction, SQLite, import, metadata, watcher, profils |
| `src/preload` | Bridge sécurisé `contextBridge` |
| `src/renderer` | Vue 3 + Pinia + Router — UI console-first |
| `src/shared` | IPC, portrait-remap, key-bindings |

Voir [`docs/UX.md`](./docs/UX.md), [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md), [`docs/CONTROLS.md`](./docs/CONTROLS.md), [`docs/PACKAGING.md`](./docs/PACKAGING.md).

---

## Mapping manette (référence)

> **Portrait Ally (90° CCW)** puis **mapping utilisateur**.  
> Voir `docs/CONTROLS.md`, `portrait-remap.js`, `key-bindings.js`.

| Contrôle (écran) | Mode Lecture | Mode Bibliothèque |
|----------|--------------|-------------------|
| Stick L | Pan / scroll webtoon | Scroll grille |
| L3 / R3 | Toggle Fit Height ↔ Zoom 100 % | Valider |
| D-Pad Haut / Bas | Zoom ±15 % (pages en webtoon) | Curseur |
| D-Pad Gauche / Droite | Page ±1 | Catégorie / déplier série |
| A | Sens Occidental ↔ Manga | Ouvrir album / tome suivant |
| B | Fermer livre → bibliothèque | Retour menu |
| X | **Signet** | Ouvrir Import |
| Y | Overlay options (filtres / signets) | Options |
| Select | Mode webtoon | Vue séries |
| Start | — | Paramètres |
| LB | Fit Width | — |
| RB | Tome suivant non lu | — |
| LT / RT | Chapitre ±1 | Filtre ±1 |

---

## Phases

### Phase 0 — Squelette *(fait)*

- [x] Electron + Vue 3 + Pinia + Router
- [x] Fenêtre portrait 1080×1920
- [x] Remap manette portrait 90° CCW
- [x] UI boot console-first

### Phase Setup & préférences *(fait)*

- [x] Wizard premier lancement (`setupCompleted`)
- [x] Dossiers library / import, langue, thème, orientation
- [x] Thème sombre / clair (tokens CSS + persistance)
- [x] Remapping touches (UI settings + persistance)
- [x] Intégration gamepad : remap orientation → bindings user

### Phase 1 — MVP lecteur *(fait)*

- [x] CBZ/ZIP réel via JSZip (pages triées, getPage)
- [x] Fit Height, pan stick (`translate3d`), zoom D-Pad ±15 %, toggle L3
- [x] Pages D-Pad (avec remap portrait)

### Phase 2 — Lecteur complet *(fait)*

- [x] CBR (`node-unrar-js`)
- [x] PDF fidèle — pdfjs + canvas Chromium (BrowserWindow) ; fallback `canvas` / placeholder
- [x] Mode Manga LTR/RTL (A)
- [x] Overlay HUD (Y) + flash progression au changement de page
- [x] Fit Width (LB)
- [x] LT/RT chapitres si structure dossiers détectée

### Phase 3 — Bibliothèque & import *(fait)*

- [x] SQLite `better-sqlite3` (+ fallback JSON si natif KO)
- [x] Grille couvertures, progression, Continuer, statuts
- [x] **UX catalogue** — héro « Lecture en cours », rail « Ajouts récents », grille « Tous les livres » (lazy covers + skeletons)
- [x] Flux import (scan → review métadonnées → commit)
- [x] Provider métadonnées pluggable (stub + ComicVine câblé)
- [x] Watcher FS library/import (debounce → refresh liste / file d’import ; poll fallback)

### Phase 4 — Features locales *(fait)*

- [x] **Profils locaux** — nom + couleur, choix au lancement, gestion Paramètres ; progression / signets / prefs par profil
- [x] **Séries / tomes** — détection filename + `series_id` / volume en DB ; vue séries ; reprise « tome suivant non lu »
- [x] **Signets** — ajout (X) / liste / suppression par livre & profil ; panneau HUD
- [x] **Mode webtoon** — défilement vertical continu ; stick = scroll ; prefs persistées
- [x] **Filtres lecture** — luminosité / contraste / sépia (CSS GPU) ; preset nuit + reset ; panneau HUD

### Phase 5 — Polish & packaging *(fait)*

- [x] Watcher FS library/import — debounce + stabilité + **fallback polling**
- [x] Packaging Windows (electron-builder NSIS + portable, `predist` → rebuild natif)
- [x] Focus manette setup / import / settings + HUD reduced-motion
- [x] Haptics Ally (`GamepadHapticActuator` / `vibrationActuator`, setting on/off, no-op sinon)
- [x] Notes rebuild native / fallback JSON documentées (`docs/NATIVE.md`, `docs/PACKAGING.md`)
- [x] Polish UX manette (focus, transitions settings/import, messages vides)

### Merge

- **PR #1** mergée dans `main` — squelette produit + PDF + watcher initial + packaging.
- **PR #2** polish haptics/watcher mergée dans `main`.
- **PR #3** catalogue UI mergée dans `main`.
- **PR #4** features locales mergée dans `main`.

### Hors scope (volontairement)

- [ ] OPDS / catalogue distant
- [ ] Dossier bibliothèque réseau / sync cloud
- [ ] Comptes en ligne

---

## Flux produit cible

```
Setup (1ʳᵉ fois)
  → Choix profil (chaque lancement)
  → Boot
  → Import (dossier import → métadonnées → bibliothèque)
  → Bibliothèque (catalogue : héro / récents / grille / séries)
  → Lecteur (CBZ/CBR/PDF + webtoon + filtres + signets)
  → Paramètres (thème / profils / remap / clé API)
```

---

## Stack

| Besoin | Choix |
|--------|--------|
| Shell | Electron |
| Archives ZIP/CBZ | JSZip |
| Archives RAR/CBR | node-unrar-js |
| PDF | pdfjs-dist (+ canvas Chromium / optionnel node-canvas) |
| DB | better-sqlite3 (fallback JSON) |
| Rendu zoom/pan/filtres | CSS transform + filter GPU |
| Métadonnées | stub + ComicVine (clé en userData) |
| Packaging | electron-builder (win nsis + portable) |

---

## Conventions

- **Main** : Node, FS, extracteurs, DB, secrets, watchers
- **Renderer** : UI / Gamepad ; pas d’accès FS direct
- **IPC** : `src/shared/ipc-channels.js`
- Secrets API : `userData/vdr-secrets.json` (chmod 600 si possible), jamais dans le repo
- Données profil : SQLite / JSON local uniquement — **pas de sync cloud**
