# Checklist smoke Ally — Library Chronicles v0.1

Smoke **packagé** (NSIS ou portable), pas `npm run dev`.  
À croiser avec [`PACKAGING.md`](./PACKAGING.md) et [`PLAN-v0.1.md`](./PLAN-v0.1.md).

**Machine :** ROG Ally / Ally X · Windows 11 x64 · manette intégrée.

---

## Préparation

- [ ] Artefact installé : `Library Chronicles-0.1.0-win-x64.exe` (NSIS) **ou** portable
- [ ] Nom affiché / raccourci : **Library Chronicles**
- [ ] Icône cohérente (raccourci + fenêtre)
- [ ] Premier boot : écran profils / setup OK (pas de crash natif)

---

## Boot & profils

- [ ] Boot app → écran profils (« Qui lit ? »)
- [ ] Créer / sélectionner un profil
- [ ] Setup : dossiers bibliothèque + import
- [ ] Langue FR/EN bascule (si testé)
- [ ] Thème clair/sombre + accent

---

## Bibliothèque & import

- [ ] Import CBZ
- [ ] Import CBR (si dispo)
- [ ] Ouverture PDF
- [ ] Ouverture EPUB (reflow / pagination)
- [ ] Grille bibliothèque + jaquettes
- [ ] Fiche livre / série (si tomes)
- [ ] Watcher : ajouter un fichier dans le dossier → refresh sans relancer

---

## Lecture (formats image)

- [ ] Mode page à page
- [ ] Mode strip / continu (si proposé)
- [ ] Zoom D-Pad + pan stick
- [ ] Remap portrait lecteur (fenêtre landscape + CSS +90°)
- [ ] Menu pause (Start) + plein écran
- [ ] Progression conservée après quit / relance

---

## Manette Ally

- [ ] Nav menus (D-Pad / stick focus)
- [ ] A valider / B retour
- [ ] LB/RB onglets (bibliothèque / réglages selon écran)
- [ ] Lecteur : pages + zoom + sticks
- [ ] Haptics (Paramètres → Vibrations) si manette détectée

---

## Stabilité

- [ ] Quit propre → relance sans perte profils / progression
- [ ] SQLite OK **ou** fallback JSON (logs) sans crash
- [ ] Pas de freeze > 5 s sur ouverture tome typique

---

## Auto-update (après première Release GitHub)

- [ ] Installer `v0.1.0` packagée
- [ ] Publier une release `v0.1.1` (ou draft test) avec artefacts + `latest.yml`
- [ ] Relancer l’app → toast « mise à jour disponible / téléchargement / prête »
- [ ] Quitter → install auto au redémarrage
- [ ] Version affichée / comportement cohérent post-update

---

## Verdict

| Résultat | Case |
|----------|------|
| Smoke OK → tag `v0.1.0` + Release | [ ] |
| Bloquant trouvé (noter ici) | |

```
Notes :
…
```
