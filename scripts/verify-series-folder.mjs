/**
 * Vérifie le fallback série = nom du dossier parent (hors blacklist).
 * Priorité : série déjà définie (filename/API) > dossier parent.
 */
import assert from 'assert';
import { detectFromFilename } from '../src/main/metadata/parse-filename.js';
import {
  isGenericSeriesFolderName,
  parentFolderName,
  seriesFromParentFolder,
  GENERIC_SERIES_FOLDER_NAMES,
} from '../src/shared/series.js';

// --- helpers purs ---
assert.equal(parentFolderName('/import/One Piece/T01.cbz'), 'One Piece');
assert.equal(parentFolderName('C:\\Library\\Naruto\\vol12.cbz'), 'Naruto');
assert.equal(parentFolderName('/solo.cbz'), null);
assert.equal(parentFolderName('C:/file.cbz'), null);

assert.equal(isGenericSeriesFolderName('Downloads'), true);
assert.equal(isGenericSeriesFolderName('téléchargements'), true);
assert.equal(isGenericSeriesFolderName('BD'), true);
assert.equal(isGenericSeriesFolderName('Manga'), true);
assert.equal(isGenericSeriesFolderName('Import'), true);
assert.equal(isGenericSeriesFolderName('Library'), true);
assert.equal(isGenericSeriesFolderName('One Piece'), false);
assert.ok(GENERIC_SERIES_FOLDER_NAMES.includes('comics'));

// Fallback uniquement si aucune série
assert.equal(seriesFromParentFolder('/import/One Piece/T01.cbz'), 'One Piece');
assert.equal(seriesFromParentFolder('/import/One Piece/T01.cbz', 'API Series'), null);
assert.equal(seriesFromParentFolder('/import/One Piece/T01.cbz', '  '), 'One Piece');
assert.equal(seriesFromParentFolder('/Downloads/T01.cbz'), null);
assert.equal(seriesFromParentFolder('/Comics/foo.cbz'), null);
assert.equal(seriesFromParentFolder('/Library/Books/bar.cbz'), null);

// --- detectFromFilename : filename gagne ---
const fromName = detectFromFilename('/Import/WrongFolder/One Piece - Tome 03.cbz');
assert.equal(fromName.series, 'One Piece');
assert.equal(fromName.seriesSource, 'filename');
assert.equal(fromName.volume, 3);
assert.equal(fromName.source, 'filename');

// --- detectFromFilename : fallback dossier ---
const fromFolder = detectFromFilename('/import/Berserk/Tome 01.cbz');
assert.equal(fromFolder.series, 'Berserk');
assert.equal(fromFolder.seriesSource, 'folder');
assert.equal(fromFolder.source, 'folder');
assert.equal(fromFolder.volume, 1);

// « Tome » seul ne bloque pas le fallback dossier
const tomeOnly = detectFromFilename('/Comics/Sandman/Tome 02.cbz');
// parent = Sandman (Comics est grand-parent ; blacklist ne s’applique qu’au parent)
assert.equal(tomeOnly.series, 'Sandman');
assert.equal(tomeOnly.seriesSource, 'folder');
assert.equal(tomeOnly.volume, 2);

// Dossier générique → pas de série dossier
const generic = detectFromFilename('/Downloads/random-scan.cbz');
assert.equal(generic.series, null);
assert.equal(generic.seriesSource, null);

// Plusieurs tomes même dossier → même série
const t1 = detectFromFilename('/media/Akira/01.cbz');
const t2 = detectFromFilename('/media/Akira/02.cbz');
assert.equal(t1.series, 'Akira');
assert.equal(t2.series, 'Akira');
assert.equal(t1.seriesSource, 'folder');

console.log('verify-series-folder: OK');
