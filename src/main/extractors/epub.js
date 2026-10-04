/**
 * Extracteur EPUB (OEBPS) — JSZip + parse OPF/spine.
 * Représentation : spine item = « page » (chapitre XHTML), pas une image.
 * Ressources (img/css) inlinées en data-URL pour rendu iframe/blob côté renderer.
 */
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { createLruMap } from '../../shared/perf-cache.js';

const DEFAULT_FONT_PCT = 100;

/** @param {string} name */
function mimeFromName(name) {
  const ext = path.extname(name).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
    '.css': 'text/css',
    '.xhtml': 'application/xhtml+xml',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.xml': 'application/xml',
    '.opf': 'application/oebps-package+xml',
    '.ncx': 'application/x-dtbncx+xml',
  };
  return map[ext] || 'application/octet-stream';
}

/** @param {string} p */
function normalizeZipPath(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/');
}

/**
 * Résout un href relatif à un dossier zip.
 * @param {string} baseDir
 * @param {string} href
 */
export function resolveZipHref(baseDir, href) {
  const raw = String(href || '').trim();
  if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('#')) {
    return null;
  }
  const clean = raw.split('#')[0].split('?')[0];
  if (!clean) return null;
  const base = normalizeZipPath(baseDir).replace(/\/?$/, '/');
  const joined = normalizeZipPath(path.posix.join(base === '/' ? '' : base, clean));
  return joined.replace(/^\//, '');
}

/**
 * @param {string} xml
 * @param {string} tag
 * @returns {string[]}
 */
function tagContents(xml, tag) {
  const re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'gi');
  const out = [];
  let m;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}

/**
 * @param {string} xml
 * @param {string} tag
 * @returns {Array<Record<string, string>>}
 */
function selfClosingAttrs(xml, tag) {
  const re = new RegExp('<' + tag + '\\b([^>]*)\\/?>', 'gi');
  const out = [];
  let m;
  while ((m = re.exec(xml))) {
    const attrs = {};
    const chunk = m[1] || '';
    const attrRe = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let a;
    while ((a = attrRe.exec(chunk))) {
      attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? '';
    }
    out.push(attrs);
  }
  return out;
}

/**
 * @param {string} xml
 * @returns {{ fullPath: string }}
 */
export function parseContainerXml(xml) {
  const roots = selfClosingAttrs(xml, 'rootfile');
  const fullPath =
    roots.find((r) => /package|opf/i.test(r['media-type'] || ''))?.['full-path'] ||
    roots[0]?.['full-path'];
  if (!fullPath) throw new Error('EPUB: rootfile OPF introuvable (container.xml)');
  return { fullPath: normalizeZipPath(fullPath) };
}

/**
 * @param {string} opfXml
 * @param {string} opfDir
 */
export function parseOpf(opfXml, opfDir) {
  const title =
    tagContents(opfXml, 'dc:title')[0] ||
    tagContents(opfXml, 'title')[0] ||
    null;
  const creator =
    tagContents(opfXml, 'dc:creator')[0] ||
    tagContents(opfXml, 'creator')[0] ||
    null;

  /** @type {Map<string, { id: string, href: string, mediaType: string, properties: string }>} */
  const manifest = new Map();
  for (const item of selfClosingAttrs(opfXml, 'item')) {
    const id = item.id;
    const href = item.href;
    if (!id || !href) continue;
    const resolved = resolveZipHref(opfDir, href) || normalizeZipPath(href);
    manifest.set(id, {
      id,
      href: resolved,
      mediaType: item['media-type'] || mimeFromName(resolved),
      properties: item.properties || '',
    });
  }

  const spine = [];
  for (const ref of selfClosingAttrs(opfXml, 'itemref')) {
    const idref = ref.idref;
    if (!idref || !manifest.has(idref)) continue;
    spine.push(manifest.get(idref));
  }
  if (!spine.length) throw new Error('EPUB: spine vide');

  let coverId = null;
  for (const meta of selfClosingAttrs(opfXml, 'meta')) {
    const name = (meta.name || meta.property || '').toLowerCase();
    if (name === 'cover' || name === 'cover-image') {
      coverId = meta.content || meta.id || null;
    }
  }
  let coverHref = null;
  if (coverId && manifest.has(coverId)) {
    coverHref = manifest.get(coverId).href;
  } else {
    for (const item of manifest.values()) {
      if (/\bcover-image\b/i.test(item.properties)) {
        coverHref = item.href;
        break;
      }
    }
    if (!coverHref) {
      for (const item of manifest.values()) {
        if (/^image\//i.test(item.mediaType) && /cover/i.test(item.id + item.href)) {
          coverHref = item.href;
          break;
        }
      }
    }
  }

  const ncxItem =
    [...manifest.values()].find((i) => /ncx/i.test(i.mediaType)) ||
    [...manifest.values()].find((i) => /\.ncx$/i.test(i.href));
  const navItem =
    [...manifest.values()].find((i) => /\bnav\b/i.test(i.properties)) ||
    [...manifest.values()].find((i) => /nav\.xhtml?$/i.test(i.href));

  return {
    title,
    creator,
    manifest,
    spine,
    coverHref,
    ncxHref: ncxItem?.href || null,
    navHref: navItem?.href || null,
  };
}

