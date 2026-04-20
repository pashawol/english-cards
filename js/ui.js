import { I18N, IS_DEV, app, getAllCategoryLabels, getActiveCategoryFilters, getLang, saveState, t } from './core.js';
import { bindMascotInteraction } from './mascot.js';

export const THEME_COLORS = { light: '#f5f2eb', dark: '#2a2824' };

export function applyThemeColor(theme) {
  document.getElementById('theme-color-meta')?.setAttribute('content', THEME_COLORS[theme]);
}

export function initTheme() {
  const saved = localStorage.getItem('ec_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  applyThemeColor(saved);
}

export function toggleTheme() {
  const html = document.documentElement;
  const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('ec_theme', newTheme);
  applyThemeColor(newTheme);
}

export function applyLanguage() {
  document.documentElement.lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
  const langToggle = document.getElementById('lang-toggle');
  if (langToggle) langToggle.setAttribute('aria-label', `language: ${getLang()}`);
}

export function toggleLanguage({ onRenderHome, onStudyRefresh, onDoneRefresh, resetMascotLineMemory }) {
  app.state.uiLang = getLang() === 'en' ? 'ru' : 'en';
  saveState();
  resetMascotLineMemory();
  applyLanguage();
  onRenderHome();
  onStudyRefresh();
  onDoneRefresh();
}

export function buildDOM({
  toggleLanguage,
  toggleTheme,
  toggleAllSets,
  showMixTableView,
  startMix,
  goHome,
  flipCard,
  goPrevCard,
  answer,
  restartWrong,
  restartAll,
  renderHome,
  enableReminder,
  disableReminder,
  scheduleReminderCheck,
  formatReminderTime,
  getReminderPermission,
}) {
  const v = window.APP_VERSION || '';

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'styles.css' + (v ? `?v=${v}` : '');
  document.head.appendChild(link);

  document.getElementById('app').innerHTML = `
    <header>
      <div class="header-left">
        <a href="https://github.com/pashawol" target="_blank" rel="noreferrer" class="header-logo-link">
          <h1>English Cards</h1>
        </a>
        <span data-i18n="appSubtitle"></span>
      </div>
      <span id="app-version" class="app-version">${v}${IS_DEV ? ' dev' : ''}</span>
      <button id="lang-toggle">EN</button>
      <button id="theme-toggle">◐</button>
    </header>

    <div id="home-screen" class="screen active">
      <div class="daily-card">
        <div class="daily-banner">
          <div class="daily-banner-main">
            <div class="daily-banner-label" data-i18n="today"></div>
            <div class="daily-banner-count" id="daily-count">0 / 10</div>
          </div>
          <div class="streak-dot">
            <span class="num" id="streak-num">0</span>
            <span class="lbl" data-i18n="days"></span>
          </div>
        </div>

        <div class="settings-row">
          <div class="goal-slider-row">
            <input type="range" id="daily-goal" min="10" max="50" step="5" value="10" />
          </div>
        </div>

        <div class="daily-reminder">
          <div class="daily-reminder-row">
            <button type="button" class="reminder-toggle" id="reminder-toggle"></button>
            <label class="reminder-time-wrap" for="reminder-time">
              <span class="reminder-time-label" data-i18n="time"></span>
              <input type="time" id="reminder-time" class="reminder-time" />
            </label>
          </div>
        </div>
      </div>

      <div class="section-header">
        <div class="section-title" data-i18n="allTopics"></div>
        <button class="select-all-btn" id="select-all-btn"></button>
      </div>

      <div class="set-list" id="set-list"></div>
      <div class="home-actions">
        <div class="mix-fab" id="mix-btn">
          <button class="mix-fab-half" type="button" id="mix-table-btn" title="Список">≡</button>
          <div class="mix-fab-sep"></div>
          <button class="mix-fab-half" type="button" id="mix-start-btn" title="Карточки">⊡</button>
        </div>
        <div class="category-filter-shell">
          <div id="category-filter" class="category-filter" data-i18n-aria-label="allTopics"></div>
        </div>
        <div class="mix-meta">
          <div id="mix-sub"></div>
          <div class="mix-warning" id="mix-warning" data-i18n="chooseAtLeastOne"></div>
        </div>
      </div>
    </div>

    <div id="study-screen" class="screen">
      <div id="study-header">
        <button id="back-btn">←</button>
        <div id="study-title"></div>
        <div id="study-counter"></div>
      </div>

      <div class="progress-track">
        <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
      </div>

      <div class="study-mascot" id="study-mascot" role="button" tabindex="0" data-i18n-aria-label="mascotTap">
        <div class="study-mascot-figure">
          <div class="mascot-arm mascot-arm-left"></div>
          <div class="mascot-arm mascot-arm-right"></div>
          <div class="mascot-cup"><span class="mascot-cup-steam"></span><span class="mascot-cup-steam"></span></div>
          <div class="mascot-cigarette"></div>
          <div class="mascot-smoke-wrap"><span></span><span></span><span></span></div>
          <div class="study-mascot-eyes"><span></span><span></span></div>
          <div class="study-mascot-mouth"></div>
          <div class="mascot-ripple-wrap"><span></span><span></span><span></span></div>
        </div>
        <div class="study-mascot-bubble" id="mascot-text"></div>
      </div>

      <div class="card-area" id="card-area">
        <div class="card-inner" id="card-inner">
          <div class="card-face front">
            <div class="card-breadcrumb" id="card-breadcrumb"></div>
            <div class="card-label" data-i18n="russian"></div>
            <div class="card-word" id="front-word"></div>
            <div class="card-hint" id="front-hint"></div>
          </div>
          <div class="card-face back">
            <div class="card-label" data-i18n="english"></div>
            <div class="card-word" id="back-word"></div>
            <div class="card-hint" id="back-hint"></div>
          </div>
        </div>
      </div>

      <div class="tap-hint" id="tap-hint"></div>

      <div class="study-actions">
        <div class="study-nav-row">
          <button class="study-backtrack-btn" id="study-backtrack-btn" data-i18n="back"></button>
        </div>
        <div class="answer-row">
          <button class="answer-btn" id="btn-wrong" data-i18n="didntKnow"></button>
          <button class="answer-btn" id="btn-right" data-i18n="knew"></button>
        </div>
      </div>
    </div>

    <div id="done-screen" class="screen">
      <div class="done-celebration" id="done-celebration" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </div>
      <div class="done-icon">✦</div>
      <div class="done-title" id="done-title" data-i18n="doneTitle"></div>
      <div class="done-sub" id="done-sub"></div>
      <div class="study-mascot done-mascot" id="done-mascot" role="button" tabindex="0" data-i18n-aria-label="mascotTap">
        <div class="study-mascot-figure">
          <div class="mascot-arm mascot-arm-left"></div>
          <div class="mascot-arm mascot-arm-right"></div>
          <div class="mascot-cup"><span class="mascot-cup-steam"></span><span class="mascot-cup-steam"></span></div>
          <div class="mascot-cigarette"></div>
          <div class="mascot-smoke-wrap"><span></span><span></span><span></span></div>
          <div class="study-mascot-eyes"><span></span><span></span></div>
          <div class="study-mascot-mouth"></div>
          <div class="mascot-ripple-wrap"><span></span><span></span><span></span></div>
        </div>
        <div class="study-mascot-bubble" id="done-mascot-text" data-i18n="doneCleanWork"></div>
      </div>
      <div class="done-stats">
        <div class="done-stat good">
          <div class="done-stat-num" id="done-right">0</div>
          <div class="done-stat-label" data-i18n="statKnew"></div>
        </div>
        <div class="done-stat bad">
          <div class="done-stat-num" id="done-wrong">0</div>
          <div class="done-stat-label" data-i18n="statDidntKnow"></div>
        </div>
        <div class="done-stat">
          <div class="done-stat-num" id="done-total">0</div>
          <div class="done-stat-label" data-i18n="statTotal"></div>
        </div>
      </div>
      <div class="done-btns">
        <button class="done-btn" id="done-retry-btn" data-i18n="retryMistakes"></button>
        <button class="done-btn" id="done-again-btn" data-i18n="goAgain"></button>
        <button class="done-btn primary" id="done-home-btn" data-i18n="backToTopics"></button>
      </div>
    </div>

    <div id="table-screen" class="screen">
      <div id="table-header">
        <button id="table-back-btn">←</button>
        <div id="table-title-wrap">
          <div id="table-title"></div>
          <div id="table-subtitle"></div>
        </div>
        <button id="table-toggle-ru"></button>
      </div>
      <div id="table-body"></div>
    </div>

    <footer class="app-footer visible">
      <a href="https://github.com/pashawol" target="_blank" rel="noreferrer" data-i18n="contacts"></a>
    </footer>
  `;

  document.getElementById('lang-toggle').addEventListener('click', toggleLanguage);
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('select-all-btn').addEventListener('click', toggleAllSets);
  document.getElementById('mix-table-btn').addEventListener('click', showMixTableView);
  document.getElementById('mix-start-btn').addEventListener('click', startMix);
  document.getElementById('back-btn').addEventListener('click', goHome);
  document.getElementById('card-area').addEventListener('click', flipCard);
  document.getElementById('study-backtrack-btn').addEventListener('click', goPrevCard);
  document.getElementById('btn-wrong').addEventListener('click', () => answer(false));
  document.getElementById('btn-right').addEventListener('click', () => answer(true));
  document.getElementById('done-retry-btn').addEventListener('click', restartWrong);
  document.getElementById('done-again-btn').addEventListener('click', restartAll);
  document.getElementById('done-home-btn').addEventListener('click', goHome);
  document.getElementById('table-back-btn').addEventListener('click', goHome);

  document.getElementById('daily-goal').addEventListener('input', function () {
    app.state.dailyGoal = parseInt(this.value, 10);
    saveState();
    renderHome();
    scheduleReminderCheck();
  });

  document.getElementById('reminder-toggle').addEventListener('click', function () {
    if (app.state.reminderEnabled && getReminderPermission() === 'granted') {
      disableReminder();
      return;
    }
    enableReminder();
  });

  document.getElementById('reminder-time').addEventListener('input', function () {
    app.state.reminderTime = formatReminderTime(this.value);
    app.state.reminderLastSentOn = null;
    saveState();
    renderHome();
    scheduleReminderCheck();
  });

  bindMascotInteraction('study-mascot', 'mascot-text');
  bindMascotInteraction('done-mascot', 'done-mascot-text');
  applyLanguage();
}
