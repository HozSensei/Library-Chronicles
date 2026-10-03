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
npm test
npm start
```

Packaging Windows (sur machine Win x64) :

```bash
npm run dist:win
```

Voir [`docs/PACKAGING.md`](./docs/PACKAGING.md).

Fenêtre cible : **1080 × 1920** (portrait).

Au **premier lancement**, un wizard configure dossiers (library / import), langue, thème et orientation. L’app reste bloquée sur le setup tant que `setupCompleted` n’est pas vrai.

## Parcours

1. **Setup** — dossiers, thème sombre/clair, orientation Ally
2. **Import** — déposer des CBZ/CBR/PDF dans le dossier import → review métadonnées → bibliothèque (rafraîchi aussi via watcher FS)
3. **Bibliothèque** — grille couvertures, filtres, Continuer
4. **Lecteur** — pan / zoom / pages manette, HUD (Y), Fit Width (X), Manga (A) ; PDF fidèle via Chromium
5. **Paramètres** — thème, haptics, remapping, providers métadonnées (clés en userData)

## Stack

| Couche | Techno |
|--------|--------|
| UI | Vue 3 (Composition API) |
| Bundler | Vite (`electron-vite`) |
| État | Pinia |
| Routes | Vue Router |
| Manette | `useGamepad` + `portrait-remap` + `key-bindings` |
| DB | better-sqlite3 (+ fallback JSON) |
| PDF | pdfjs-dist + canvas Chromium |
| Packaging | electron-builder (NSIS + portable) |

## Documentation

| Fichier | Contenu |
|---------|---------|
| [`ROADMAP.md`](./ROADMAP.md) | Phases & statut |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Main / preload / renderer |
| [`docs/CONTROLS.md`](./docs/CONTROLS.md) | Mapping manette + remap |
| [`docs/UX.md`](./docs/UX.md) | Principes UX |
| [`docs/METADATA.md`](./docs/METADATA.md) | Providers méta (gratuit / clé) |
| [`docs/NATIVE.md`](./docs/NATIVE.md) | better-sqlite3 / PDF / rebuild |
| [`docs/PACKAGING.md`](./docs/PACKAGING.md) | Build Windows |

## better-sqlite3 sous Electron

Si le module natif ne charge pas dans Electron :

```bash
npm run rebuild:native
# ou
npx @electron/rebuild -f -w better-sqlite3
```

`npm run dist:win` lance automatiquement le rebuild (`predist:win`).  
Sinon l’app bascule automatiquement sur un **store JSON** dans `userData` (voir `docs/NATIVE.md`).
