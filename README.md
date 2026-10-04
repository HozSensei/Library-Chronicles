# Library Chronicles

Lecteur de BD, comics et mangas pensé manette pour **ROG Ally X**.  
**Menus en paysage** · **lecture en portrait** (bascule automatique).

**Electron + Vue 3 + Vite + Pinia + Tailwind** — code historique parfois abrégé *VDR*.

Prérequis : **Node ≥ 22.12.0**. Sécurité deps : [`docs/SECURITY.md`](./docs/SECURITY.md).

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

Fenêtres : **1920 × 1080** (menus) → **1080 × 1920** à l’ouverture d’un livre, restore au retour.

Au **premier lancement** : **choix de profil** → setup (dossiers / thème) **par profil**.  
Chaque profil a sa propre bibliothèque (chemins + index DB isolés).

## Reset bibliothèque

```bash
npm run reset:library          # wipe livres, progression, covers (profils conservés)
npm run reset:app              # + rejouer le setup (flags setup)
npm run reset:app -- --all     # TOUT : profils, config, secrets, DB, covers
```

Override du dossier userData : `VDR_USER_DATA=/chemin npm run reset:library`.

## Parcours

1. **Profils** — ronds avatar / initiale + bouton **+** (premier écran)
2. **Setup** — dossiers, thème, langue **du profil**
3. **Bibliothèque** — catalogue type TV (héro, En cours, filtres, rails posters)
4. **Import** — CBZ/CBR/PDF · check déjà importé · Enrichir
5. **Fiche livre** — cover · détails · synopsis · Lire
6. **Lecteur** — portrait, Select = pause, D-Pad ←→ zoom
7. **Paramètres** — thème, haptics, remap, providers métadonnées

## Stack

| Couche | Techno |
|--------|--------|
| UI | Vue 3 + Tailwind CSS |
| Bundler | Vite (`electron-vite`) |
| État | Pinia |
| Routes | Vue Router |
| Manette | `useGamepad` (contexte ui / reader) |
| DB | better-sqlite3 (+ fallback JSON) |
| PDF | pdfjs-dist + canvas Chromium |
| Packaging | electron-builder (NSIS + portable) |

## Documentation

| Fichier | Contenu |
|---------|---------|
| [`ROADMAP.md`](./ROADMAP.md) | Phases & statut |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Main / preload / renderer |
| [`docs/CONTROLS.md`](./docs/CONTROLS.md) | Mapping manette + remap |
| [`docs/UX.md`](./docs/UX.md) | Principes UX Steam OS |
| [`docs/METADATA.md`](./docs/METADATA.md) | Providers méta (UI / secrets) |
| [`docs/metadata/README.md`](./docs/metadata/README.md) | Contrat NormalizedMeta + docs réponses API |
| [`docs/NATIVE.md`](./docs/NATIVE.md) | better-sqlite3 / PDF / rebuild |
| [`docs/PACKAGING.md`](./docs/PACKAGING.md) | Build Windows |

## better-sqlite3 sous Electron

`npm install` doit réussir sans Build Tools : `better-sqlite3` est en
`dependencies`, mais le `postinstall` est **soft** et ne bloque jamais
(Linux / Windows). Si le module manque, `npm run rebuild:native` tente
de l’installer puis de rebuild pour Electron.

Si le module natif ne charge pas dans Electron (lecture SQLite) :

1. Installer les Build Tools Windows (Visual Studio C++)
2. Relancer `npm run rebuild:native`
3. Sinon l’app bascule automatiquement sur le fallback JSON
