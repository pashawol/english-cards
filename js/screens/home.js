import {
  app,
  formatCardCount,
  getActiveCategoryFilters,
  getAllCategoryLabels,
  getBaseEnabledIds,
  getVisibleIds,
  getVisibleSets,
  saveState,
  t,
  translateCategory,
  translateSetName,
} from '../core.js';
import { getReminderPermission, isStandaloneApp } from '../reminders.js';

export function renderHome({ startSet, toggleSetInMix, showTableView }) {
  const goal = app.state.dailyGoal;
  const done = app.state.todayCount;
  const activeFilters = getActiveCategoryFilters();
  const permission = getReminderPermission();
  const reminderEnabled = app.state.reminderEnabled && permission === 'granted';

  document.getElementById('daily-count').textContent = `${Math.min(done, goal)} / ${goal}`;
  document.getElementById('streak-num').textContent = app.state.streak || 0;
  const streakLabel = document.querySelector('.streak-dot .lbl');
  if (streakLabel) streakLabel.textContent = t('days');

  const reminderPanel = document.querySelector('.daily-reminder');
  const standalone = isStandaloneApp();
  if (reminderPanel) reminderPanel.style.display = standalone ? '' : 'none';

  if (standalone) {
    const reminderToggle = document.getElementById('reminder-toggle');
    const reminderTime = document.getElementById('reminder-time');
    reminderToggle.textContent = reminderEnabled ? t('remindOn') : t('remind');
    reminderToggle.classList.toggle('active', reminderEnabled);
    reminderTime.value = app.state.reminderTime;
    reminderTime.disabled = !reminderEnabled;
    reminderToggle.disabled = permission === 'unsupported';
  }

  const visibleIds = getVisibleIds();
  const baseEnabled = getBaseEnabledIds();
  const mixSourceIds = visibleIds.filter((id) => baseEnabled.includes(id));
  const enabledForMix = mixSourceIds.length;

  document.getElementById('mix-sub').textContent =
    activeFilters.length === 0 && enabledForMix === app.sets.length && app.sets.length > 0
      ? t('mixFromAll', { count: app.state.dailyGoal })
      : t('mixFromTopics', { count: app.state.dailyGoal, topics: enabledForMix });
  document.getElementById('daily-goal').value = app.state.dailyGoal;

  const noneEnabled = mixSourceIds.length === 0;
  const allVisibleEnabled =
    visibleIds.length > 0 && visibleIds.every((id) => baseEnabled.includes(id));
  document.getElementById('select-all-btn').textContent = allVisibleEnabled
    ? t('deselectAll')
    : t('selectAll');

  const sectionTitleEl = document.querySelector('#home-screen .section-title');
  if (sectionTitleEl) {
    if (activeFilters.length === 0) {
      sectionTitleEl.textContent = t('allTopics');
    } else if (activeFilters.length <= 2) {
      sectionTitleEl.textContent = `${t('topicsPrefix')}: ${activeFilters.map(translateCategory).join(', ')}`;
    } else {
      sectionTitleEl.textContent = `${t('topicsPrefix')}: ${t('categoriesCount', { count: activeFilters.length })}`;
    }
  }

  const catWrap = document.getElementById('category-filter');
  if (catWrap) {
    catWrap.innerHTML = '';
    getAllCategoryLabels().forEach((category) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'category-chip' + (activeFilters.includes(category) ? ' active' : '');
      btn.textContent = translateCategory(category);
      btn.addEventListener('click', () => {
        const next = new Set(getActiveCategoryFilters());
        if (next.has(category)) next.delete(category);
        else next.add(category);
        app.state.homeCategoryFilter = [...next];
        saveState();
        renderHome({ startSet, toggleSetInMix, showTableView });
      });
      catWrap.appendChild(btn);
    });
  }

  const warning = document.getElementById('mix-warning');
  const mixBtn = document.getElementById('mix-btn');
  warning.textContent = t('chooseAtLeastOne');
  warning.style.display = noneEnabled ? 'block' : 'none';
  mixBtn.style.opacity = noneEnabled ? '0.4' : '1';
  mixBtn.style.pointerEvents = noneEnabled ? 'none' : 'auto';

  const list = document.getElementById('set-list');
  list.innerHTML = '';
  getVisibleSets().forEach((set) => {
    const p = app.state.progress[set.id] || { seen: [], correct: [] };
    const total = set.cards.length;
    const seen = p.seen ? p.seen.length : 0;
    const pct = Math.round((seen / total) * 100);
    const isDone = seen >= total;
    const isEnabled = app.state.enabledSets ? app.state.enabledSets.includes(set.id) : true;

    const el = document.createElement('div');
    el.className = 'set-item' + (isDone ? ' done' : '');
    el.innerHTML = `
      <div class="set-check ${isEnabled ? 'checked' : ''}" data-id="${set.id}">✓</div>
      <div class="set-num">${String(set.id).padStart(2, '0')}</div>
      <div class="set-info">
        <div class="set-name">${translateSetName(set.name)}</div>
        <div class="set-meta">${formatCardCount(total)}${isDone ? ` · ${t('doneShort')}` : ''}</div>
      </div>
      <div class="set-progress">
        <div class="set-bar-wrap"><div class="set-bar" style="width:${pct}%"></div></div>
        <div class="set-pct">${pct}%</div>
      </div>
      <button class="set-view-btn" data-id="${set.id}" title="Просмотр списком">≡</button>
    `;
    el.addEventListener('click', () => startSet(set.id));
    el.querySelector('.set-check').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSetInMix(set.id);
    });
    el.querySelector('.set-view-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      showTableView(set.id);
    });
    list.appendChild(el);
  });
}

export function toggleAllSets({ renderHome }) {
  const visibleIds = getVisibleIds();
  if (visibleIds.length === 0) return;
  if (app.state.enabledSets == null) app.state.enabledSets = app.sets.map((set) => set.id);
  const enabled = app.state.enabledSets;
  const allVisibleEnabled = visibleIds.every((id) => enabled.includes(id));
  app.state.enabledSets = allVisibleEnabled
    ? enabled.filter((id) => !visibleIds.includes(id))
    : [...new Set([...enabled, ...visibleIds])];
  saveState();
  renderHome();
}

export function toggleSetInMix({ setId, renderHome }) {
  if (!app.state.enabledSets) app.state.enabledSets = app.sets.map((set) => set.id);
  const idx = app.state.enabledSets.indexOf(setId);
  if (idx === -1) app.state.enabledSets.push(setId);
  else app.state.enabledSets.splice(idx, 1);
  saveState();
  renderHome();
}
