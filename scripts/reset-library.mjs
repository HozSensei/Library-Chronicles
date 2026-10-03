#!/usr/bin/env node
/**
 * Reset bibliothèque / données VDR (rejouer le setup).
 *
 * Usage :
 *   npm run reset:library          # wipe livres, progression, signets, covers
 *                                   # conserve profils + chemins (re-setup possible via flag)
 *   npm run reset:library -- --setup  # + reset setupCompleted (global + profils)
 *   npm run reset:app                 # alias de reset:library -- --setup
 *   npm run reset:app -- --all        # TOUT : profils, prefs, config, secrets, DB, covers
 *
 * Cherche userData Electron dans les emplacements standards (dev / packagé).
 * Override : VDR_USER_DATA=/chemin/custom
 *
 * Ne touche PAS aux fichiers CBZ/CBR/PDF sur disque (libraryRoot / importRoot).
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const args = process.argv.slice(2);
const wipeAll = args.includes('--all');
const resetSetup = wipeAll || args.includes('--setup') || process.env.npm_lifecycle_event === 'reset:app';

function candidateUserDataDirs() {
  if (process.env.VDR_USER_DATA) {
    return [path.resolve(process.env.VDR_USER_DATA)];
  }
  const home = os.homedir();
  const candidates = [];
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    candidates.push(path.join(appData, 'vertical-deck-reader'));
    candidates.push(path.join(appData, 'Vertical Deck Reader'));
  } else if (process.platform === 'darwin') {
    candidates.push(
      path.join(home, 'Library', 'Application Support', 'vertical-deck-reader'),
    );
    candidates.push(
      path.join(home, 'Library', 'Application Support', 'Vertical Deck Reader'),
    );
  } else {
    const xdg = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    candidates.push(path.join(xdg, 'vertical-deck-reader'));
    candidates.push(path.join(xdg, 'Vertical Deck Reader'));
    // electron-vite / Electron sous Linux
    candidates.push(path.join(home, '.config', 'vertical-deck-reader'));
  }
  return candidates;
}

function rmSafe(target) {
  if (!fs.existsSync(target)) return false;
  fs.rmSync(target, { recursive: true, force: true });
  return true;
}

function wipeCovers(userData) {
  return rmSafe(path.join(userData, 'covers'));
}

function wipeDbFiles(userData) {
  let n = 0;
  for (const name of [
    'vdr-library.sqlite',
    'vdr-library.sqlite-wal',
    'vdr-library.sqlite-shm',
    'vdr-library.json',
  ]) {
    if (rmSafe(path.join(userData, name))) n += 1;
  }
  return n;
}

function patchConfig(userData, { clearProfiles, forceSetup }) {
  const cfgPath = path.join(userData, 'vdr-config.json');
  if (!fs.existsSync(cfgPath)) {
    if (forceSetup || clearProfiles) {
      const next = {
        setupCompleted: false,
        libraryRoot: null,
        importRoot: null,
        language: 'fr',
        theme: 'dark',
        orientation: 'landscape',
        activeProfileId: null,
        profileSelected: false,
        keyBindings: null,
        hapticsEnabled: true,
        metadataProvider: 'anilist',
      };
      fs.writeFileSync(cfgPath, JSON.stringify(next, null, 2), 'utf8');
      return 'created';
    }
    return 'missing';
  }
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch {
    cfg = {};
  }
  cfg.orientation = 'landscape';
  cfg.profileSelected = false;
  if (forceSetup) {
    cfg.setupCompleted = false;
    cfg.libraryRoot = null;
    cfg.importRoot = null;
  }
  if (clearProfiles) {
    cfg.activeProfileId = null;
    cfg.setupCompleted = false;
    cfg.libraryRoot = null;
    cfg.importRoot = null;
  }
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
  return 'updated';
}

function wipeSecrets(userData) {
  return rmSafe(path.join(userData, 'vdr-secrets.json'));
}

function main() {
  const dirs = candidateUserDataDirs().filter((d) => fs.existsSync(d));
  if (!dirs.length) {
    console.log('Aucun dossier userData VDR trouvé.');
    console.log('Emplacements cherchés :');
    for (const d of candidateUserDataDirs()) console.log('  -', d);
    console.log('\nAstuce : VDR_USER_DATA=/chemin npm run reset:library');
    process.exit(0);
  }

  console.log(
    wipeAll
      ? 'Mode --all : reset complet (profils + config + DB + covers + secrets)'
      : resetSetup
        ? 'Mode setup : wipe bibliothèque + rejouer le wizard'
        : 'Mode library : wipe livres / progression / covers (profils conservés)',
  );

  for (const userData of dirs) {
    console.log('\n→', userData);
    const covers = wipeCovers(userData);
    const dbN = wipeDbFiles(userData);
    const cfg = patchConfig(userData, {
      clearProfiles: wipeAll,
      forceSetup: resetSetup || wipeAll,
    });
    const secrets = wipeAll ? wipeSecrets(userData) : false;
    console.log(`  covers: ${covers ? 'supprimé' : 'absent'}`);
    console.log(`  db/json: ${dbN} fichier(s) retiré(s)`);
    console.log(`  config: ${cfg}`);
    if (wipeAll) console.log(`  secrets: ${secrets ? 'supprimé' : 'absent'}`);
  }

  console.log('\nReset terminé. Relance l’app (npm run dev).');
  if (!wipeAll) {
    console.log('Pour tout effacer y compris profils : npm run reset:app -- --all');
  }
}

main();
