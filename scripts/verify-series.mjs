/**
 * Vérifie le parse série/tome + regroupement + récents dédupliqués.
 */
import assert from 'assert';
import { detectFromFilename } from '../src/main/metadata/parse-filename.js';
import {
  seriesIdFromName,
  groupBooksBySeries,
  findNextUnreadVolume,
  listRecentSeries,
  findSeriesGroup,
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
    createdAt: '2026-01-01T00:00:00.000Z',
    lastAccess: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 2,
    title: 'OP T2',
    series: 'One Piece',
    seriesId: 'one-piece',
    volume: 2,
    status: 'unread',
    createdAt: '2026-01-02T00:00:00.000Z',
    lastAccess: '2026-01-11T00:00:00.000Z',
  },
  {
    id: 3,
    title: 'Solo',
    series: null,
    seriesId: null,
    volume: null,
    status: 'unread',
    createdAt: '2026-01-03T00:00:00.000Z',
    lastAccess: null,
  },
  {
    id: 4,
    title: 'OP T3',
    series: 'One Piece',
    seriesId: 'one-piece',
    volume: 3,
    status: 'unread',
    createdAt: '2026-01-04T00:00:00.000Z',
    lastAccess: '2026-01-05T00:00:00.000Z',
  },
];

const { groups, singles } = groupBooksBySeries(books);
assert.equal(groups.length, 1);
assert.equal(groups[0].volumeCount, 3);
assert.equal(groups[0].nextUnread.id, 2);
assert.equal(groups[0].seriesCoverBookId, 1);
assert.equal(singles.length, 1);

const next = findNextUnreadVolume(books, {
  seriesId: 'one-piece',
  afterBookId: 1,
});
assert.equal(next.id, 2);

const found = findSeriesGroup(books, 'one-piece');
assert.ok(found);
assert.equal(found.volumeCount, 3);

// Récents : 1 entrée One Piece (dernier touché = T2) + Solo — pas 3× OP
const recent = listRecentSeries(books, 14);
assert.equal(recent.length, 2);
assert.equal(recent[0].kind, 'series');
assert.equal(recent[0].seriesId, 'one-piece');
assert.equal(recent[0].lastBook.id, 2);
assert.equal(recent[0].volumeCount, 3);
assert.equal(recent[1].kind, 'tome');
assert.equal(recent[1].lastBook.id, 3);

console.log('verify-series: OK');
