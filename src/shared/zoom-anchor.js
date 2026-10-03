/**
 * Ancrage zoom → point du viewport (repère local du plan lecteur).
 *
 * Transform page : `translate3d(panX, panY, 0) scale(s)` avec
 * `transform-origin: center center`, page centrée dans le stage
 * (`place-items: center`). Sous `rotate(90deg)` du plan, le centre
 * local = centre écran — on ancre donc en (0, 0) local.
 *
 * Formule zoom-to-point (focus relatif au centre layout) :
 *   newPan = focus - (focus - oldPan) * (newScale / oldScale)
 * Centre écran ⇒ focus = (0, 0) ⇒ newPan = oldPan * (newScale / oldScale)
 */

/**
 * @param {number} panX
 * @param {number} panY
 * @param {number} fromScale
 * @param {number} toScale
 * @param {number} [focusX=0] offset X depuis le centre layout (px locaux)
 * @param {number} [focusY=0] offset Y depuis le centre layout (px locaux)
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

/** Ancre le zoom sur le centre du viewport (focus 0,0). */
export function panForZoomToCenter(panX, panY, fromScale, toScale) {
  return panForZoomToPoint(panX, panY, fromScale, toScale, 0, 0);
}
