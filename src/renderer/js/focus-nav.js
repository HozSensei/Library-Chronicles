/**
 * Navigation focus clavier/manette pour menus UI (console-first).
 */

export class FocusNav {
  /** @param {ParentNode} root */
  constructor(root) {
    this.root = root;
    this.index = 0;
  }

  items() {
    return [...this.root.querySelectorAll('.focusable')];
  }

  sync() {
    const list = this.items();
    if (!list.length) return;
    this.index = Math.max(0, Math.min(this.index, list.length - 1));
    list.forEach((el, i) => el.classList.toggle('is-focused', i === this.index));
  }

  move(delta) {
    const list = this.items();
    if (!list.length) return;
    this.index = (this.index + delta + list.length) % list.length;
    this.sync();
  }

  activate() {
    const el = this.items()[this.index];
    if (el) el.click();
  }
}
