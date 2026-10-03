# UX — Vertical Deck Reader

Objectif : une expérience **console-first** irréprochable sur ROG Ally X (portrait, manette).

## Stack front

| Couche | Choix |
|--------|--------|
| UI | Vue 3 (Composition API) |
| Build | Vite via `electron-vite` |
| État | Pinia |
| Navigation | Vue Router (hash) + gate setup |
| Gamepad | `useGamepad` + remap + key-bindings |

## Écrans

1. **Setup** — wizard obligatoire au premier lancement
2. **Boot** — marque dominante + actions (Continuer / Bibliothèque / Import / Paramètres)
3. **Import** — review métadonnées par tome
4. **Bibliothèque** — grille couvertures focusable
5. **Lecteur** — planche plein écran, HUD discret (Y)
6. **Paramètres** — thème, remap, API

## Thèmes

Tokens CSS `data-theme="dark|light"` :
- sombre : encre nuit + laiton (lecteur / console)
- clair : papier chaud + encre (bibliothèque / setup)

Persistance via config `theme`.

## Principes

1. Zéro dépendance souris — focus toujours visible
2. Une intention par écran
3. Feedback immédiat (edge boutons, glow focus)
4. 60/120 FPS ressenti — `translate3d` / `scale`
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
- [x] Thème clair/sombre cohérent sur tous les écrans
- [x] Lecteur : 0 chrome sauf overlay Y (+ flash progression page)
- [x] Boot : marque dominante dans le 1er viewport
- [x] Reduced motion respecté (transitions / HUD)
- [x] Watcher FS → refresh bibliothèque / import
