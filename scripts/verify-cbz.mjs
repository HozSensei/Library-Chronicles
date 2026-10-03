/**
 * Test extracteur CBZ avec archive minimale générée à la volée.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import JSZip from 'jszip';
import { openCbz } from '../src/main/extractors/cbz.js';
import { isImageEntry } from '../src/main/extractors/index.js';

function tinyPng(r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.from([0, r, g, b]);
  const compressed = zlib.deflateSync(raw);

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i += 1) {
      c ^= buf[i];
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function main() {
  const zip = new JSZip();
  zip.file('page1.png', tinyPng(200, 100, 50));
  zip.file('page2.png', tinyPng(50, 100, 200));
  zip.file('page10.png', tinyPng(20, 180, 80));
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  const tmp = path.join(os.tmpdir(), `vdr-test-${Date.now()}.cbz`);
  fs.writeFileSync(tmp, buf);

  const book = await openCbz(tmp, { isImageEntry });
  if (book.pageCount !== 3) throw new Error(`pageCount=${book.pageCount}`);
  if (book.pageNames[1] !== 'page2.png') throw new Error(`tri: ${book.pageNames}`);
  const page = await book.getPage(0);
  if (!page.buffer?.length) throw new Error('page vide');
  if (page.mime !== 'image/png') throw new Error(`mime=${page.mime}`);
  await book.close();
  fs.unlinkSync(tmp);
  console.log('OK  CBZ extracteur (3 pages, tri naturel, getPage)');
}

main().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
