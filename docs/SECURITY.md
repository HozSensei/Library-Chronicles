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

## Résultat audit

Après correctement : **`npm audit` → 0 vulnérabilité** (critical/high/moderate/low).

## Surveillance / dettes volontaires

### Electron / Chromium

- Ligne actuelle : **41.10.7+** (hors périmètre des GHSA npm listés pour ≤41.10.5).
- Un saut vers **Electron 44.x** reste possible plus tard pour Chromium plus récent, mais plus cassant (ABI `better-sqlite3`, APIs) — non nécessaire tant que l’audit reste vert.

### `http-cache-semantics` (CVE-2026-93748)

- Toujours **sans patch npm upstream** (≤4.2.0). Mitigé chez VDR via override `@electron/get@^5.1.0` (plus de chaîne `got` → `cacheable-request` dans l’arbre actuel).
- Si un futur outil réintroduit la dépendance, l’audit remontera HIGH : conserver l’override et surveiller un fix kornelski.

### `better-sqlite3`

- Optionnelle, en **12.x** pour l’ABI V8 d’Electron 41.
- Échec de compile → fallback JSON (`docs/NATIVE.md`).

## Vérification

```bash
npm install
npm audit
npm test
npm run build
```

Documenter ici tout residual **high/critical** volontairement non forcé (`npm audit fix --force` interdit sans analyse de breaking change).