/**
 * Titres de chapitres depuis nav XHTML (EPUB3) ou NCX (EPUB2).
 * @param {string|null} navXml
 * @param {string|null} ncxXml
 * @param {string} baseDir
 * @returns {Map<string, string>} href → label
 */
export function parseTocLabels(navXml, ncxXml, baseDir) {
  /** @type {Map<string, string>} */
  const map = new Map();

  if (navXml) {
    const linkRe =
      /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRe.exec(navXml))) {
      const href = m[1] ?? m[2] ?? '';
      const label = String(m[3] || '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const resolved = resolveZipHref(baseDir, href);
      if (resolved && label && !map.has(resolved)) map.set(resolved, label);
    }
  }

  if (ncxXml) {
    const navPoints = ncxXml.match(/<navPoint[\s\S]*?<\/navPoint>/gi) || [];
    for (const block of navPoints) {
      const label =
        (block.match(/<navLabel[^>]*>\s*<text[^>]*>([\s\S]*?)<\/text>/i) ||
          [])[1]
          ?.replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim() || '';
      const srcMatch = block.match(/<content\b[^>]*src\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const src = srcMatch?.[1] || srcMatch?.[2] || '';
      const resolved = resolveZipHref(baseDir, src);
      if (resolved && label && !map.has(resolved)) map.set(resolved, label);
    }
  }

  return map;
}

/**
 * @param {import('jszip')} zip
 * @param {string} entryPath
 * @returns {Promise<Buffer|null>}
 */
async function readZipBuffer(zip, entryPath) {
  const key = normalizeZipPath(entryPath);
  let entry = zip.file(key);
  if (!entry) {
    try {
      entry = zip.file(decodeURIComponent(key));
    } catch {
      entry = null;
    }
  }
  if (!entry) {
    const found = Object.keys(zip.files).find(
      (n) => normalizeZipPath(n).toLowerCase() === key.toLowerCase(),
    );
    if (found) entry = zip.file(found);
  }
  if (!entry || entry.dir) return null;
  return Buffer.from(await entry.async('uint8array'));
}

/**
 * @param {import('jszip')} zip
 * @param {string} entryPath
 */
async function readZipText(zip, entryPath) {
  const buf = await readZipBuffer(zip, entryPath);
  return buf ? buf.toString('utf8') : null;
}

/**
 * @param {Buffer} buf
 * @param {string} mime
 */
function toDataUrl(buf, mime) {
  return 'data:' + mime + ';base64,' + buf.toString('base64');
}

/**
 * Inline CSS url(...) vers data-URL.
 * @param {string} css
 * @param {string} cssDir
 * @param {import('jszip')} zip
 * @param {{ has: Function, get: Function, set: Function }} cache
 */
