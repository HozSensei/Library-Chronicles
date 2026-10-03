# UX — Vertical Deck Reader

Objectif : une expérience **console-first** irréprochable sur ROG Ally X (portrait, manette).

## Stack front

| Couche | Choix | Pourquoi |
|--------|--------|----------|
| UI | **Vue 3** (Composition API) | Préférence projet, composants clairs, transitions natives |
| Build | **Vite** via `electron-vite` | HMR rapide, séparation main/preload/renderer |
| État | **Pinia** | Lecteur / bibliothèque / UI découpés, testables |
| Navigation | **Vue Router** (hash) | Écrans boot → bibliothèque → lecteur + transitions |
| Gamepad | Composable `useGamepad` | Boucle rAF unique, actions routées par écran |

Pas de framework CSS lourd : design tokens CSS + composants Vue ciblés = contrôle total du feeling console.

## Principes UX

1. **Zéro dépendance souris** — toute action a un équivalent manette ; focus toujours visible.
2. **Une intention par écran** — boot = marque + 2 actions ; lecteur = planche plein écran ; bibliothèque = choix de tome.
3. **Feedback immédiat** — edge boutons, glow focus, transitions de route, HUD qui apparaît/disparaît.
4. **60/120 FPS ressenti** — pan/zoom via `translate3d` / `scale` (GPU), pas de layout thrash.
5. **HUD discret** — l’image domine ; Y révèle progression / sens / sortie.
6. **Reduced motion** — respecter `prefers-reduced-motion`.

## Direction visuelle

- Encre nuit (`#0b0c0f`) + **laiton / papier** (atelier BD)
- Display : **Syne** · Body : **Figtree**
- Focus : anneau laiton, pas de glow violet générique
- Grain + wash radial pour l’atmosphère (pas un fond plat)

## Checklist qualité (à valider à chaque phase)

- [ ] Focus manette lisible à 60 cm
- [ ] Aucun dead-end sans bouton B
- [ ] Transitions ≤ ~300 ms, easing cohérent
- [ ] Texte contrasté sur fond sombre
- [ ] Lecteur : 0 chrome sauf overlay Y
- [ ] Boot : marque dominante dans le 1er viewport

## Prochaines raffinements UX

- Micro-interactions couverture (Phase 3)
- Haptics Ally si API dispo (Phase 4)
- Thème « papier » optionnel pour bibliothèque (Phase 4)
