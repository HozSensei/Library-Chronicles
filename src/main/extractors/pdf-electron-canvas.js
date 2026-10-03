/**
 * Rendu PDF fidèle via canvas Chromium (BrowserWindow cachée).
 * Évite la dépendance native `canvas` tout en restant Electron-friendly.
 */
import { BrowserWindow, app } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);

let hostWin = null;
let hostReady = null;
/** @type {Map<string, { filePath: string }>} */
const openDocs = new Map();
let docSeq = 0;

function isElectronMain() {
  return Boolean(process.versions?.electron) && Boolean(app);
}

function resolvePdfjsUrls() {
  const pdfjsPath = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
  let workerPath;
  try {
    workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  } catch {
    workerPath = require.resolve('pdfjs-dist/build/pdf.worker.mjs');
  }
  return {
    pdfjsUrl: pathToFileURL(pdfjsPath).href,
    workerUrl: pathToFileURL(workerPath).href,
  };
}

async function ensureHost() {
  if (!isElectronMain()) {
    throw new Error('Rendu Electron indisponible hors process main');
  }
  if (!app.isReady()) {
    await app.whenReady();
  }
  if (hostWin && !hostWin.isDestroyed()) {
    await hostReady;
    return hostWin;
  }

  const { pdfjsUrl, workerUrl } = resolvePdfjsUrls();
  hostWin = new BrowserWindow({
    show: false,
    width: 64,
    height: 64,
    skipTaskbar: true,
    webPreferences: {
      offscreen: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: false, // autoriser import file:// pdfjs + lecture PDF local
    },
  });

  hostReady = (async () => {
    await hostWin.loadURL('about:blank');
    await hostWin.webContents.executeJavaScript(
      `
      window.__vdrPdf = {
        docs: new Map(),
        pdfjsUrl: ${JSON.stringify(pdfjsUrl)},
        workerUrl: ${JSON.stringify(workerUrl)},
        pdfjs: null,
      };
      window.__vdrPdf.ready = import(window.__vdrPdf.pdfjsUrl).then((mod) => {
        mod.GlobalWorkerOptions.workerSrc = window.__vdrPdf.workerUrl;
        window.__vdrPdf.pdfjs = mod;
        return mod;
      });
      true;
      `,
      true,
    );
  })();

  hostWin.on('closed', () => {
    hostWin = null;
    hostReady = null;
    openDocs.clear();
  });

  await hostReady;
  return hostWin;
}

/**
 * Ouvre un PDF dans l’hôte Chromium.
 * @returns {{ docId: string, pageCount: number, title: string }}
 */
export async function electronOpenPdf(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier introuvable: ${filePath}`);
  }
  const win = await ensureHost();
  const docId = `pdf-${++docSeq}`;
  const fileUrl = pathToFileURL(path.resolve(filePath)).href;

  const meta = await win.webContents.executeJavaScript(
    `
    (async () => {
      const api = window.__vdrPdf;
      await api.ready;
      const doc = await api.pdfjs.getDocument({
        url: ${JSON.stringify(fileUrl)},
        useSystemFonts: true,
      }).promise;
      let title = '';
      try {
        const md = await doc.getMetadata();
        title = (md && md.info && md.info.Title) || '';
      } catch (_) {}
      api.docs.set(${JSON.stringify(docId)}, doc);
      return { pageCount: doc.numPages, title: String(title || '') };
    })()
    `,
    true,
  );

  openDocs.set(docId, { filePath });
  return { docId, pageCount: meta.pageCount, title: meta.title };
}

/**
 * Rend une page → PNG (base64 sans préfixe data:).
 */
export async function electronRenderPage(docId, pageIndex, scale = 1.6) {
  const win = await ensureHost();
  if (!openDocs.has(docId)) {
    throw new Error(`Document PDF inconnu: ${docId}`);
  }

  const b64 = await win.webContents.executeJavaScript(
    `
    (async () => {
      const api = window.__vdrPdf;
      await api.ready;
      const doc = api.docs.get(${JSON.stringify(docId)});
      if (!doc) throw new Error('doc manquant');
      const page = await doc.getPage(${pageIndex + 1});
      const viewport = page.getViewport({ scale: ${Number(scale)} });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d', { alpha: false });
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/png');
      return dataUrl.split(',')[1] || '';
    })()
    `,
    true,
  );

  if (!b64) throw new Error('Rendu PDF vide');
  return Buffer.from(b64, 'base64');
}

export async function electronClosePdf(docId) {
  openDocs.delete(docId);
  if (!hostWin || hostWin.isDestroyed()) return;
  try {
    await hostWin.webContents.executeJavaScript(
      `
      (async () => {
        const api = window.__vdrPdf;
        const doc = api.docs.get(${JSON.stringify(docId)});
        if (doc) {
          api.docs.delete(${JSON.stringify(docId)});
          try { await doc.destroy(); } catch (_) {}
        }
        true;
      })()
      `,
      true,
    );
  } catch {
    // fenêtre déjà fermée
  }
}

export function electronPdfAvailable() {
  try {
    return isElectronMain() && (app.isReady() || !app.isReady());
  } catch {
    return false;
  }
}

export async function destroyPdfElectronHost() {
  for (const id of [...openDocs.keys()]) {
    await electronClosePdf(id).catch(() => {});
  }
  if (hostWin && !hostWin.isDestroyed()) {
    hostWin.destroy();
  }
  hostWin = null;
  hostReady = null;
}