async function rewriteCssUrls(css, cssDir, zip, cache) {
  const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(css))) {
    parts.push(css.slice(last, m.index));
    const href = m[2].trim();
    const resolved = resolveZipHref(cssDir, href);
    let replacement = m[0];
    if (resolved) {
      if (!cache.has(resolved)) {
        const buf = await readZipBuffer(zip, resolved);
        if (buf) {
          cache.set(resolved, toDataUrl(buf, mimeFromName(resolved)));
        } else {
          cache.set(resolved, '');
        }
      }
      const data = cache.get(resolved);
      if (data) replacement = 'url("' + data + '")';
    }
    parts.push(replacement);
    last = m.index + m[0].length;
  }
  parts.push(css.slice(last));
  return parts.join('');
}

/**
 * Réécrit href/src + link stylesheet en data-URL ; inline CSS url().
 * @param {string} html
 * @param {string} docDir
 * @param {import('jszip')} zip
 * @param {{ has: Function, get: Function, set: Function }} cache
 */
export async function rewriteEpubHtml(html, docDir, zip, cache) {
  let out = String(html || '');

  const linkRe =
    /<link\b([^>]*?)href\s*=\s*(?:"([^"]*)"|'([^']*)')([^>]*)\/?>/gi;
  const linkJobs = [];
  out = out.replace(linkRe, (full, pre, h1, h2, post) => {
    const href = h1 ?? h2 ?? '';
    const attrs = (pre + ' ' + post).toLowerCase();
    if (!/stylesheet|text\/css|\.css/i.test(attrs + href)) return full;
    const resolved = resolveZipHref(docDir, href);
    if (!resolved) return full;
    const token = '<!--VDR_CSS_' + linkJobs.length + '-->';
    linkJobs.push({ token, resolved, full });
    return token;
  });
  for (const job of linkJobs) {
    let cssText = await readZipText(zip, job.resolved);
    if (!cssText) {
      out = out.replace(job.token, job.full);
      continue;
    }
    const cssDir = path.posix.dirname(job.resolved);
    cssText = await rewriteCssUrls(cssText, cssDir, zip, cache);
    out = out.replace(
      job.token,
      '<style data-vdr-epub-css="1">\n' + cssText + '\n</style>',
    );
  }

  const attrRe =
    /\b((?:src|xlink:href))\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  const attrJobs = [];
  out = out.replace(attrRe, (full, attr, h1, h2) => {
    const href = h1 ?? h2 ?? '';
    const resolved = resolveZipHref(docDir, href);
    if (!resolved) return full;
    if (!/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(resolved)) return full;
    const token = 'VDR_ATTR_' + attrJobs.length;
    attrJobs.push({ token, resolved, attr, quote: h1 != null ? '"' : "'" });
    return attr + '=' + token;
  });
  for (const job of attrJobs) {
    if (!cache.has(job.resolved)) {
      const buf = await readZipBuffer(zip, job.resolved);
      cache.set(
        job.resolved,
        buf ? toDataUrl(buf, mimeFromName(job.resolved)) : '',
      );
    }
    const data = cache.get(job.resolved);
    const q = job.quote;
    out = out.replace(
      job.attr + '=' + job.token,
      data ? job.attr + '=' + q + data + q : job.attr + '=' + q + q,
    );
  }

  return out;
}

/**
 * @param {string} html
 * @param {string} fallback
 */
function titleFromHtml(html, fallback) {
  const m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return fallback;
  const t = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return t || fallback;
}

/**
 * @param {string} bodyHtml
 * @param {string} title
 */
function wrapChapterHtml(bodyHtml, title) {
  const hasHtml = /<html[\s>]/i.test(bodyHtml);
  if (hasHtml) {
    if (/<\/head>/i.test(bodyHtml)) {
      return bodyHtml.replace(
        /<\/head>/i,
        '<style id="vdr-epub-base">html,body{margin:0;padding:0;background:transparent;color:inherit;}body{padding:1.1rem 1.25rem 2.5rem;line-height:1.55;max-width:42rem;margin-inline:auto;overflow-wrap:anywhere;}img,svg{max-width:100%;height:auto;}</style></head>',
      );
    }
    return bodyHtml;
  }
  return '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>' +
    escapeXml(title) +
    '</title><style id="vdr-epub-base">html,body{margin:0;padding:0;background:transparent;color:inherit;}body{padding:1.1rem 1.25rem 2.5rem;line-height:1.55;max-width:42rem;margin-inline:auto;overflow-wrap:anywhere;}img,svg{max-width:100%;height:auto;}</style></head><body>' +
    bodyHtml +
    '</body></html>';
}

