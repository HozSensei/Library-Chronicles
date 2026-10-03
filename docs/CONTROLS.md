# Mapping manette — ROG Ally X

Référence produit. Implémentation : `src/shared/controls.js` + `src/renderer/js/gamepad.js`.

## Mode Lecture

| Contrôle | Action |
|----------|--------|
| Joystick (axe) | Pan / drag de la planche |
| L3 / R3 | Toggle Fit Height ↔ Zoom 100 % |
| D-Pad ↑ / ↓ | Zoom +15 % / −15 % |
| D-Pad ← / → | Page précédente / suivante (inversé en mode Manga) |
| A | Occidental (LTR) ↔ Manga (RTL) |
| B | Fermer le livre → bibliothèque |
| Y | Afficher / masquer overlay (progression, page, sens) |
| LT / RT | Chapitre précédent / suivant |

## Mode Bibliothèque

| Contrôle | Action |
|----------|--------|
| Joystick | Défilement liste |
| L3 / R3 | Valider / sélectionner |
| D-Pad | Déplacer le curseur / catégorie |
| A | Ouvrir l’album |
| B | Retour menu précédent |
| Y | Options du livre |
| LT / RT | Changement d’onglet |

## Paramètres techniques

- Deadzone joystick par défaut : `0.18`
- Pas de zoom : `0.15` (15 %)
- Polling : `requestAnimationFrame` (aligné vsync, ~60/120 Hz)
