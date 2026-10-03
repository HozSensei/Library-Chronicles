/**
 * Accès données livres — stubs Phase 3.
 */

function upsertBook(_meta) {
  // TODO[Phase 3]: INSERT OR REPLACE dans books
  throw new Error('TODO[Phase 3]: upsertBook');
}

function listBooks() {
  // TODO[Phase 3]: SELECT + JOIN reading_progress ORDER BY last_access
  return [];
}

function saveProgress(_bookId, _pageCurrent, _pageTotal) {
  // TODO[Phase 3]: UPDATE reading_progress + statut auto
  throw new Error('TODO[Phase 3]: saveProgress');
}

function loadProgress(_filePath) {
  // TODO[Phase 3]: retrouver book par path + progression
  return null;
}

module.exports = { upsertBook, listBooks, saveProgress, loadProgress };
