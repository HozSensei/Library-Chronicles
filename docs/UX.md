# UX — Vertical Deck Reader

Objectif : expérience **console-first** type Steam OS / Big Picture sur ROG Ally X.  
Application **100 % locale** — pas d’OPDS ni de dossier distant.

## Stack front

| Couche | Choix |
|--------|--------|
| UI | Vue 3 (Composition API) + **Tailwind CSS** |
| Build | Vite via `electron-vite` |
| État | Pinia |
| Navigation | Vue Router (hash) + gates setup / profil |
| Gamepad | `useGamepad` — contexte `ui` vs `reader` |

## Flux d’orientation (automatique)

| Zone | Fenêtre Electron | Contenu | Manette |
|------|------------------|---------|---------|
| Setup / Profils / Boot / Bibliothèque / Import / Fiche / Paramètres | **Landscape** 1920×1080 | inchangé | Identity (Haut = Haut) |
| Lecteur | **Landscape** 1920×1080 (plein workArea) | plan CSS **+90° CW** | Remap hold 90° CCW |

Stratégie B : la fenêtre ne passe **pas** en 1080×1920 (évite le shrink Windows/Ally).  
Le portrait lecture = rotation CSS du plan (stage + HUD) dans le bon sens.

Plus de choix « Portrait Ally / Landscape » au setup ni dans les paramètres.  
L’app appelle `setSessionMode('reader'|'ui')` à l’entrée / sortie du lecteur.

## Écrans

1. **Profils** — premier écran (ronds + bouton **+**), même à zéro profil
2. **Setup** — wizard **par profil** (dossiers, thème, langue) — pas d’orientation
3. **Boot** — marque + actions (Continuer / Bibliothèque / Import / Paramètres)
4. **Import** — liste rows + multi-sélection (A) + check « déjà importé » + footer actions fixe + enrichissement métadonnées
5. **Bibliothèque** — catalogue TV (héro large, sidebar En cours, pills, rails posters verticaux)
6. **Fiche livre** — layout type streaming (cover portrait + méta labels/valeurs + synopsis) · rail série sous le contenu · Lire / Retour / Options (footer fixe)
7. **Lecteur** — portrait (+90° CSS), menu pause Select en **modal** (quitter, signets, filtres, webtoon, sens)
8. **Paramètres** — thème, profils, haptics, remap, API (orientation info seule)

## Profils locaux

- Plusieurs profils (nom + couleur / initiale)
- **Bibliothèque isolée** : `libraryRoot` / `importRoot` / livres DB scoped `profileId`
- Progression, signets, prefs lecture **par profil**
- Pas de sync cloud
- Reset : `npm run reset:library` · `npm run reset:app -- --all`

## Thèmes & accents

- Mode : `data-theme="dark|light"` sur `:root` / `#app`
- Accent : `data-accent="blue|orange|green|amber|rose|violet"` — focus glow, boutons, pills, progress
- Défaut : sombre + **laiton** (`amber`) — plus de cyan Steam Deck
- Persistance : prefs profil (`theme` + `accent`) + miroir config
- UI : Setup étape Préférences + Paramètres → Général (mode côte à côte, swatches ←→)

## Principes

1. Zéro dépendance souris — focus toujours visible
2. Une intention par écran
3. Padding confortable, contenu centré / max-width
4. Choix multi-valeurs en ligne (côte à côte), pas une liste d’étapes
5. Feedback immédiat (bordure focus, haptics)
6. Reduced motion respecté

## Checklist

- [x] Menus landscape · lecture portrait automatique
- [x] Setup sans choix orientation
- [x] Bibliothèque vide → un seul CTA Importer
- [x] Grille store + fiche livre détail
- [x] Import rows + check déjà importé + multi-sélection + footer fixe
- [x] Enrichir métadonnées (warning + AniList défaut)
- [x] Select → menu pause lecture
- [x] Tailwind + tokens mode/accent (hors Steam cyan)
