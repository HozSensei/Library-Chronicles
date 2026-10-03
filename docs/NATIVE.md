# Modules natifs — Vertical Deck Reader

## better-sqlite3

La base bibliothèque utilise `better-sqlite3`. Le binaire natif doit correspondre à la version d’**Electron** (pas seulement à Node).

### Rebuild recommandé

```bash
npm install
npx @electron/rebuild -f -w better-sqlite3
# ou
npm run rebuild:native
```

### Fallback

Si le chargement échoue au runtime, `src/main/database/db.js` bascule sur un fichier JSON (`userData/vdr-library.json`).  
L’app **démarre** et conserve titres / progression / couvertures ; seules certaines perfs SQL avancées manquent.

### Packaging

`electron-builder` est configuré avec `asarUnpack` pour les `.node` et `npmRebuild: true`.  
Sur la machine Windows de build : `npm run dist:win` (voir [`PACKAGING.md`](./PACKAGING.md)).

## PDF (pdfjs-dist)

Ordre de rendu page → PNG :

1. **Electron canvas Chromium** (`pdf-electron-canvas.js`) — BrowserWindow offscreen, **sans natif** (chemin nominal sous Electron)
2. Package optionnel **`canvas`** (node-canvas / Cairo) si installé manuellement
3. `OffscreenCanvas` si exposé dans le process
4. **Placeholder PNG** — l’app build / démarre / tests Node restent verts

Installer `canvas` reste **optionnel** (dépendances système Cairo). Ne pas l’ajouter au `dependencies` du projet pour éviter de casser `npm install` sur les agents sans libs natives.

```bash
# optionnel, machine de dev avec Cairo
npm i canvas --save-optional
```

## Secrets API

Les clés (ex. ComicVine) sont stockées dans `userData/vdr-secrets.json`, séparées de `vdr-config.json`, avec `chmod 600` quand le FS le permet. **Jamais** commités dans le dépôt.
