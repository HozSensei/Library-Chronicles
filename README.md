# Vertical Deck Reader (VDR)

Lecteur de BD, comics et mangas **vertical**, pensé pour une utilisation manette sur **ROG Ally X** (Windows, mode portrait).

Projet Electron — *Library Chronicles*.

## Démarrage rapide

```bash
npm install
npm start
```

Mode développement (DevTools) :

```bash
npm run dev
```

Fenêtre cible : **1080 × 1920** (portrait).

## Documentation

| Fichier | Contenu |
|---------|---------|
| [`ROADMAP.md`](./ROADMAP.md) | Plan des phases & critères de done |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Structure des dossiers & flux IPC |

## État actuel

**Phase 0 — Squelette** en place :

- Fenêtre Electron portrait
- Preload sécurisé + canaux IPC
- Boucle Gamepad (détection + navigation menu boot)
- Stubs extracteurs (CBZ / CBR / PDF), SQLite, bibliothèque
- UI boot / bibliothèque / lecteur (placeholders)

Prochaine implémentation : **Phase 1** — CBZ réel + pan / zoom / pages manette.  
Voir le détail dans `ROADMAP.md`.

## Structure

```
src/
  main/          # Processus principal (FS, extracteurs, DB, IPC)
  preload/       # Bridge contextIsolation
  renderer/      # UI + Gamepad + moteur zoom/pan
  shared/        # Constantes IPC & mapping manette
```

## Contrôles (aperçu)

En **mode lecture** : joystick = pan, D-Pad = zoom / pages, A = sens Manga↔BD, B = quitter, Y = overlay.  
Mapping complet dans `ROADMAP.md` et `src/shared/controls.js`.

## Configuration Phase 1

Après `npm start`, le fichier de config utilisateur pourra contenir :

```json
{
  "phase1TestCbz": "D:\\\\BDs\\\\exemple.cbz"
}
```

(chemin absolu vers un CBZ de test — à brancher une fois l’extracteur Phase 1 implémenté).
