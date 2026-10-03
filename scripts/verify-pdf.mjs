/**
 * Test extracteur PDF (fallback hors Electron → placeholder PNG valide).
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { openPdf } from '../src/main/extractors/pdf.js';

/** PDF minimal 1 page (Hello) — objet stream très simple. */
function minimalPdf() {
  // PDF avec une page vide (media box) — pdfjs peut l’ouvrir
  const objects = [];
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objects.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Contents 4 0 R /Resources << >> >>endobj\n',
  );
  objects.push('4 0 obj<< /Length 0 >>stream\nendstream\nendobj\n');

  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += obj;
  }
  const xrefStart = Buffer.byteLength(body, 'utf8');
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += xref;
  body += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body, 'utf8');
}

async function main() {
  if (process.versions.electron) {
    console.log('Note: test exécuté sous Electron — moteur canvas Chromium possible');
  }

  const tmp = path.join(os.tmpdir(), `vdr-pdf-test-${Date.now()}.pdf`);
  fs.writeFileSync(tmp, minimalPdf());

  try {
    const book = await openPdf(tmp);
    if (book.pageCount < 1) throw new Error(`pageCount=${book.pageCount}`);
    if (!book.title) throw new Error('title manquant');
    const page = await book.getPage(0);
    if (!page.buffer?.length) throw new Error('page buffer vide');
    if (page.mime !== 'image/png') throw new Error(`mime=${page.mime}`);
    // Signature PNG
    if (page.buffer[0] !== 0x89 || page.buffer[1] !== 0x50) {
      throw new Error('pas une signature PNG');
    }
    await book.close();
    console.log(
      `OK  PDF extracteur (pages=${book.pageCount}, engine=${page.engine || book.renderEngine || '?'}, placeholder=${Boolean(page.placeholder)})`,
    );
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
