import {
  app,
  getBaseEnabledIds,
  getVisibleIds,
  normalizeCategories,
  t,
  translateCategory,
  translateSetName,
} from '../core.js';

function getSetBreadcrumb(set) {
  const categories = normalizeCategories(set).map((category) => translateCategory(category));
  return categories.length ? categories.join(' · ') : null;
}

function createCell(text, className) {
  const cell = document.createElement('div');
  cell.className = `table-cell ${className}`;
  cell.textContent = text;
  return cell;
}

function createRow(card, allRevealed) {
  const row = document.createElement('div');
  row.className = 'table-row';

  row.appendChild(createCell(card.ru, 'table-cell-ru'));
  row.appendChild(createCell(card.en, `table-cell-en${allRevealed ? '' : ' blurred'}`));

  return row;
}

function buildTableContent(groups, allRevealed) {
  const fragment = document.createDocumentFragment();

  groups.forEach(({ label, cards }) => {
    if (label) {
      const heading = document.createElement('div');
      heading.className = 'table-group-heading';
      heading.textContent = label;
      fragment.appendChild(heading);
    }

    cards.forEach((card) => {
      fragment.appendChild(createRow(card, allRevealed));
    });
  });

  return fragment;
}

function renderTableScreen(title, subtitle, groups, { showScreen }) {
  const titleEl = document.getElementById('table-title');
  const subEl = document.getElementById('table-subtitle');
  const body = document.getElementById('table-body');
  const toggleBtn = document.getElementById('table-toggle-ru');

  if (!titleEl || !body || !toggleBtn) return;

  titleEl.textContent = title;
  if (subEl) subEl.textContent = subtitle || '';

  let allRevealed = false;

  function renderTable() {
    body.replaceChildren(buildTableContent(groups, allRevealed));
    toggleBtn.textContent = allRevealed ? `◉ ${t('tableHide')}` : `○ ${t('tableReveal')}`;
  }

  body.onclick = (event) => {
    if (allRevealed) return;
    const target = event.target.closest('.table-cell-en');
    if (!target || !body.contains(target)) return;
    // target.classList.toggle('blurred');
  };

  toggleBtn.onclick = () => {
    allRevealed = !allRevealed;
    renderTable();
  };

  renderTable();
  showScreen('table-screen');
}

export function showTableView(setId, deps) {
  const set = app.sets.find((item) => item.id === setId);
  if (!set) return;
  renderTableScreen(
    translateSetName(set.name),
    getSetBreadcrumb(set),
    [{ label: null, cards: set.cards }],
    deps,
  );
}

export function showMixTableView(deps) {
  const mixIds = getVisibleIds().filter((id) => getBaseEnabledIds().includes(id));
  const sets = app.sets.filter((set) => mixIds.includes(set.id));
  if (sets.length === 0) return;

  const groups = sets.map((set) => ({
    label: [getSetBreadcrumb(set), translateSetName(set.name)].filter(Boolean).join(' · '),
    cards: set.cards,
  }));

  renderTableScreen(t('randomMix'), null, groups, deps);
}

export { getSetBreadcrumb };
