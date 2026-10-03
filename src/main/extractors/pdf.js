import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let pdfjsLib = null;

async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  // ESM legacy build (compatible Node / Electron main)
  try {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch {
    // Fallback CJS si disponible
    pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  }

  try {
    const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  } catch {
    // Worker optionnel en main process
  }
  return pdfjsLib;
}

function tryLoadNodeCanvas() {
  try {
    return require('canvas');
  } catch {
    return null;
  }
}

async function tryLoadElectronCanvas() {
  if (!process.versions?.electron) return null;
  try {
    return await import('./pdf-electron-canvas.js');
  } catch {
    return null;
  }
}

/**
 * Rendu PDF page → PNG via :
 * 1. package optionnel `canvas` (node-canvas)
 * 2. OffscreenCanvas si dispo (rare en main)
 * 3. BrowserWindow Chromium (Electron) — fidèle, sans natif
 * 4. placeholder PNG (build/tests hors Electron)
 */
async function renderPageToPng(page, scale = 1.5) {
  const viewport = page.getViewport({ scale });
  const width = Math.floor(viewport.width);
  const height = Math.floor(viewport.height);

  const nodeCanvas = tryLoadNodeCanvas();
  if (nodeCanvas?.createCanvas) {
    try {
      const canvas = nodeCanvas.createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      return { buffer: canvas.toBuffer('image/png'), mime: 'image/png', engine: 'node-canvas' };
    } catch (err) {
      console.warn('[VDR] node-canvas render failed:', err.message);
    }
  }

  const CanvasCtor = globalThis.OffscreenCanvas;
  if (CanvasCtor) {
    try {
      const canvas = new CanvasCtor(width, height);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const ab = await blob.arrayBuffer();
      return { buffer: Buffer.from(ab), mime: 'image/png', engine: 'offscreencanvas' };
    } catch (err) {
      console.warn('[VDR] OffscreenCanvas render failed:', err.message);
    }
  }

  // Placeholder — le chemin Electron (fichier complet) est géré dans openPdf
  const placeholder = createPlaceholderPng(
    width > 0 ? Math.min(width, 800) : 600,
    900,
    (page._pageIndex ?? 0) + 1,
  );
  return { buffer: placeholder, mime: 'image/png', placeholder: true, engine: 'placeholder' };
}

/** PNG minimal avec bandeau de couleur (sans dépendance). */
function createPlaceholderPng(w, h, pageNum) {
  const zlib = require('zlib');
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = 1 + w * 3;
  const raw = Buffer.alloc(rowSize * h);
  const r = 30 + ((pageNum * 40) % 180);
  const g = 40 + ((pageNum * 25) % 160);
  const b = 60 + ((pageNum * 55) % 140);
  for (let y = 0; y < h; y += 1) {
    const off = y * rowSize;
    raw[off] = 0;
    for (let x = 0; x < w; x += 1) {
      const i = off + 1 + x * 3;
      if (y < 40) {
        raw[i] = 212;
        raw[i + 1] = 163;
        raw[i + 2] = 92;
      } else {
        raw[i] = r;
        raw[i + 1] = g;
        raw[i + 2] = b;
      }
    }
  }
  const compressed = zlib.deflateSync(raw);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crc = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    crc.writeUInt32BE(crcVal >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

export async function openPdf(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier introuvable: ${filePath}`);
  }

  // Chemin privilégié sous Electron : rendu Chromium fidèle (sans natif)
  const electronCanvas = await tryLoadElectronCanvas();
  if (electronCanvas?.electronPdfAvailable?.()) {
    try {
      const opened = await electronCanvas.electronOpenPdf(filePath);
      const pageCache = new Map();
      const basename = path.basename(filePath, path.extname(filePath));

      return {
        format: 'pdf',
        title: opened.title || basename,
        pageCount: opened.pageCount,
        chapters: [],
        renderEngine: 'electron-canvas',
        async getPage(index) {
          if (index < 0 || index >= opened.pageCount) {
            throw new Error(`Page hors limites: ${index}`);
          }
          if (pageCache.has(index)) return pageCache.get(index);
          const buffer = await electronCanvas.electronRenderPage(opened.docId, index, 1.6);
          const result = {
            buffer,
            mime: 'image/png',
            name: `page-${index + 1}.png`,
            engine: 'electron-canvas',
          };
          if (pageCache.size > 6) {
            const oldest = pageCache.keys().next().value;
            pageCache.delete(oldest);
          }
          pageCache.set(index, result);
          return result;
        },
        async getCoverBuffer() {
          const page = await this.getPage(0);
          return page.buffer;
        },
        async close() {
          pageCache.clear();
          await electronCanvas.electronClosePdf(opened.docId).catch(() => {});
        },
      };
    } catch (err) {
      console.warn('[VDR] PDF electron-canvas indisponible, fallback pdfjs main:', err.message);
    }
  }

  // Fallback : pdfjs en main + node-canvas / OffscreenCanvas / placeholder
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const title =
    (await doc.getMetadata().catch(() => null))?.info?.Title ||
    path.basename(filePath, path.extname(filePath));

  const pageCache = new Map();

  return {
    format: 'pdf',
    title: String(title || path.basename(filePath, '.pdf')),
    pageCount: doc.numPages,
    chapters: [],
    renderEngine: 'pdfjs-main',
    async getPage(index) {
      if (index < 0 || index >= doc.numPages) {
        throw new Error(`Page hors limites: ${index}`);
      }
      if (pageCache.has(index)) return pageCache.get(index);
      const page = await doc.getPage(index + 1);
      const rendered = await renderPageToPng(page, 1.6);
      const result = {
        buffer: rendered.buffer,
        mime: rendered.mime,
        name: `page-${index + 1}.png`,
        placeholder: Boolean(rendered.placeholder),
        engine: rendered.engine,
      };
      if (pageCache.size > 6) {
        const oldest = pageCache.keys().next().value;
        pageCache.delete(oldest);
      }
      pageCache.set(index, result);
      return result;
    },
    async getCoverBuffer() {
      const page = await this.getPage(0);
      return page.buffer;
    },
    async close() {
      pageCache.clear();
      await doc.destroy().catch(() => {});
    },
  };
}
