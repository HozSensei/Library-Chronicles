# Mapping manette — ROG Ally X (portrait)

Implémentation : `src/shared/portrait-remap.js` + `src/renderer/src/composables/useGamepad.js`.

## Orientation appareil

La Ally est tenue **en portrait**, tournée de **90° anti-horaire** par rapport au landscape :

```
        [ ABXY · stick R ]          ← haut (ex-poignée droite)
   ┌─────────────────────────┐
   │                         │
   │      écran 1080×1920    │
   │                         │
   └─────────────────────────┘
        [ D-Pad · stick L ]         ← bas (ex-poignée gauche)
```

Les entrées XInput restent celles du landscape matériel.  
**VDR convertit tout en directions logiques (repère écran).**

| Physique (XInput) | Logique (écran portrait) |
|-------------------|--------------------------|
| D-Pad / stick ↑   | ← gauche                 |
| D-Pad / stick ↓   | → droite                 |
| D-Pad / stick ←   | ↑ haut                   |
| D-Pad / stick →   | ↓ bas                    |

Stick : `logicalX = physicalY`, `logicalY = physicalX`.

## Mode Lecture *(directions = écran)*

| Contrôle (logique) | Action |
|--------------------|--------|
| Stick L (bas) | Pan / drag sur la planche |
| L3 / R3 | Toggle Fit Height ↔ Zoom 100 % |
| D-Pad ↑ / ↓ | Zoom +15 % / −15 % |
| D-Pad ← / → | Page précédente / suivante (inversé en Manga) |
| A | Occidental (LTR) ↔ Manga (RTL) |
| B | Fermer le livre → bibliothèque |
| Y | Afficher / masquer overlay |
| LT / RT | Chapitre précédent / suivant |

En pratique sur le D-Pad physique en bas de la console :

- les branches qui pointent **gauche/droite** à l’écran (physique ↑/↓) tournent les pages ;
- les branches qui pointent **haut/bas** à l’écran (physique ←/→) gèrent le zoom.

## Mode Bibliothèque / menus *(directions = écran)*

| Contrôle (logique) | Action |
|--------------------|--------|
| Stick | Défilement liste |
| L3 / R3 | Valider / sélectionner |
| D-Pad ↑↓←→ | Curseur / catégorie |
| A | Ouvrir l’album |
| B | Retour menu précédent |
| Y | Options du livre |
| LT / RT | Changement d’onglet |

## Paramètres techniques

- Orientation par défaut : `portrait-ccw` (`DeviceOrientation.PORTRAIT_CCW`)
- Deadzone joystick : `0.18`
- Pas de zoom : `0.15` (15 %)
- Polling : `requestAnimationFrame` (~60/120 Hz)

## Dev desktop (optionnel)

Pour tester à plat sans Ally, on pourra exposer un override config `orientation: 'landscape'` qui désactive le remap (TODO Phase 1 polish).