/** @param {string} s */
function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} filePath
 */
export async function openEpub(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Fichier introuvable: ' + filePath);
  }

  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  const containerXml = await readZipText(zip, 'META-INF/container.xml');
  if (!containerXml) throw new Error('EPUB: META-INF/container.xml manquant');

  const { fullPath: opfPath } = parseContainerXml(containerXml);
  const opfDir = path.posix.dirname(opfPath);
  const opfXml = await readZipText(zip, opfPath);
  if (!opfXml) throw new Error('EPUB: OPF introuvable (' + opfPath + ')');

  const parsed = parseOpf(opfXml, opfDir === '.' ? '' : opfDir);

  let navXml = null;
  let ncxXml = null;
  if (parsed.navHref) navXml = await readZipText(zip, parsed.navHref);
  if (parsed.ncxHref) ncxXml = await readZipText(zip, parsed.ncxHref);
  const tocBase = parsed.navHref
    ? path.posix.dirname(parsed.navHref)
    : parsed.ncxHref
      ? path.posix.dirname(parsed.ncxHref)
      : opfDir === '.'
        ? ''
        : opfDir;
  const tocLabels = parseTocLabels(navXml, ncxXml, tocBase === '.' ? '' : tocBase);

  const spineHrefs = parsed.spine.map((s) => s.href);
  const pageNames = spineHrefs.slice();
  const chapters = parsed.spine.map((item, i) => {
    const label =
      tocLabels.get(item.href) ||
      path.posix.basename(item.href, path.posix.extname(item.href)) ||
      ('Chapitre ' + (i + 1));
    return {
      name: label,
      startIndex: i,
      endIndex: i,
    };
  });

  const title =
    parsed.title || path.basename(filePath, path.extname(filePath));
  const author = parsed.creator || null;

  const pageCache = createLruMap(8);
  const assetCache = createLruMap(48);

  return {
    format: 'epub',
    renderEngine: 'epub',
    title,
    author,
    pageCount: spineHrefs.length,
    chapters,
    pageNames,
    defaultFontSize: DEFAULT_FONT_PCT,
    async getPage(index) {
      if (index < 0 || index >= spineHrefs.length) {
        throw new Error('Page hors limites: ' + index);
      }
      const hit = pageCache.get(index);
      if (hit) return hit;

      const href = spineHrefs[index];
      const raw = await readZipText(zip, href);
      if (!raw) throw new Error('Chapitre EPUB introuvable: ' + href);
      const docDir = path.posix.dirname(href);
      const rewritten = await rewriteEpubHtml(
        raw,
        docDir === '.' ? '' : docDir,
        zip,
        assetCache,
      );
      const chapTitle =
        chapters[index]?.name || titleFromHtml(raw, 'Ch. ' + (index + 1));
      const html = wrapChapterHtml(rewritten, chapTitle);
      const result = {
        buffer: Buffer.from(html, 'utf8'),
        mime: 'text/html;charset=utf-8',
        name: href,
        engine: 'epub',
        kind: 'epub-chapter',
      };
      pageCache.set(index, result);
      return result;
    },
    async getCoverBuffer() {
      if (parsed.coverHref) {
        const buf = await readZipBuffer(zip, parsed.coverHref);
        if (buf?.length) return buf;
      }
      for (const item of parsed.manifest.values()) {
        if (/^image\//i.test(item.mediaType)) {
          const buf = await readZipBuffer(zip, item.href);
          if (buf?.length) return buf;
        }
      }
      throw new Error('EPUB: aucune couverture trouvée');
    },
    async close() {
      pageCache.clear();
      assetCache.clear();
    },
  };
}
