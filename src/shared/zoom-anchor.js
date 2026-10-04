/**
 * Zoom ancré au **centre écran** sous le stack Reader :
 *   plane: translate(-50%,-50%) rotate(90deg)
 *   page : translate3d(panX, panY, 0) scale(s)  (origin = centre image)
 *   fit  : width/height CSS (fit-height | fit-width | custom)
 *
 * Espaces
 * -------
 * - screen : pixels fenêtre (X→, Y↓) après rotate du plan
 * - stage  : plan local AVANT rotate (clientWidth × clientHeight)
 * - image  : boîte layout page (offsetWidth × offsetHeight)
 *
 * Rotate(+90° CW) centré fenêtre :
 *   screenX = winCX − (localY − H/2)
 *   screenY = winCY + (localX − W/2)
 * ⇒ centre écran ↔ centre stage (W/2, H/2).
 *
 * Page (origin centre) :
 *   stage = imgCenter + pan + scale × p_from_img_center
 *
 * Pourquoi v1 (`newPan = oldPan × ratio`) échoue
 * -----------------------------------------------
 * v1 = cas particulier focus=(0,0) relatif au centre image, donc
 * imgCenter === stageCenter. Dès que le fit overflow décale la boîte
 * (grid « safe », mesure, etc.), le vrai point sous le centre écran
 * n’est plus le centre image. Après +90°, une erreur sur l’axe local X
 * apparaît comme un **scroll vertical** à l’écran.
 *
 * Formule générale (focus relatif au centre image, px stage/local) :
 *   newPan = focus − (focus − oldPan) × (newScale / oldScale)
 */

/**
 * @typedef {object} ZoomGeom
 * @property {number} stageW
 * @property {number} stageH
 * @property {number} imgW
 * @property {number} imgH
 * @property {number} imgOffsetX top-left layout image dans le stage
 * @property {number} imgOffsetY
 * @property {boolean} [rotate90]
 * @property {number} [winCX] centre fenêtre / AABB stage (screen)
 * @property {number} [winCY]
 * @property {number} [stageLeft]
 * @property {number} [stageTop]
 */

/**
 * Screen → stage local (inverse rotate +90° CW si `rotate90`).
 * @param {number} screenX
 * @param {number} screenY
 * @param {ZoomGeom} geom
 * @returns {{ x: number, y: number }}
 */
export function screenToStageLocal(screenX, screenY, geom) {
  const sx = Number(screenX);
  const sy = Number(screenY);
  if (!geom?.rotate90) {
    return {
      x: sx - (Number(geom?.stageLeft) || 0),
      y: sy - (Number(geom?.stageTop) || 0),
    };
  }
  const W = Number(geom.stageW) || 0;
  const H = Number(geom.stageH) || 0;
  const winCX = Number(geom.winCX);
  const winCY = Number(geom.winCY);
  const cx = Number.isFinite(winCX) ? winCX : W / 2;
  const cy = Number.isFinite(winCY) ? winCY : H / 2;
  // Inverse : localX − W/2 = screenY − winCY ; localY − H/2 = winCX − screenX
  return {
    x: sy - cy + W / 2,
    y: cx - sx + H / 2,
  };
}

/**
 * Stage local → screen (rotate +90° CW si `rotate90`).
 * @param {number} localX
 * @param {number} localY
 * @param {ZoomGeom} geom
 * @returns {{ x: number, y: number }}
 */
export function stageLocalToScreen(localX, localY, geom) {
  const lx = Number(localX);
  const ly = Number(localY);
  if (!geom?.rotate90) {
    return {
      x: lx + (Number(geom?.stageLeft) || 0),
      y: ly + (Number(geom?.stageTop) || 0),
    };
  }
  const W = Number(geom.stageW) || 0;
  const H = Number(geom.stageH) || 0;
  const winCX = Number(geom.winCX);
  const winCY = Number(geom.winCY);
  const cx = Number.isFinite(winCX) ? winCX : W / 2;
  const cy = Number.isFinite(winCY) ? winCY : H / 2;
  const relX = lx - W / 2;
  const relY = ly - H / 2;
  return { x: cx - relY, y: cy + relX };
}

/**
 * Point image (depuis coin haut-gauche layout) sous un point stage,
 * compte tenu de pan + scale (origin centre).
 * @returns {{ x: number, y: number }}
 */
