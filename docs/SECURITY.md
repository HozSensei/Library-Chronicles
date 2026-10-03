# Sécurité des dépendances npm — Vertical Deck Reader

## Politique

- Suivre `npm audit` après chaque bump majeur de toolchain (Electron, Vite, electron-builder).
- Priorité aux **critical** / **high** qui touchent le runtime de l’app (Electron / Chromium, extracteurs).
- Les vulns **dev-only / packaging** (téléchargement d’artefacts, rebuild natif) peuvent rester documentées si aucun fix semver-compatible n’existe.

## Correctifs appliqués (audit npm)

| Zone | Avant | Après | Effet |
|------|-------|-------|--------|
| Electron | 33.x | **41.10.7+** | Sortie du périmètre GHSA Electron ; remplacement de `extract-zip` par `@electron-internal/extract-zip` |
| electron-builder | 25.x | **26.17.x** | Correctifs `app-builder-lib` / `builder-util-runtime` / `tar` |
| electron-vite + Vite | 2.x / 5.x | **5.x / 6.4.3+** | esbuild ≥ 0.25 (fin de la vuln moderate du serveur de dev) |
| @electron/get (override) | 2–3.x via builder | **^5.1.0** | Évite `got` → `http-cache-semantics` dans l’arbre de build quand possible |
| pinia / vue-router | bumps mineurs | 2.3.1 / 4.6.x | hygiène, hors audit |

`pdfjs-dist` reste en **4.10.x** : les majors 5/6 changent les chemins `legacy/build` utilisés par les extracteurs PDF.

Node requis : **≥ 22.12.0** (exigence du paquet Electron ≥ 41).

## Risques restants / acceptés temporairement

### `http-cache-semantics` (HIGH, GHSA-ch52-4w7c-c8xp / CVE-2026-93748)

- **Statut** : aucune version npm patchée (≤ 4.2.0 = latest).
- **Chemin** : éventuellement encore présent via d’anciennes chaînes `got` / caches de build si un outil transitif la réintroduit.
- **Exposition VDR** : tooling de **build / download** (electron-builder, rebuild), pas le runtime lecteur pour l’utilisateur final. Le scénario d’attaque vise un **cache HTTP partagé multi-utilisateurs** avec `max-stale` — hors modèle de menace d’une app desktop locale.
- **Action** : surveiller un fix upstream ; conserver l’override `@electron/get@^5` pour limiter la surface.

### Electron / Chromium

- Rester sur une ligne **supportée** (41.x ou plus récent) et re-bump dès qu’un advisory npm recommande une version supérieure **testée** (`npm test` + `npm run build`).
- Un saut direct vers Electron 44.x est possible plus tard mais plus cassant (ABI natifs `better-sqlite3`, APIs).

### `better-sqlite3`

- Dépendance **optionnelle**, bumpée en **12.x** pour l’ABI V8 d’Electron 41.
- Échec de compile → fallback JSON (`docs/NATIVE.md`). Rebuild sur la machine Windows de packaging.

## Vérification

```bash
npm install
npm audit
npm test
npm run build
```

Documenter ici tout residual **high/critical** volontairement non forcé (`npm audit fix --force` interdit sans analyse de breaking change).
