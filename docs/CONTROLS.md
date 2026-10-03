# Mapping manette — ROG Ally X & landscape

Implémentation : `portrait-remap.js` → `key-bindings.js` → `useGamepad.js`.

## Pipeline d’entrée

1. **Physique** (indices Gamepad API / XInput)
2. **Remap orientation** (`portrait-ccw` ou `landscape`) pour D-Pad / stick
3. **Mapping utilisateur** (défauts + overrides persistés dans la config)
4. **Action** dispatchée selon l’écran (boot / profiles / library / reader / …)

Le remapping se configure dans **Paramètres → Manette**.

## Orientation appareil

### Portrait Ally (`portrait-ccw`) — défaut produit

Ally tenue **en portrait**, tournée de **90° anti-horaire** :

| Physique (XInput) | Logique (écran portrait) |
|-------------------|--------------------------|
| D-Pad / stick ↑   | ← gauche                 |
| D-Pad / stick ↓   | → droite                 |
| D-Pad / stick ←   | ↑ haut                   |
| D-Pad / stick →   | ↓ bas                    |

Stick : `logicalX = physicalY`, `logicalY = physicalX`.  
Fenêtre Electron : **1080×1920**.

### Landscape classique (`landscape`)

Manette et écran alignés (desktop / usage horizontal) :

| Physique (XInput) | Logique |
|-------------------|---------|
| D-Pad / stick ↑↓←→ | **inchangé** (physique = logique) |

Aucun remap 90°. Fenêtre Electron : **1920×1080** (redimensionnable, min 960×540).

### Activer landscape

1. **Setup** (1ʳᵉ fois) — étape Préférences → « Landscape classique »
2. **Paramètres → Général** — « Landscape classique » / « Portrait Ally »
3. **CLI** — `npm run dev -- --landscape` (ou `--portrait`)
4. **Raccourci clavier (dev)** — `Ctrl+Shift+L` pour basculer

La préférence est persistée dans `vdr-config.json` (`orientation`).

## Mode Lecture *(directions = écran, mapping défaut)*

| Contrôle | Action |
|----------|--------|
| Stick L | Pan (ou scroll vertical en webtoon) |
| L3 / R3 | Toggle Fit Height ↔ Zoom 100 % |
| D-Pad ↑ / ↓ | Zoom ±15 % (pages ±1 en webtoon) |
| D-Pad ← / → | Page ±1 (inversé en Manga) |
| A | LTR ↔ RTL |
| B | Fermer → bibliothèque |
| X | **Ajouter un signet** |
| Y | HUD on/off (onglets Lecture / Filtres / Signets) |
| Select | Mode webtoon on/off |
| LB | Fit Width |
| RB | Tome suivant non lu (série) |
| LT / RT | Chapitre ±1 (ou ±10 pages) |

## Mode Bibliothèque

| Contrôle | Action |
|----------|--------|
| D-Pad / stick | Curseur grille / séries |
| A | Ouvrir (ou tome suivant non lu en vue séries) |
| B | Retour |
| X | Import |
| Select | Basculer vue livres ↔ séries |
| Start | Paramètres |
| LT / RT | Filtre statut |

Grille : **3 colonnes** en portrait, **6** en landscape (curseur aligné).

## Mode Profils

| Contrôle | Action |
|----------|--------|
| D-Pad / stick | Curseur profil |
| A | Choisir |

## Clavier / souris (dev sans Ally)

Toutes les actions UI sont cliquables : boutons toolbar, HUD, signets, sliders filtres, tuiles catalogue.  
Le focus manette reste visible ; sans pad, naviguer à la souris suffit pour valider les features.
