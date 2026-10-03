# Mapping manette — ROG Ally X (portrait)

Implémentation : `portrait-remap.js` → `key-bindings.js` → `useGamepad.js`.

## Pipeline d’entrée

1. **Physique** (indices Gamepad API / XInput)
2. **Remap orientation** (`portrait-ccw` ou `landscape`) pour D-Pad / stick
3. **Mapping utilisateur** (défauts + overrides persistés dans la config)
4. **Action** dispatchée selon l’écran (boot / library / reader / …)

Le remapping se configure dans **Paramètres → Manette**.

## Orientation appareil

Ally tenue **en portrait**, tournée de **90° anti-horaire** :

| Physique (XInput) | Logique (écran portrait) |
|-------------------|--------------------------|
| D-Pad / stick ↑   | ← gauche                 |
| D-Pad / stick ↓   | → droite                 |
| D-Pad / stick ←   | ↑ haut                   |
| D-Pad / stick →   | ↓ bas                    |

Stick : `logicalX = physicalY`, `logicalY = physicalX`.

## Mode Lecture *(directions = écran, mapping défaut)*

| Contrôle | Action |
|----------|--------|
| Stick L | Pan |
| L3 / R3 | Toggle Fit Height ↔ Zoom 100 % |
| D-Pad ↑ / ↓ | Zoom ±15 % |
| D-Pad ← / → | Page ±1 (inversé en Manga) |
| A | LTR ↔ RTL |
| B | Fermer → bibliothèque |
| X | Fit Width |
| Y | HUD on/off |
| LT / RT | Chapitre ±1 (ou ±10 pages) |

## Mode Bibliothèque

| Contrôle | Action |
|----------|--------|
| D-Pad / stick | Curseur grille |
| A | Ouvrir |
| B | Retour |
| X | Import |
| Start | Paramètres |
| LT / RT | Filtre statut |

## Dev desktop

Config `orientation: 'landscape'` (setup ou paramètres) désactive le remap portrait.
