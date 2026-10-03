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

| Zone | Orientation | Manette |
|------|-------------|---------|
| Setup / Profils / Boot / Bibliothèque / Import / Fiche / Paramètres | **Landscape** 1920×1080 | Identity (Haut = Haut) |
| Lecteur | **Portrait** 1080×1920 | Remap 90° CCW |

Plus de choix « Portrait Ally / Landscape » au setup ni dans les paramètres.  
L’app appelle `setSessionMode('reader'|'ui')` à l’entrée / sortie du lecteur.

## Écrans

1. **Profils** — premier écran (ronds + bouton **+**), même à zéro profil
2. **Setup** — wizard **par profil** (dossiers, thème, langue) — pas d’orientation
3. **Boot** — marque + actions (Continuer / Bibliothèque / Import / Paramètres)
4. **Import** — liste rows + check « déjà importé » + enrichissement métadonnées
5. **Bibliothèque** — catalogue TV (héro large, sidebar En cours, pills, rails posters verticaux)
6. **Fiche livre** — cover gauche · détails droite · synopsis · Lire / Retour / Options
7. **Lecteur** — portrait, menu pause (Select) : quitter, signets, filtres, webtoon, sens
8. **Paramètres** — thème, profils, haptics, remap, API (orientation info seule)

## Profils locaux

- Plusieurs profils (nom + couleur / initiale)
- **Bibliothèque isolée** : `libraryRoot` / `importRoot` / livres DB scoped `profileId`
- Progression, signets, prefs lecture **par profil**
- Pas de sync cloud
- Reset : `npm run reset:library` · `npm run reset:app -- --all`
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
- [x] Import rows + check déjà importé
- [x] Enrichir métadonnées (warning + AniList défaut)
- [x] Select → menu pause lecture
- [x] Tailwind + tokens Steam OS
