# Modules natifs — Vertical Deck Reader

## better-sqlite3

La base bibliothèque utilise `better-sqlite3`. Le binaire natif doit correspondre à la version d’**Electron** (pas seulement à Node).

### Rebuild recommandé (Windows / Ally)

```bash
npm install
npm run rebuild:native
# équivalent : node scripts/rebuild-native.mjs
```

Le script :

- lit la version Electron installée ;
- lance `@electron/rebuild -f -w better-sqlite3` ;
- affiche un diagnostic clair si VS Build Tools manquent.

`postinstall` tente déjà ce rebuild (`|| true` pour ne pas casser `npm install` sur CI Linux).  
`predist` / `predist:win` le **réexécutent** avant packaging.

### Fallback JSON (anti-crash)

Si le chargement échoue au runtime, `src/main/database/db.js` bascule sur `userData/vdr-library.json` :

- l’app **démarre** ;
- titres / progression / couvertures sont conservés ;
- seules certaines perfs SQL avancées manquent.

Vérifier le mode dans les logs main : `[VDR] SQLite prêt` ou `[VDR] better-sqlite3 indisponible, fallback JSON`.

### Packaging

`electron-builder` :

- `asarUnpack` pour les `.node` / `better-sqlite3` ;
- `npmRebuild: true`.

Sur machine Windows : `npm run dist:win` (voir [`PACKAGING.md`](./PACKAGING.md)).

## PDF (pdfjs-dist)

Ordre de rendu page → PNG :

1. **Electron canvas Chromium** (`pdf-electron-canvas.js`) — BrowserWindow offscreen, **sans natif**
2. Package optionnel **`canvas`** (node-canvas / Cairo) si installé manuellement
3. `OffscreenCanvas` si exposé dans le process
4. **Placeholder PNG** — build / démarre / tests Node restent verts

```bash
# optionnel, machine de dev avec Cairo
npm i canvas --save-optional
```

## Watcher FS

`src/main/library/watcher.js` :

- `fs.watch` récursif sur **library** + **import** ;
- debounce + fenêtre de stabilité ;
- **fallback polling** si watch échoue ou enchaîne des erreurs.

## Haptics Ally

Renderer : `useHaptics.js` via `GamepadHapticActuator` / `vibrationActuator`.  
Setting `hapticsEnabled` (défaut on) — no-op si API / matériel absent.

## Secrets API

Clés (ex. ComicVine) dans `userData/vdr-secrets.json`, séparées de `vdr-config.json`, `chmod 600` si possible. **Jamais** commités.
