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

### 2. Checklist smoke Ally packagée

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

Étendre / croiser avec la checklist de [`PACKAGING.md`](./PACKAGING.md).

### 3. Figer `main` / tag `v0.1.0`

- Stabiliser `main` après smoke Ally OK.
- Tag Git annoté : `v0.1.0`.
- (Optionnel) GitHub Release avec les binaires Win x64.

---

## Distribution (après tag)

### 4. Auto-update

- Intégrer **electron-updater**.
- Publier / consommer les mises à jour via **GitHub Releases**.
- Smoke : install v0.1.0 → release suivante → update packagée sur Ally.

### 5. Migrations SQL versionnées

- Schéma SQLite évolutif (versions numérotées).
- Migration au démarrage ; conserver le fallback JSON si natif KO.
- Tests de montée de version depuis une DB v0.1.0.

### 6. Icône / `productName` Library Chronicles dans le package

- Confirmer `productName`, raccourcis NSIS, `build/icon.png` / `.ico` dans l’installeur.
- Vérifier favicon / wordmark / mark UI alignés branding.

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
| [`PACKAGING.md`](./PACKAGING.md) | Build Win + checklist Ally |
| [`NATIVE.md`](./NATIVE.md) | better-sqlite3 / PDF / rebuild |
| [`PERF.md`](./PERF.md) | Perf & caches |
| [`SECURITY.md`](./SECURITY.md) | Audit deps / Node ≥ 22.12 |
