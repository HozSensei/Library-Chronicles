# Mapping manette — UI landscape & lecture portrait

Implémentation : `portrait-remap.js` → `key-bindings.js` → `useGamepad.js`.

## Pipeline d’entrée

1. **Physique** (indices Gamepad API / XInput)
2. **Remap selon la route** (`sessionOrientationForRoute`) :
   - toute route hors `reader` → **landscape** (identité) — **jamais** `config.orientation`
   - `reader` → **portrait-ccw** (90° CCW)
3. **Mapping utilisateur** (défauts + overrides)
4. **Action** selon l’écran

> Bug corrigé : un `config.orientation = portrait-ccw` résiduel (crash en lecture)
> ou un `inputContext` sticky pouvait laisser les **menus** en remap vertical.
> Source de vérité = `routeName === 'reader'` uniquement.

## Orientation automatique

| Contexte | Fenêtre | Remap |
|----------|---------|-------|
| Menus / setup / biblio / import / fiche | 1920×1080 landscape | Aucun (physique = logique) |
| Lecteur | 1080×1920 portrait | 90° CCW |

Plus de toggle setup/paramètres. IPC `app:set-session-mode` (`ui` | `reader`).

### Remap portrait (lecteur uniquement)

Ally tenue **en portrait**, tournée de **90° anti-horaire** :

| Physique (XInput) | Logique (écran portrait) |
|-------------------|--------------------------|
| D-Pad / stick ↑   | ← gauche                 |
| D-Pad / stick ↓   | → droite                 |
| D-Pad / stick ←   | ↑ haut                   |
| D-Pad / stick →   | ↓ bas                    |

Stick : `logicalX = physicalY`, `logicalY = physicalX`.

## Mode Lecture *(directions = écran logique)*

| Contrôle | Action |
|----------|--------|
| Stick L | Pan (remap portrait) |
| L3 / R3 | Toggle Fit Height ↔ Zoom 100 % |
| D-Pad **→** | **Zoom +** |
| D-Pad **←** | **Zoom −** |
| D-Pad ↑ / ↓ | Page ±1 (inversé en Manga) |
| A | LTR ↔ RTL |
| B | Fermer → bibliothèque (restore landscape) |
| X | Ajouter un signet |
| Y | HUD onglets |
| **Select** | **Menu pause** (quitter, webtoon, sens, signets…) |
| LB | Fit Width |
| RB | Tome suivant non lu |
| LT / RT | Chapitre ±1 |

## Stick menus (hors lecteur)

Hors route `reader`, le stick gauche se comporte comme le D-Pad :

1. Deadzone analogique (`0.18`) puis seuil discret (`0.45`)
2. Axe dominant → `up` / `down` / `left` / `right` (landscape : Haut=Haut)
3. Premier franchissement → pas immédiat ; maintien → délai ~320 ms puis repeat ~120 ms
4. Action via bindings `dpad:*` → `cursor-*` (+ `scrollIntoView` déjà en place)

En **lecteur**, le stick reste en **pan** analogique (remap portrait) — jamais en focus menu.

## Mode Bibliothèque (landscape)

| Contrôle | Action |
|----------|--------|
| D-Pad / stick | Curseur grille (6 colonnes) |
| A | Ouvrir **fiche livre** |
| B | Retour |
| X | Import |
| Select | Vue livres ↔ séries |
| Start | Paramètres |
| LT / RT | Filtre statut |

Bibliothèque vide : A → Import.

## Mode Fiche livre (landscape)

| Contrôle | Action |
|----------|--------|
| ←→ / ↑↓ | Focus actions (Lire / Retour / Options) |
| A | Valider l’action focus |
| B | Retour bibliothèque |

## Mode Profils / Setup / Import / Boot / Paramètres

Navigation D-Pad **et stick** (identité landscape).  
Import : Y = Enrichir métadonnées.

## Clavier / souris (dev)

Toutes les actions UI sont cliquables. Focus manette visible.
