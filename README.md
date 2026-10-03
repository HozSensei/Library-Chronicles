# Vertical Deck Reader (VDR)

Lecteur de BD, comics et mangas **vertical**, pensé manette pour **ROG Ally X** (Windows, portrait).

**Electron + Vue 3 + Vite + Pinia** — *Library Chronicles*.

## Démarrage

```bash
npm install
npm run dev
```

Build / tests :

```bash
npm run build
npm run test:remap
npm run test:cbz
npm start
```

Fenêtre cible : **1080 × 1920** (portrait).

Au **premier lancement**, un wizard configure dossiers (library / import), langue, thème et orientation. L’app reste bloquée sur le setup tant que `setupCompleted` n’est pas vrai.

## Parcours

1. **Setup** — dossiers, thème sombre/clair, orientation Ally
2. **Import** — déposer des CBZ/CBR/PDF dans le dossier import → review métadonnées → bibliothèque
3. **Bibliothèque** — grille couvertures, filtres, Continuer
4. **Lecteur** — pan / zoom / pages manette, HUD (Y), Fit Width (X), Manga (A)
5. **Paramètres** — thème, remapping touches, clé API ComicVine

## Stack

| Couche | Techno |
|--------|--------|
| UI | Vue 3 (Composition API) |
| Bundler | Vite (`electron-vite`) |
| État | Pinia |
| Routes | Vue Router |
| Manette | `useGamepad` + `portrait-remap` + `key-bindings` |
| DB | better-sqlite3 (+ fallback JSON) |

## Documentation

| Fichier | Contenu |
|---------|---------|
| [`ROADMAP.md`](./ROADMAP.md) | Phases & statut |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Main / preload / renderer |
| [`docs/CONTROLS.md`](./docs/CONTROLS.md) | Mapping manette + remap |
| [`docs/UX.md`](./docs/UX.md) | Principes UX |
| [`docs/NATIVE.md`](./docs/NATIVE.md) | better-sqlite3 / Electron rebuild |

## better-sqlite3 sous Electron

Si le module natif ne charge pas dans Electron :

```bash
npx @electron/rebuild -f -w better-sqlite3
```

Sinon l’app bascule automatiquement sur un **store JSON** dans `userData` (voir `docs/NATIVE.md`).
