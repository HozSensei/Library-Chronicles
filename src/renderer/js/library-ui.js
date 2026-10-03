/**
 * UI Bibliothèque console-first.
 * TODO[Phase 3]: grille couvertures + focus manette + Continuer.
 */

export class LibraryUI {
  /** @param {HTMLElement} grid */
  constructor(grid) {
    this.grid = grid;
    this.items = [];
    this.cursor = 0;
  }

  async refresh() {
    this.items = (await window.vdr.library.list()) || [];
    this.render();
  }

  render() {
    this.grid.innerHTML = '';
    if (!this.items.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Aucun livre — choisir un dossier racine (Phase 3).';
      this.grid.appendChild(empty);
      return;
    }
    // TODO[Phase 3]: cards couverture + titre + barre progression
  }

  moveCursor(_dx, _dy) {
    // TODO[Phase 3]
  }

  getSelected() {
    return this.items[this.cursor] || null;
  }
}
