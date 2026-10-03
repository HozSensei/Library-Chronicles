/**
 * Vérifie le parse série/tome + regroupement.
 */
import assert from 'assert';
import { detectFromFilename } from '../src/main/metadata/parse-filename.js';
import {
  seriesIdFromName,
  groupBooksBySeries,
  findNextUnreadVolume,
} from '../src/main/database/series.js';

const one = detectFromFilename('/lib/One Piece - Tome 03 (2019).cbz');
assert.equal(one.series, 'One Piece');
assert.equal(one.volume, 3);
assert.equal(one.year, 2019);

const two = detectFromFilename('/lib/Naruto Vol.12.cbz');
assert.ok(two.series);
assert.equal(two.volume, 12);

const sid = seriesIdFromName('One Piece');
assert.equal(sid, 'one-piece');

const books = [
  {
    id: 1,
    title: 'OP T1',
    series: 'One Piece',
    seriesId: 'one-piece',
    volume: 1,
    status: 'finished',
  },
  {
    id: 2,
    title: 'OP T2',
    series: 'One Piece',
    seriesId: 'one-piece',
    volume: 2,
    status: 'unread',
  },
  {
    id: 3,
    title: 'Solo',
    series: null,
    seriesId: null,
    volume: null,
    status: 'unread',
  },
];

const { groups, singles } = groupBooksBySeries(books);
assert.equal(groups.length, 1);
assert.equal(groups[0].volumeCount, 2);
assert.equal(groups[0].nextUnread.id, 2);
assert.equal(singles.length, 1);

const next = findNextUnreadVolume(books, {
  seriesId: 'one-piece',
  afterBookId: 1,
});
assert.equal(next.id, 2);

console.log('verify-series: OK');
