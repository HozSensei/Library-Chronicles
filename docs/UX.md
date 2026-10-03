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
4. **Import** — liste simple (A = fiche détail, X = importer ce tome, Y = tout importer) + pastilles méta (bleu / rouge / vert) + check « déjà importé »
5. **Bibliothèque** — catalogue TV (Continuer par tome, pills, rails, onglets Tous / Récents / Séries)
6. **Récents** — **une entrée par série** (dernier tome touché) ; A → fiche série si multi-tomes, sinon fiche tome
7. **Fiche série** (`/series/:seriesId`) — cover 1er tome, méta agrégées, grille des tomes (ordre volume) → A ouvre la fiche tome
8. **Fiche tome** (`/book/:id`) — cover + méta + synopsis · Lire / Retour / Options (footer fixe) ; accessible depuis série ou grille
9. **Lecteur** — portrait (+90° CSS), menu pause Select en **modal** (quitter, signets, filtres, webtoon, sens)
10. **Paramètres** — thème, profils, haptics, remap, API (orientation info seule)

### Série vs tome

| Surface | Ouverture (A) | Notes |
|---------|---------------|--------|
| Onglet **Séries** | Fiche série | Liste des séries détectées |
| Onglet **Récents** | Fiche série si ≥2 tomes, sinon fiche tome | Dédup `listRecentSeries` |
| **Continuer** | Fiche tome | Toujours le tome commencé |
| Grille **Tous** | Fiche tome | Un poster = un fichier |
| Fiche série → tome | Fiche tome | Puis **Lire** → lecteur |

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
- [x] Récents dédupliqués par série · fiche série `/series/:id` · fiche tome `/book/:id`
- [x] Import liste → fiche détail (méta + search API) · X un tome · Y tous · pastilles metaSource
- [x] Enrichir métadonnées (warning + AniList défaut)
- [x] Select → menu pause lecture
- [x] Tailwind + tokens mode/accent (hors Steam cyan)