export function stagePointToImageLocal(
  stageX,
  stageY,
  panX,
  panY,
  scale,
  imgOffsetX,
  imgOffsetY,
  imgW,
  imgH,
) {
  const s = Number(scale);
  const iw = Number(imgW) || 0;
  const ih = Number(imgH) || 0;
  const ox = Number(imgOffsetX) || 0;
  const oy = Number(imgOffsetY) || 0;
  const imgCX = ox + iw / 2;
  const imgCY = oy + ih / 2;
  if (!Number.isFinite(s) || s === 0) {
    return { x: iw / 2, y: ih / 2 };
  }
  // stage = imgCenter + pan + scale * (p - imgCenter_in_local)
  // p from image top-left
  return {
    x: iw / 2 + (Number(stageX) - imgCX - (Number(panX) || 0)) / s,
    y: ih / 2 + (Number(stageY) - imgCY - (Number(panY) || 0)) / s,
  };
}

/**
 * @param {number} panX
 * @param {number} panY
 * @param {number} fromScale
 * @param {number} toScale
 * @param {number} [focusX=0] offset X depuis le centre image (px stage/local)
 * @param {number} [focusY=0] offset Y depuis le centre image (px stage/local)
 * @returns {{ panX: number, panY: number }}
 */
export function panForZoomToPoint(
  panX,
  panY,
  fromScale,
  toScale,
  focusX = 0,
  focusY = 0,
) {
  const from = Number(fromScale);
  const to = Number(toScale);
  const ox = Number(panX) || 0;
  const oy = Number(panY) || 0;
  const fx = Number(focusX) || 0;
  const fy = Number(focusY) || 0;
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) {
    return { panX: ox, panY: oy };
  }
  if (Math.abs(to - from) < 1e-9) {
    return { panX: ox, panY: oy };
  }
  const ratio = to / from;
  return {
    panX: fx - (fx - ox) * ratio,
    panY: fy - (fy - oy) * ratio,
  };
}

/**
 * Zoom → centre écran : convertit le centre viewport en focus local image,
 * puis recalcule pan pour que ce point reste sous le centre après scale.
 *
 * @param {number} panX
 * @param {number} panY
 * @param {number} fromScale
 * @param {number} toScale
 * @param {ZoomGeom} geom
 * @returns {{ panX: number, panY: number }}
 */
export function panForZoomToScreenCenter(panX, panY, fromScale, toScale, geom) {
  const stageW = Number(geom?.stageW) || 0;
  const stageH = Number(geom?.stageH) || 0;
  const imgW = Number(geom?.imgW) || 0;
  const imgH = Number(geom?.imgH) || 0;
  const imgOffsetX =
    geom?.imgOffsetX != null
      ? Number(geom.imgOffsetX)
      : (stageW - imgW) / 2;
  const imgOffsetY =
    geom?.imgOffsetY != null
      ? Number(geom.imgOffsetY)
      : (stageH - imgH) / 2;

  // Centre écran → stage local (sous plane centré + rotate : = centre stage).
  let focusStageX = stageW / 2;
  let focusStageY = stageH / 2;
  if (
    geom &&
    Number.isFinite(Number(geom.winCX)) &&
    Number.isFinite(Number(geom.winCY))
  ) {
    const local = screenToStageLocal(geom.winCX, geom.winCY, {
      ...geom,
      stageW,
      stageH,
    });
    focusStageX = local.x;
    focusStageY = local.y;
  }

  const imgCX = imgOffsetX + imgW / 2;
  const imgCY = imgOffsetY + imgH / 2;
  // Focus relatif au centre image (= espace du pan CSS).
  const focusX = focusStageX - imgCX;
  const focusY = focusStageY - imgCY;

  return panForZoomToPoint(panX, panY, fromScale, toScale, focusX, focusY);
}

/**
 * Raccourci : image parfaitement centrée ⇒ focus (0,0) ⇒ pan × ratio.
 * Préférer `panForZoomToScreenCenter` dès que la géométrie est connue.
 */
export function panForZoomToCenter(panX, panY, fromScale, toScale) {
  return panForZoomToPoint(panX, panY, fromScale, toScale, 0, 0);
}

/**
 * Mesure DOM du stage / page pour ancrer le zoom (repère local + rotate).
 * @param {ParentNode | { querySelector: Function }} [root]
 * @returns {ZoomGeom | null}
 */
