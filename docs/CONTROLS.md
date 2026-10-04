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

Trois chemins séparés selon le format / mode d’ouverture :

| Chemin | Formats | Stage |
|--------|---------|-------|
| **page** | CBZ / CBR / PDF | `PageReaderStage` — zoom/pan image |
| **strip** | CBZ / CBR / PDF | `StripReaderStage` — scroll vertical pages images |
| **epub** | EPUB | `EpubReaderStage` — texte reflow (spine) |

### Page (images) — défaut CBZ/CBR/PDF

| Contrôle | Action |
|----------|--------|
| Stick L | **Pan** si la page déborde (clampé ; au bord / page entière = no-op) — **pas** de page |
| L3 / R3 | **Reset zoom** — page entière bord à bord, recentrée |
| D-Pad **↑** | **Zoom +** (×1.15, plafond ×4 de la page entière) |
| D-Pad **↓** | **Zoom −** (plancher = page entière) |
| D-Pad ← / → | Page ±1 (inversé en Manga) |
| A | LTR ↔ RTL |
| B | Fermer → bibliothèque (restore landscape) |
| X | Ajouter un signet |
| Y | HUD onglets |
| **Select** | **Menu pause** (modal centrée, plan +90°) |
| LB | Fit Width |
| RB | Tome suivant non lu |
| LT / RT | Chapitre ±1 |

### Strip (continu vertical)

| Contrôle | Action |
|----------|--------|
| Stick L | **Scroll** 4 directions (même mapping local que le pan) |
| D-Pad / L3 / LB | **No-op** (pas de zoom CSS scale) |
| LT / RT | Chapitre ±1 |
| Select / A / B / X / Y | Identiques au mode page (pause, sens, signet, HUD, quitter) |

CTA fiche **« Lire en continu »** : disabled pour EPUB (et formats texte).

### EPUB (reflow paginé) — type liseuse

EPUB = XHTML/CSS reflow. Une **page** = un **viewport** (colonnes CSS), pas un chapitre spine entier.
Changement de taille police → **re-pagination** (reflow). Contenu isolé des filtres manga (brightness / sépia).

| Contrôle | Action |
|----------|--------|
| Stick L | **Page-écran** ±1 (discret + cooldown) ; en bout de chapitre → chapitre voisin |
| D-Pad ← / → | **Page-écran** ±1 ; en bout → chapitre / spine ±1 |
| D-Pad **↑** / **↓** | Taille police ±10 % (70–200 %) → reflow |
| L3 / R3 | Reset taille police (100 %) |
| LT / RT | Chapitre spine ±1 (atterrit début / fin) |
| LB Fit Width | **No-op** (pas d’image à fitter) |
| A / B / X / Y / Select | Sens, quitter, signet, HUD, pause (comme page) |

| Feature | CBZ/PDF page | EPUB |
|---------|--------------|------|
| Import / scan / watcher | oui | oui |
| Lire depuis fiche | oui | oui |
| Progression | index page | spine + écran viewport |
| Page ± | page image | **écran** puis chapitre |
| Stick | pan (zoom) | page-écran |
| Thème / filtres image | oui | **non** (encre `#1a1a1a` sur papier `#f4efe6`) |
| Taille police | non | oui (reflow) |
| Zoom image + pan clamp | oui | **non** |
| Strip vertical pages | oui | **non** (CTA disabled) |
| Fit-width image | oui | **non** |
| Jaquette à l’import | page 0 | OPF cover / cover-image |

Implémentation : **epub.js** (`epubjs`, BSD-2-Clause) dans `EpubReaderStage.vue`
(rendition paginée viewport). Helpers thème / stick : `src/shared/epub-pagination.js`
(plus de colonnes CSS + `translateX` maison — cause de décalage cumulatif).
Géométrie : `clientWidth`/`clientHeight` **locaux** du stage (pré-`rotate(90deg)`)
passés à `rendition.resize(w, h)` — pas d’AABB post-rotation.

### Modèle de transform — mode page

Un seul module, `src/shared/page-view-transform.js` (fonctions pures, sans DOM).
La vue (`PageReaderStage.vue`) **mesure** et injecte dans le store ; le store
**applique**. Plus de fit CSS `width/height`, plus d’ancrage écran, plus de
clamp dupliqué : l’échelle vient intégralement du `scale()` CSS.

| Grandeur | Définition |
|----------|------------|
| `stageW` / `stageH` | `clientWidth` / `clientHeight` du stage — dimensions **locales**, c.-à-d. avant le `rotate(90deg)` du plan. `computeFit({ rotate90: true })` transpose des mesures prises en espace écran. |
| `pageW` / `pageH` | `naturalWidth` / `naturalHeight` de la page (rendue à sa taille naturelle). |
| `fitScale` | `min(stageW / pageW, stageH / pageH)` — **contain**, page entière bord à bord. |
| `zoom` | facteur ∈ `[1, 4]`. `1` = page entière, `4` = plafond. |
| `scale` | `fitScale × zoom` — **minimum = `fitScale`**, donc jamais de dézoom sous la page entière. |
| `offset {x, y}` | pan en px stage. Clampé à `±débordement/2` par axe ; axe qui tient dans le stage ⇒ `0` (centré). |

