# Vertical Deck Reader (VDR) — Plan des fonctionnalités

Document de cadrage opérationnel pour **Library Chronicles / Vertical Deck Reader**.  
Lecteur BD · Comics · Manga en mode portrait, optimisé manette (ROG Ally X).

---

## Vision

Application Electron légère qui relie une ergonomie manette naturelle à la lecture de formats compressés (CBZ/CBR/PDF/ZIP/**EPUB**), avec **setup initial**, **import guidé**, **thèmes**, **profils locaux** et **remapping des touches**.  
**Pas de fonctionnalités réseau** (pas d’OPDS, pas de dossier distant).

---

## Architecture cible

```
Renderer                          Main (Electron)
─────────────────────             ─────────────────────────────
Setup / Profils / Import ──IPC──► Config + secrets (userData)
Gamepad (remap→bindings)  ──IPC──► Extractors (ZIP / RAR / PDF / EPUB)
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

> **Menus = landscape (identity)** · **Lecture = portrait CCW + remap**.  
> Voir `docs/CONTROLS.md`, `portrait-remap.js`, `key-bindings.js`.

| Contrôle (écran) | Mode Lecture (portrait) | Mode Bibliothèque (landscape) |
|----------|--------------|-------------------|
| Stick L | Pan (remap portrait) | Curseur grille |
| L3 / R3 | Reset zoom (page entière) | Valider |
| D-Pad ← / → | **Zoom ±** | Curseur |
| D-Pad ↑ / ↓ | Page ±1 | Curseur |
| A | Sens Occidental ↔ Manga | Ouvrir **fiche livre** |
| B | Fermer → biblio (restore landscape) | Retour |
| X | **Signet** | Ouvrir Import |
| Y | Overlay onglets | Options |
| Select | **Menu pause** | Vue séries |
| Start | — | Paramètres |
| LB | Fit Width | — |
| RB | Tome suivant non lu | — |
| LT / RT | Chapitre ±1 | Filtre ±1 |

---

## Phases

### Phase UX Steam OS *(fait)*

- [x] Tailwind CSS + tokens console Steam-inspired
- [x] Menus landscape / lecture portrait automatique (`setSessionMode`)
- [x] Setup sans choix orientation ; prefs thème côte à côte
- [x] Bibliothèque grille store ; vide = CTA Importer unique
- [x] Fiche livre (cover | détails + synopsis)
- [x] Import rows + check déjà importé ; enrich AniList défaut ; X/Y + pastilles metaSource
- [x] Select → menu pause lecture ; D-Pad ←→ zoom

### Phase 0 — Squelette *(fait)*

- [x] Electron + Vue 3 + Pinia + Router
- [x] Fenêtre landscape 1920×1080 (menus) / portrait lecture
- [x] Remap manette portrait 90° CCW (lecteur)
- [x] UI boot console-first

### Phase Setup & préférences *(fait)*

- [x] Wizard premier lancement (`setupCompleted`)
- [x] Dossiers library / import, langue, thème (orientation auto)
- [x] Thème sombre / clair (tokens CSS + persistance)
- [x] Remapping touches (UI settings + persistance)
- [x] Intégration gamepad : contexte ui/reader → bindings user

### Phase 1 — MVP lecteur *(fait)*

- [x] CBZ/ZIP réel via JSZip (pages triées, getPage)
- [x] **EPUB** — 3ᵉ chemin `EpubReaderStage` (JSZip + OPF/spine, reflow) ; strip disabled ; police / stick scroll / chapitres
- [x] Page entière (contain), pan stick (`translate3d`), zoom D-Pad ±15 %, reset zoom L3
      — modèle unique `page-view-transform.js` (`fitScale` / `zoom ∈ [1,4]` / offset clampé)
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
- [x] Provider métadonnées pluggable (stub + Open Library + AniList + MangaDex + ComicVine + Google Books)
- [x] Watcher FS library/import (debounce → refresh liste / file d’import ; poll fallback)

### Phase 4 — Features locales *(fait)*

- [x] **Profils locaux** — nom + couleur, choix au lancement, gestion Paramètres ; progression / signets / prefs par profil
- [x] **Séries / tomes** — détection filename + fallback dossier parent (hors dossiers génériques) + `series_id` / volume en DB ; vue séries ; reprise « tome suivant non lu » (API metadata reste prioritaire)
- [x] **Signets** — ajout (X) / liste / suppression par livre & profil ; panneau HUD
- [x] **Mode page unique** — zoom / pan stick / D-Pad pages (strip continu retiré, à refaire from scratch plus tard)
- [x] **Filtres lecture** — luminosité / contraste / sépia (CSS GPU) ; preset nuit + reset ; panneau HUD

### Phase 5 — Polish & packaging *(fait)*

- [x] Watcher FS library/import — debounce + stabilité + **fallback polling**
- [x] Packaging Windows (electron-builder NSIS + portable, `predist` → rebuild natif)
- [x] Focus manette setup / import / settings + HUD reduced-motion
- [x] Haptics Ally (`GamepadHapticActuator` / `vibrationActuator`, setting on/off, no-op sinon)
- [x] Notes rebuild native / fallback JSON documentées (`docs/NATIVE.md`, `docs/PACKAGING.md`)
- [x] Polish UX manette (focus, transitions settings/import, messages vides)

### Phase 6 — Orientation landscape *(fait)*

- [x] Mode app `portrait-ccw` **et** `landscape` (préférence persistée)
- [x] Fenêtre Electron 1920×1080 en landscape (démarrage + bascule runtime)
- [x] Remap manette : pas de rotation 90° en landscape (directions physiques = logiques)
- [x] Layouts responsives catalogue / lecteur HUD / import / setup (`data-orientation`)
- [x] Setup + Paramètres + CLI `--landscape` / `--portrait` + raccourci `Ctrl+Shift+L`
- [x] Docs [`docs/CONTROLS.md`](./docs/CONTROLS.md)



### Phase 7 — Audit perf & cleanup *(fait)*

- [x] Scan library incrémental (watcher) vs force (Scanner)
- [x] Store library : TTL refresh, dedupe in-flight, dérivation séries/continue locale
- [x] Reader : plus de `listBooks` à l’open ; prefetch pages ±N ; cache IPC/extracteur ; revoke ObjectURL
- [x] Covers : cache mémoire data-URL (disque déjà en place)
- [x] Metadata search : TTL + dedupe ; import providers mis en cache
- [x] Doc [`docs/PERF.md`](./docs/PERF.md)

### Merge

- **PR #1** mergée dans `main` — squelette produit + PDF + watcher initial + packaging.
- **PR #2** polish haptics/watcher mergée dans `main`.
- **PR #3** catalogue UI mergée dans `main`.
- **PR #4** features locales mergée dans `main`.
- **PR #5** providers métadonnées mergée dans `main`.
- Mode landscape intégré sur `main` (branche `cursor/vdr-landscape-mode-d859`).

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
  → Lecteur (CBZ/CBR/PDF/EPUB · page / strip / reflow + filtres + signets)
  → Paramètres (thème / profils / remap / providers méta)
```

---

## Stack

| Besoin | Choix |
|--------|--------|
| Shell | Electron |
| Archives ZIP/CBZ | JSZip |
| Archives RAR/CBR | node-unrar-js |
| PDF | pdfjs-dist (+ canvas Chromium / optionnel node-canvas) |
| EPUB | JSZip + parse OPF/spine (reflow, pas epubjs) |
| DB | better-sqlite3 (fallback JSON) |
| Rendu zoom/pan/filtres | CSS transform + filter GPU |
| Métadonnées | stub, Open Library, AniList, MangaDex (sans clé) ; ComicVine, Google Books (clé userData) — voir [`docs/METADATA.md`](./docs/METADATA.md) |
| Packaging | electron-builder (win nsis + portable) |

---

## Conventions

- **Main** : Node, FS, extracteurs, DB, secrets, watchers
- **Renderer** : UI / Gamepad ; pas d’accès FS direct
- **IPC** : `src/shared/ipc-channels.js`
- Secrets API : `userData/vdr-secrets.json` (chmod 600 si possible), jamais dans le repo
- Données profil : SQLite / JSON local uniquement — **pas de sync cloud**