export function measureReaderZoomGeometry(root) {
  const doc =
    root && typeof root.querySelector === 'function'
      ? root
      : typeof document !== 'undefined'
        ? document
        : null;
  if (!doc) return null;

  const reader = doc.querySelector('.reader');
  const stage = doc.querySelector('.reader__stage');
  const pan = doc.querySelector('.reader__pan');
  const page = doc.querySelector('.reader__page');
  if (!stage || !page) return null;

  const rotate90 = reader?.getAttribute?.('data-css-rotate') === '1';
  const stageW = stage.clientWidth;
  const stageH = stage.clientHeight;
  const imgW = page.offsetWidth;
  const imgH = page.offsetHeight;

  let imgOffsetX;
  let imgOffsetY;
  // offset* = position layout (ignore transform scale/pan) — idéal.
  // Mode page : pan wrapper centré (offset = .reader__pan seul).
  if (pan && pan.offsetParent === stage) {
    imgOffsetX = pan.offsetLeft;
    imgOffsetY = pan.offsetTop;
  } else if (page.offsetParent === stage) {
    imgOffsetX = page.offsetLeft;
    imgOffsetY = page.offsetTop;
  } else {
    imgOffsetX = (stageW - imgW) / 2;
    imgOffsetY = (stageH - imgH) / 2;
  }

  let winCX = stageW / 2;
  let winCY = stageH / 2;
  let stageLeft = 0;
  let stageTop = 0;
  if (typeof stage.getBoundingClientRect === 'function') {
    const r = stage.getBoundingClientRect();
    stageLeft = r.left;
    stageTop = r.top;
    // AABB post-rotate : le centre de l’AABB = centre écran du stage.
    winCX = r.left + r.width / 2;
    winCY = r.top + r.height / 2;
  }

  return {
    stageW,
    stageH,
    imgW,
    imgH,
    imgOffsetX,
    imgOffsetY,
    rotate90,
    winCX,
    winCY,
    stageLeft,
    stageTop,
  };
}

/**
 * Limites de pan stage-local pour une page `translate(pan) scale(s)` (origin centre).
 * - Axe oversized (page zoomée > stage) : bords atteignables, pas dépassables
 *   (cover — pas de vide hors image).
 * - Axe undersized : pan verrouillé à 0 (position layout centrée).
 *
 * @param {number} scale
 * @param {ZoomGeom} geom
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
 */
export function panLimitsForPage(scale, geom) {
  const stageW = Number(geom?.stageW) || 0;
  const stageH = Number(geom?.stageH) || 0;
  const imgW = Number(geom?.imgW) || 0;
  const imgH = Number(geom?.imgH) || 0;
  const sRaw = Number(scale);
  const s = Number.isFinite(sRaw) && sRaw > 0 ? sRaw : 1;
  if (stageW <= 0 || stageH <= 0 || imgW <= 0 || imgH <= 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  const imgOffsetX =
    geom?.imgOffsetX != null
      ? Number(geom.imgOffsetX)
      : (stageW - imgW) / 2;
  const imgOffsetY =
    geom?.imgOffsetY != null
      ? Number(geom.imgOffsetY)
      : (stageH - imgH) / 2;
  const imgCX = imgOffsetX + imgW / 2;
  const imgCY = imgOffsetY + imgH / 2;

  const axisLimits = (imgC, sized, stage) => {
    const half = sized / 2;
    if (sized + 1e-6 >= stage) {
      // left/top = imgC + pan - half ≤ 0  ⇒  pan ≤ -imgC + half
      // right/bot = imgC + pan + half ≥ stage  ⇒  pan ≥ stage - imgC - half
      return {
        min: stage - imgC - half,
        max: -imgC + half,
      };
    }
    // Page plus petite que le stage sur cet axe : pas de pan dans le vide.
    return { min: 0, max: 0 };
  };

  const x = axisLimits(imgCX, imgW * s, stageW);
  const y = axisLimits(imgCY, imgH * s, stageH);
  return { minX: x.min, maxX: x.max, minY: y.min, maxY: y.max };
}

/**
 * Clamp pan pour que l’image ne sorte pas du viewport (bords page = extrémités).
 * @param {number} panX
 * @param {number} panY
 * @param {number} scale
 * @param {ZoomGeom} geom
 * @returns {{ panX: number, panY: number }}
 */
export function clampPanToPage(panX, panY, scale, geom) {
  const limits = panLimitsForPage(scale, geom);
  const x = Number(panX) || 0;
  const y = Number(panY) || 0;
  return {
    panX: Math.min(limits.maxX, Math.max(limits.minX, x)),
    panY: Math.min(limits.maxY, Math.max(limits.minY, y)),
  };
}

/**
 * Évite tout scroll parasite du conteneur pendant un zoom.
 * @param {ParentNode | { querySelectorAll: Function }} [root]
 */
export function pinReaderOverflow(root) {
  const doc =
    root && typeof root.querySelectorAll === 'function'
      ? root
      : typeof document !== 'undefined'
        ? document
        : null;
  if (!doc) return;
  const nodes = doc.querySelectorAll(
    '.reader, .reader__plane, .reader__viewport, .reader__stage',
  );
  for (const el of nodes) {
    if (el.scrollTop) el.scrollTop = 0;
    if (el.scrollLeft) el.scrollLeft = 0;
  }
}