Transform appliquée au calque `.reader__pan` (origin centre) :

```css
transform: translate(-50%, -50%) translate3d(offsetX, offsetY, 0) scale(fitScale × zoom);
```

`translate3d` précède `scale` dans la liste : l’offset reste exprimé en px stage,
il n’est pas mis à l’échelle.

**Garanties**

- **L3 / R3 = reset** → `zoom = 1`, `offset = 0` ⇒ page entière bord à bord **par
  construction**, sans dépendre d’une mesure DOM au moment de l’appui.
- **Pas de dézoom sous la page entière** : `clampZoom` plancher à `1`. Répéter
  D-Pad ↓ converge vers la page entière, jamais en-dessous.
- **Stick = pan seulement** : tant qu’un axe déborde, le stick fait du pan
  clampé ; au bord (ou page entière visible) ⇒ **no-op** — jamais de
  changement de page. Les pages se tournent uniquement au D-Pad ←/→.
- **Redimensionnement** (rotation, resize fenêtre) : le `zoom` est conservé,
  `fitScale` recalculé, l’offset reclampé aux nouvelles bornes.
- **Changement de page** (D-Pad ←/→) : le `zoom` est **conservé** ; l’offset
  est reclampé aux bornes du nouveau fit (recentré si un axe ne déborde plus).
  Ouverture / signet / chapitre / L3 → refit page entière.
- **Zoom ancré au centre** : `zoomAboutCenter` multiplie l’offset par le ratio
  de zoom, ce qui garde fixe le point de la page sous le centre du stage. La
  page étant toujours centrée par construction, aucune géométrie d’écran n’est
  mesurée (c’est ce que faisait l’ancien `panForZoomToScreenCenter`).

**Presets** (tous ≥ `fitScale`, donc toujours dans les bornes)

- **Fit Page** (défaut, L3) : `zoom = 1` → page entière.
- **Fit Width** (LB) : `zoom = widthScale / fitScale` → bord à bord en largeur,
  débordement vertical pannable.
- **Fit Height** : `zoom = heightScale / fitScale` → bord à bord en hauteur.

La préférence profil `defaultFitMode` n’est appliquée à l’ouverture que si elle
vaut explicitement `fit-width` ; sinon le lecteur ouvre sur la page entière.

### Menu pause ouvert *(même plan tourné +90° que le stage)*

Overlay dans `.reader__plane` (`rotate(90deg)`). Stick / D-Pad = **remap portrait
CCW** → directions écran (pas l’identité landscape des menus hors lecteur, pas
`visualPanToLocal` réservé au pan contenu).

| Contrôle | Action |
|----------|--------|
| D-Pad / stick | Focus dans la modal (↑/← précédent · ↓/→ suivant) |
| **A** | Valider (élément focalisé) |
| **B** / Select / Y | Fermer la modal (pas la lecture) |

## Stick menus (hors lecteur)

Hors route `reader`, le stick gauche se comporte comme le D-Pad :

1. Deadzone analogique (`0.18`) puis seuil discret (`0.45`)
2. Axe dominant → `up` / `down` / `left` / `right` (landscape : Haut=Haut)
3. Premier franchissement → pas immédiat ; maintien → délai ~320 ms puis repeat ~120 ms
4. Action via bindings `dpad:*` → `cursor-*` (+ `scrollIntoView` déjà en place)

En **lecteur**, le stick reste en **pan** analogique (axes physiques + `visualPanToLocal` sous +90°) — sauf modal pause (nav focus via remap portrait).

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
| ↑↓ | Naviguer header « Tout importer » ↔ fichiers |
| A | Ouvrir la **fiche** (ou BookDetail si déjà ✓) — pas d’import immédiat ; sur header = **Tout importer** |
| X | **Importer / retirer** le tome focus (toggle si déjà ✓) |
| Y | Libre sur liste (pas de bulk) — méta / recherche uniquement en fiche |
| B | Retour bibliothèque |

Bouton **Tout importer** à côté du titre (header) — clic ou focus manette + A. Plus de binding Y bulk (déclenchements accidentels).

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
| ←→ / stick | Dans une rangée (thème clair/sombre, pastilles accent) |
| ↑↓ / stick | Change de rangée / liste verticale (pas de wrap horizontal) |
| LB / RB | Section précédente / suivante |
| A | Valider / écouter (remap) / focus champ |
| B | Retour bibliothèque |

Remap UI : **lecture uniquement** + bouton Reset (défauts lecture).

## Clavier / souris (dev)

Toutes les actions UI sont cliquables. Focus manette visible.
