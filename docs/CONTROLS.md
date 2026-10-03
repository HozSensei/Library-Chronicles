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

| Contexte | Fenêtre | Contenu | Remap |
|----------|---------|---------|-------|
| Menus / setup / biblio / import / fiche | 1920×1080 landscape | inchangé | Aucun (physique = logique) |
| Lecteur | **reste** 1920×1080 landscape | plan CSS **+90° CW** | 90° CCW hold |

> Stratégie B : pas de `setBounds` portrait (sinon clamp Ally → shrink 1080×1080).
> Ally tenue CCW (D-Pad en bas) → contenu tourné +90° pour planche à l’endroit.

Plus de toggle setup/paramètres. IPC `app:set-session-mode` (`ui` | `reader`).

### Remap portrait (lecteur uniquement)

Ally tenue **en portrait**, tournée de **90° anti-horaire** (D-Pad en bas) :

| Physique (XInput) | Logique (écran utilisateur) |
|-------------------|------------------------------|
| D-Pad / stick ↑   | ← gauche                     |
| D-Pad / stick ↓   | → droite                     |
| D-Pad / stick ←   | ↓ bas                        |
| D-Pad / stick →   | ↑ haut                       |

Stick : `logicalX = physicalY`, `logicalY = −physicalX`.
Pan dans le plan tourné : `local = visualPanToLocal(logical)` (`localX = visualY`, `localY = −visualX`).

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
| **Select** | **Menu pause** (modal centrée, plan +90°) |
| LB | Fit Width |
| RB | Tome suivant non lu |
| LT / RT | Chapitre ±1 |

### Menu pause ouvert *(même plan tourné que le stage)*

| Contrôle | Action |
|----------|--------|
| D-Pad / stick | Focus dans la modal |
| **A** | Valider (élément focalisé) |
| **B** / Select / Y | Fermer la modal (pas la lecture) |

## Stick menus (hors lecteur)

Hors route `reader`, le stick gauche se comporte comme le D-Pad :

1. Deadzone analogique (`0.18`) puis seuil discret (`0.45`)
2. Axe dominant → `up` / `down` / `left` / `right` (landscape : Haut=Haut)
3. Premier franchissement → pas immédiat ; maintien → délai ~320 ms puis repeat ~120 ms
4. Action via bindings `dpad:*` → `cursor-*` (+ `scrollIntoView` déjà en place)

En **lecteur**, le stick reste en **pan** analogique (remap portrait) — sauf modal pause (nav focus).

## Mode Bibliothèque (landscape)

| Contrôle | Action |
|----------|--------|
| D-Pad / stick | Curseur grille / rails |
| A | Ouvrir **fiche livre** |
| B | No-op (biblio = accueil) |
| X | Import |
| LB / RB | Onglets Bibliothèque / Récents / Séries |
| Select | Onglet suivant (raccourci) |
| Start | Paramètres |
| LT / RT | Filtre statut |

Bibliothèque vide : A → Import. Icône engrenage dans le header = Paramètres.

## Mode Fiche livre (landscape)

| Contrôle | Action |
|----------|--------|
| ←→ / ↑↓ | Focus actions (Lire / Retour / Options) |
| A | Valider l’action focus |
| B | Retour bibliothèque |

## Mode Profils / Setup / Import / Boot / Paramètres

Navigation D-Pad **et stick** (identité landscape).  
Import : Y = Enrichir métadonnées.

### Paramètres

| Contrôle | Action |
|----------|--------|
| ↑↓←→ / stick | Focus dans la section (providers, champs, liens, remap…) |
| LT / RT | Section précédente / suivante |
| A | Valider / écouter (remap) / focus champ |
| B | Retour bibliothèque |

Remap UI : **lecture uniquement** + bouton Reset (défauts lecture).

## Clavier / souris (dev)

Toutes les actions UI sont cliquables. Focus manette visible.
