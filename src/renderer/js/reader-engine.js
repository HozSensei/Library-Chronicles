/**
 * Moteur de rendu page — zoom / pan GPU via CSS transform.
 * TODO[Phase 1]: brancher images CBZ + navigation pages.
 */

const FIT = {
  HEIGHT: 'fit-height',
  WIDTH: 'fit-width',
  ZOOM_100: 'zoom-100',
};

const ZOOM_STEP = 0.15;

export class ReaderEngine {
  /**
   * @param {{ stage: HTMLElement, image: HTMLImageElement, placeholder: HTMLElement }} els
   */
  constructor(els) {
    this.stage = els.stage;
    this.image = els.image;
    this.placeholder = els.placeholder;

    this.pageIndex = 0;
    this.pageCount = 0;
    this.title = '';
    this.filePath = null;
    this.direction = 'ltr'; // ltr | rtl
    this.fitMode = FIT.HEIGHT;
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.objectUrl = null;
  }

  resetTransform() {
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  }

  applyTransform() {
    this.image.style.transform = `translate3d(${this.panX}px, ${this.panY}px, 0) scale(${this.scale})`;
  }

  setFitMode(mode) {
    this.fitMode = mode;
    // TODO[Phase 1]: recalculer scale selon dimensions stage / image
    if (mode === FIT.ZOOM_100) {
      this.scale = 1;
    } else if (mode === FIT.HEIGHT) {
      this.scale = 1; // height:100% CSS gère le fit par défaut
    }
    this.resetTransform();
  }

  toggleZoom() {
    this.setFitMode(this.fitMode === FIT.HEIGHT ? FIT.ZOOM_100 : FIT.HEIGHT);
  }

  zoomBy(deltaSteps) {
    this.scale = Math.min(4, Math.max(0.25, this.scale + deltaSteps * ZOOM_STEP));
    this.fitMode = 'custom';
    this.applyTransform();
  }

  pan(dx, dy, speed = 14) {
    this.panX += dx * speed;
    this.panY += dy * speed;
    this.applyTransform();
  }

  toggleDirection() {
    this.direction = this.direction === 'ltr' ? 'rtl' : 'ltr';
    return this.direction;
  }

  /**
   * Navigation page selon le sens de lecture.
   * @param {'next'|'prev'} which
   */
  async stepPage(which) {
    const dir = this.direction === 'rtl' ? -1 : 1;
    const delta = which === 'next' ? dir : -dir;
    const next = this.pageIndex + delta;
    if (next < 0 || next >= this.pageCount) return false;
    // TODO[Phase 1]: await window.vdr.reader.getPage(next)
    this.pageIndex = next;
    return true;
  }

  async open(filePath) {
    const meta = await window.vdr.reader.open(filePath);
    this.filePath = filePath;
    this.title = meta.title;
    this.pageCount = meta.pageCount;
    this.pageIndex = 0;
    this.placeholder.hidden = this.pageCount > 0;
    // TODO[Phase 1]: charger page 0 et afficher
    return meta;
  }

  async close() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    await window.vdr.reader.close();
    this.image.classList.remove('is-visible');
    this.image.removeAttribute('src');
    this.placeholder.hidden = false;
    this.pageCount = 0;
    this.pageIndex = 0;
    this.filePath = null;
  }

  hudState() {
    const pct = this.pageCount ? ((this.pageIndex + 1) / this.pageCount) * 100 : 0;
    return {
      title: this.title || '—',
      pageLabel: `${this.pageCount ? this.pageIndex + 1 : 0} / ${this.pageCount}`,
      progress: pct,
      direction: this.direction.toUpperCase(),
    };
  }
}

export { FIT, ZOOM_STEP };
