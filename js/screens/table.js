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

function renderTableScreen(title, subtitle, groups, { showScreen }) {
  document.getElementById('table-title').textContent = title;
  const subEl = document.getElementById('table-subtitle');
  if (subEl) subEl.textContent = subtitle || '';

  let allRevealed = false;
  const toggleBtn = document.getElementById('table-toggle-ru');

  function renderTable() {
    const body = document.getElementById('table-body');
    body.innerHTML = '';

    groups.forEach(({ label, cards }) => {
      if (label) {
        const heading = document.createElement('div');
        heading.className = 'table-group-heading';
        heading.textContent = label;
        body.appendChild(heading);
      }

      cards.forEach((card) => {
        const row = document.createElement('div');
        row.className = 'table-row';
        const enClass = allRevealed ? 'table-cell-en' : 'table-cell-en blurred';
        row.innerHTML = `
          <div class="table-cell table-cell-ru">${card.ru}</div>
          <div class="table-cell ${enClass}">${card.en}</div>
        `;
        if (!allRevealed) {
          row.querySelector('.table-cell-en').addEventListener('click', (e) => {
            e.currentTarget.classList.toggle('blurred');
            e.stopPropagation();
          });
        }
        body.appendChild(row);
      });
    });

    toggleBtn.textContent = allRevealed ? `◉ ${t('tableHide')}` : `○ ${t('tableReveal')}`;
  }

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
  renderTableScreen(translateSetName(set.name), getSetBreadcrumb(set), [{ label: null, cards: set.cards }], deps);
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
