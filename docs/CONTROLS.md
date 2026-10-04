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

Stick (D-Pad / nav) : `logicalX = physicalY`, `logicalY = −physicalX`.
Pan plan +90° CSS : mêmes axes **physiques**, puis `visualPanToLocal` = **même +90° CW que la page** — `localX = −stickY`, `localY = stickX` (pas de remap portrait sur le pan).

## Mode Lecture *(directions = écran logique)*

| Contrôle | Action |
|----------|--------|
| Stick L | Pan (axes physiques → `visualPanToLocal` +90°) |
| L3 / R3 | **Reset zoom** (page entière / fit stage) |
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

### Fit Width / Fit Height (plan +90°)

- **Fit Width** : planche **bord à bord gauche-droite** = 100 % de la largeur
  du viewport lecture. Sous `rotate(90deg)` Ally CCW, largeur utilisateur =
  **largeur locale** du stage (`clientWidth` = `100vh`).
  CSS : `width: 100%; height: auto` + `scale = 1`
  (formule équivalente : `scale = stageLocalWidth / pageNaturalWidth`).
- **Fit Height** : 100 % de la hauteur locale (`height: 100%; width: auto`).
- **L3 / R3** : **reset zoom** — `scale = 1`, pan recentré/clampé, **sans**
  basculer Fit Height ↔ Fit Width (`fitMode` inchangé).

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
| A | **Continuer / Tous** → fiche tome · **Séries** → fiche série · **Récents** → fiche série (≥2 tomes) ou tome |
| B | No-op (biblio = accueil) |
| X | Import |
| LB / RB | Onglets Bibliothèque / Tous / Récents / Séries |
| Select | Onglet suivant (raccourci) |
| Start | Paramètres |
| LT / RT | Filtre statut |

Bibliothèque vide : A → Import. Icône engrenage dans le header = Paramètres.  
Récents : une entrée par série (dernier tome touché). Continuer reste par tome.

## Mode Fiche livre (landscape)

| Contrôle | Action |
|----------|--------|
| ←→ / ↑↓ | Focus champs méta + actions (Lire / Retour / Options) |
| A | Valider l’action focus (méta → Lire) |
| B | Retour bibliothèque |

## Mode Fiche série (landscape)

| Contrôle | Action |
|----------|--------|
| ←→ / ↑↓ | Focus tomes → Ouvrir → Retour |
| A | Ouvrir la **fiche tome** focus (ou suivant non lu) |
| B | Retour bibliothèque |

## Mode Profils / Setup / Import / Boot / Paramètres

Navigation D-Pad **et stick** (identité landscape).  

### Import

**Liste**

| Contrôle | Action |
|----------|--------|
| ↑↓ | Naviguer les fichiers / footer Rescanner · Retour |
| A | Ouvrir la **fiche** (onglet Infos) — pas d’import immédiat |
| X | **Importer le tome focus** (méta sélectionnées API, sinon défaut détecté) |
| Y | **Tout importer** — chaque item : méta sélectionnées si présentes, sinon défaut |
| B | Retour bibliothèque |

Pastilles à gauche de chaque ligne : **bleue** = méta détectées · **rouge** = aucune méta · **verte** = choix résultat API.

**Fiche — onglet Infos**

| Contrôle | Action |
|----------|--------|
| ↑↓ | Champs méta (titre, série, tome…) → footer |
| LT / RT | Onglet Infos ↔ Recherche |
| A | Éditer le champ focus · **uniquement** CTA footer focusé pour importer / fermer |
| X | **Importer ce tome** |
| B | Retour liste |

A **n’importe pas** et **ne ferme pas** tant que le focus n’est pas sur un CTA footer explicite.

**Fiche — onglet Recherche**

| Contrôle | Action |
|----------|--------|
| ↑↓ | Mots-clés → source API → Lancer recherche → résultats → footer |
| ←→ sur source | Changer de provider (AniList, MangaDex, OpenLibrary…) |
| LT / RT | Onglet Infos ↔ Recherche |
| A | Appliquer le **résultat focusé** · éditer mots-clés · lancer search · CTA footer |
| Y | **Relancer** la recherche API |
| B | Retour **Infos** (champs / résultats) · liste si CTA Retour |

Footer compact (pas d’overflow boutons). Scroll `.shell-scroll`.

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
