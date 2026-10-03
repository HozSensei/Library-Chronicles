# UX — Vertical Deck Reader

Objectif : une expérience **console-first** irréprochable sur ROG Ally X (portrait, manette).  
Application **100 % locale** — pas d’OPDS ni de dossier distant.

## Stack front

| Couche | Choix |
|--------|--------|
| UI | Vue 3 (Composition API) |
| Build | Vite via `electron-vite` |
| État | Pinia |
| Navigation | Vue Router (hash) + gates setup / profil |
| Gamepad | `useGamepad` + remap + key-bindings |

## Écrans

1. **Setup** — wizard obligatoire au premier lancement
2. **Profils** — choix du profil local (chaque lancement après setup)
3. **Boot** — marque dominante + actions (Continuer / Bibliothèque / Import / Paramètres)
4. **Import** — review métadonnées par tome
5. **Bibliothèque (catalogue)** — héro reprise, rail récents, grille livres **ou** vue séries
6. **Lecteur** — planche plein écran, HUD (Y) : lecture / filtres / signets ; mode webtoon
7. **Paramètres** — thème, profils, orientation, haptics, remap, API

## Thèmes

Tokens CSS `data-theme="dark|light"` :
- sombre : encre nuit + laiton (lecteur / console)
- clair : papier chaud + encre (bibliothèque / setup)

Persistance via config `theme`.

## Profils locaux

- Plusieurs profils (nom + couleur avatar)
- Progression, signets, prefs lecture (direction, webtoon, filtres) **par profil**
- Pas de sync cloud

## Principes

1. Zéro dépendance souris — focus toujours visible
2. Une intention par écran
3. Feedback immédiat (edge boutons, glow focus, haptics optionnels)
4. 60/120 FPS ressenti — `translate3d` / `scale` / `filter`
5. HUD discret
6. Reduced motion respecté

## Direction visuelle

- Display **Syne** · Body **Figtree**
- Focus laiton, pas de glow violet
- Grain + wash radial

## Checklist

- [x] Focus manette lisible à 60 cm
- [x] Aucun dead-end sans B
- [x] Setup bloquant tant que non complété
- [x] Choix profil au lancement
- [x] Thème clair/sombre cohérent sur tous les écrans
- [x] Lecteur : 0 chrome sauf overlay Y (+ flash progression page)
- [x] Boot : marque dominante dans le 1er viewport
- [x] Reduced motion respecté (transitions / HUD)
- [x] Watcher FS → refresh bibliothèque / import
- [x] Haptics Ally (setting on/off, no-op si absent)
- [x] Messages vides import / bibliothèque guidés manette
- [x] Catalogue bibliothèque : héro reprise / rail récents / grille + lazy covers + skeletons
- [x] Vue séries + reprise tome suivant
- [x] Signets / webtoon / filtres lecture
