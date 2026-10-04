# Plan d’action post-v0.1 (Ally)

Suite opérationnelle après le cycle de développement v0.1 sur **ROG Ally**.  
Complète le cadrage historique dans [`ROADMAP.md`](../ROADMAP.md) (phases 0–7 déjà livrées).

**Enchaînement validé :** Packaged Ally smoke → tag `v0.1.0` → auto-update + migrations.

---

## Urgent — avant ship hors dev

### 1. Build Windows réel (`dist:win`) + install sur Ally

- Exécuter `npm run dist:win` sur machine **Windows x64** (Ally ou PC Win).
- Produire NSIS + portable dans `dist/` (voir [`PACKAGING.md`](./PACKAGING.md)).
- Installer l’artefact NSIS (ou lancer le portable) sur l’Ally cible.
- Vérifier démarrage, icône, nom affiché **Library Chronicles**, SQLite ou fallback JSON.
- **Note cloud/Linux :** cross-build souvent KO (`better-sqlite3`) — ne pas forger d’`.exe` ; suivre la procédure Win.

### 2. Checklist smoke Ally packagée

Checklist exécutable : [`ALLY-SMOKE.md`](./ALLY-SMOKE.md).

Sur build **packagée** (pas `npm run dev`) :

- [ ] Boot app + écran profils
- [ ] Setup / ouverture bibliothèque
- [ ] Import CBZ / CBR
- [ ] Ouverture PDF
- [ ] Ouverture EPUB (mode reflow)
- [ ] Lecture page + strip (formats image)
- [ ] Manette : nav menus, remap portrait lecteur, zoom / pages
- [ ] Haptics (si manette détectée)
- [ ] Watcher : ajout fichier → refresh
- [ ] Quit / relance : progression & profils conservés

### 3. Figer `main` / tag `v0.1.0`

- Stabiliser `main` après smoke Ally OK (+ branding logo déjà sur `main`).
- Tag Git annoté : `v0.1.0` (voir commandes dans [`PACKAGING.md`](./PACKAGING.md)).
- GitHub Release avec binaires Win x64 **et** `latest.yml` / blockmaps (requis updater).

**Ne pas tagger depuis un agent Linux** sans artefacts Win réels et validation utilisateur.

---

## Distribution (après tag)

### 4. Auto-update — **implémenté (code)**

- `electron-updater` + provider GitHub `HozSensei/Library-Chronicles`
- Check au boot (packaged), toasts FR/EN, install au quit
- Reste à faire **sur Win/Ally** : publier une Release, puis smoke update `v0.1.0` → `v0.1.1`

### 5. Migrations SQL versionnées — **ensuite**

- Schéma SQLite évolutif (versions numérotées).
- Migration au démarrage ; conserver le fallback JSON si natif KO.
- Tests de montée de version depuis une DB v0.1.0.
- *(Amorce code reportée après validation auto-update Ally.)*

### 6. Icône / `productName` Library Chronicles dans le package

- Confirmé en config : `productName`, raccourcis NSIS, `build/icon.png` / `.ico`.
- Branding UI mergé (#87) : wordmark + mark + favicon teinté.

---

## Plus tard

| Sujet | Note |
|-------|------|
| EPUB TOC | Table des matières navigable (au-delà des chapitres LT/RT / spine) |
| Perf covers | Poursuivre lazy / cache / skeletons (voir [`PERF.md`](./PERF.md)) |
| MOBI | Uniquement si demande utilisateur explicite |
| Linux / macOS | Packaging secondaire ; Windows Ally reste la cible prioritaire |

---

## Hors scope (inchangé)

- OPDS / catalogues distants
- Bibliothèque réseau / sync cloud
- Comptes en ligne

---

## Références

| Doc | Rôle |
|-----|------|
| [`ROADMAP.md`](../ROADMAP.md) | Phases livrées & architecture |
| [`PACKAGING.md`](./PACKAGING.md) | Build Win + tag/Release + updater |
| [`ALLY-SMOKE.md`](./ALLY-SMOKE.md) | Checklist smoke Ally packagée |
| [`NATIVE.md`](./NATIVE.md) | better-sqlite3 / PDF / rebuild |
| [`PERF.md`](./PERF.md) | Perf & caches |
| [`SECURITY.md`](./SECURITY.md) | Audit deps / Node ≥ 22.12 |
