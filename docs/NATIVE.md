# Modules natifs — Vertical Deck Reader

## better-sqlite3

La base bibliothèque utilise `better-sqlite3`. Le binaire natif doit correspondre à la version d’**Electron** (pas seulement à Node).

### Rebuild recommandé

```bash
npm install
npx @electron/rebuild -f -w better-sqlite3
```

Ou via `electron-rebuild` équivalent selon la toolchain.

### Fallback

Si le chargement échoue au runtime, `src/main/database/db.js` bascule sur un fichier JSON (`userData/vdr-library.json`).  
L’app **démarre** et conserve titres / progression / couvertures ; seules certaines perfs SQL avancées manquent.

### Packaging

Lors du packaging Windows, inclure le rebuild dans le pipeline CI (postinstall / electron-builder `afterPack`).

## PDF (pdfjs-dist)

Le rendu page → image privilégie le package optionnel `canvas`.  
Sans `canvas` ni `OffscreenCanvas`, un **placeholder PNG** est servi pour que le flux lecteur reste testable.  
Pour un rendu PDF fidèle en production : `npm i canvas` (dépendances système Cairo) ou rendu via une BrowserWindow utilitaire.

## Secrets API

Les clés (ex. ComicVine) sont stockées dans `userData/vdr-secrets.json`, séparées de `vdr-config.json`, avec `chmod 600` quand le FS le permet. **Jamais** commités dans le dépôt.
