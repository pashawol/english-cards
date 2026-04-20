// ENV
const IS_DEV = ['localhost', '127.0.0.1', ''].includes(location.hostname);

// DATA
let SETS = [];
let reminderTimerId = null;
const mascotReactionTimerIds = {};
let cardAdvanceTimerId = null;
let cardEnterTimerId = null;
let mascotAmbientTimerId = null;
let lastMascotLine = '';
const I18N = window.I18N || {};
const MASCOT_TAP_POOLS = {
  study: ['somersault', 'coffee', 'smoke', 'moonwalk', 'facepalm', 'thumbsup', 'clap', 'basketball', 'wave'],
  done: ['clap', 'somersault', 'moonwalk', 'thumbsup', 'wave', 'coffee'],
};

function getLang() {
  return state.uiLang === 'ru' ? 'ru' : 'en';
}

function t(key, vars = {}) {
  const lang = getLang();
  const value = I18N[lang]?.[key] ?? I18N.en[key] ?? key;
  if (typeof value !== 'string') return value;
  return value.replace(/\{(\w+)\}/g, (_, token) => `${vars[token] ?? ''}`);
}

function getMascotLines(key) {
  const lang = getLang();
  return I18N[lang]?.mascot?.[key] ?? I18N.en.mascot[key] ?? [];
}

function translateCategory(label) {
  const lang = getLang();
  return I18N[lang]?.categories?.[label] ?? I18N.en?.categories?.[label] ?? label;
}

function translateSetName(name) {
  const lang = getLang();
  return I18N[lang]?.setNames?.[name] ?? I18N.en?.setNames?.[name] ?? name;
}

function pickMascotLine(lines, fallback = '') {
  const pool = Array.isArray(lines) ? lines.filter(Boolean) : [];
  if (pool.length === 0) return fallback;
  const filtered = pool.filter((line) => line !== lastMascotLine);
  const source = filtered.length ? filtered : pool;
  const next = source[Math.floor(Math.random() * source.length)];
  lastMascotLine = next;
  return next;
}

function formatCardCount(count) {
  return t('cards', { count });
}

function normalizeCategories(set) {
  if (Array.isArray(set.categories))
    return set.categories.filter((c) => typeof c === 'string' && c);
  if (typeof set.category === 'string' && set.category) return [set.category];
  return [];
}

function getAllCategoryLabels() {
  const labels = new Set();
  SETS.forEach((s) => normalizeCategories(s).forEach((c) => labels.add(c)));
  return [...labels].sort((a, b) => a.localeCompare(b, 'ru'));
}

function getActiveCategoryFilters() {
  const value = state.homeCategoryFilter;
  if (Array.isArray(value)) return value.filter((c) => typeof c === 'string' && c);
  if (typeof value === 'string' && value) return [value];
  return [];
}

function getVisibleSets() {
  const filters = getActiveCategoryFilters();
  if (filters.length === 0) return SETS;
  return SETS.filter((s) => normalizeCategories(s).some((cat) => filters.includes(cat)));
}

function getVisibleIds() {
  return getVisibleSets().map((s) => s.id);
}

function getBaseEnabledIds() {
  return state.enabledSets != null ? state.enabledSets : SETS.map((s) => s.id);
}

function cloneProgressEntry(entry) {
  return {
    seen: Array.isArray(entry?.seen) ? [...entry.seen] : [],
    correct: Array.isArray(entry?.correct) ? [...entry.correct] : [],
  };
}

function createSession(setId, queue) {
  const touchedSetIds = [...new Set(queue.map((card) => card._setId))];
  const initialProgress = {};
  touchedSetIds.forEach((id) => {
    initialProgress[id] = cloneProgressEntry(state.progress[id]);
  });

  return {
    setId,
    queue,
    index: 0,
    wrong: [],
    right: 0,
    flipped: false,
    answers: Array(queue.length).fill(undefined),
    baseTodayCount: state.todayCount,
    initialProgress,
    transitioning: false,
  };
}

async function loadSets() {
  const manifest = await fetch('data/manifest.json').then((r) => r.json());
  SETS = await Promise.all(
    manifest.map((file, i) =>
      fetch(`data/${file}`)
        .then((r) => r.json())
        .then((set) => ({ ...set, id: i + 1 })),
    ),
  );
}

// STATE
let state = {
  uiLang: 'en',
  dailyGoal: 10,
  todayCount: 0,
  streak: 0,
  lastDate: null,
  progress: {}, // setId -> { seen: [], correct: [] }
  enabledSets: null, // null = all; array of setIds after first load
  homeCategoryFilter: [], // [] = все
  reminderEnabled: false,
  reminderTime: '20:00',
  reminderLastSentOn: null,
};

let session = {
  setId: null,
  queue: [],
  index: 0,
  wrong: [],
  right: 0,
  flipped: false,
  answers: [],
  baseTodayCount: 0,
  initialProgress: {},
  transitioning: false,
};

// STORAGE
function saveState() {
  localStorage.setItem('ec_state', JSON.stringify(state));
}

function loadState() {
  const s = localStorage.getItem('ec_state');
  if (s) {
    try {
      state = { ...state, ...JSON.parse(s) };
    } catch (e) {}
  }
  checkNewDay();
}

function checkNewDay() {
  const today = new Date().toDateString();
  if (state.lastDate !== today) {
    if (state.lastDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (state.lastDate === yesterday.toDateString() && state.todayCount >= state.dailyGoal) {
        state.streak = (state.streak || 0) + 1;
      } else if (state.lastDate !== yesterday.toDateString()) {
        state.streak = 0;
      }
    }
    state.todayCount = 0;
    state.lastDate = today;
    state.reminderLastSentOn = null;
    saveState();
  }
}

function hasPendingDailyCards() {
  return state.todayCount < state.dailyGoal;
}

function getReminderPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

function isStandaloneApp() {
  const mediaStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = window.navigator.standalone === true;
  return mediaStandalone || iosStandalone;
}

function isMobileBrowserContext() {
  const ua = navigator.userAgent || '';
  const mobileDevice =
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  return mobileDevice && !isStandaloneApp();
}

function formatReminderTime(value) {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? value : '20:00';
}

function getReminderDateParts(now = new Date()) {
  const [hours, minutes] = formatReminderTime(state.reminderTime).split(':').map(Number);
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  return { now, target };
}

function getPendingCardsCount() {
  return Math.max(state.dailyGoal - state.todayCount, 0);
}

function showReminderNotification() {
  if (getReminderPermission() !== 'granted' || !hasPendingDailyCards()) return;
  const remaining = getPendingCardsCount();
  const body = remaining === 1 ? t('reminderBodyOne') : t('reminderBodyMany', { count: remaining });

  new Notification(t('reminderNotificationTitle'), {
    body,
    tag: `daily-reminder-${new Date().toDateString()}`,
  });
  state.reminderLastSentOn = new Date().toDateString();
  saveState();
  renderHome();
}

function maybeSendReminder() {
  const lastDate = state.lastDate;
  checkNewDay();
  if (state.lastDate !== lastDate) renderHome();
  if (!state.reminderEnabled || state.reminderLastSentOn === new Date().toDateString()) return;
  if (!hasPendingDailyCards()) return;
  const { now, target } = getReminderDateParts();
  if (now >= target) showReminderNotification();
}

function scheduleReminderCheck() {
  if (reminderTimerId) {
    clearTimeout(reminderTimerId);
    reminderTimerId = null;
  }

  if (!state.reminderEnabled || getReminderPermission() !== 'granted') return;

  maybeSendReminder();

  const { now, target } = getReminderDateParts();
  const nextCheckAt = now < target ? target : new Date(now.getTime() + 60 * 1000);
  const delay = Math.max(nextCheckAt.getTime() - now.getTime(), 1000);
  reminderTimerId = window.setTimeout(scheduleReminderCheck, delay);
}

async function enableReminder() {
  if (isMobileBrowserContext()) {
    renderHome();
    return;
  }

  if (getReminderPermission() === 'unsupported') {
    renderHome();
    return;
  }

  let permission = getReminderPermission();
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }

  state.reminderEnabled = permission === 'granted';
  saveState();
  renderHome();
  scheduleReminderCheck();
}

function disableReminder() {
  state.reminderEnabled = false;
  saveState();
  renderHome();
  scheduleReminderCheck();
}

// RENDER HOME
function renderHome() {
  const goal = state.dailyGoal;
  const done = state.todayCount;
  const activeFilters = getActiveCategoryFilters();
  const permission = getReminderPermission();
  const reminderEnabled = state.reminderEnabled && permission === 'granted';
  document.getElementById('daily-count').textContent = `${Math.min(done, goal)} / ${goal}`;
  document.getElementById('streak-num').textContent = state.streak || 0;
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
    reminderTime.value = formatReminderTime(state.reminderTime);
    reminderTime.disabled = !reminderEnabled;
    reminderToggle.disabled = permission === 'unsupported';
  }

  const visibleIds = getVisibleIds();
  const baseEnabled = getBaseEnabledIds();
  const mixSourceIds = visibleIds.filter((id) => baseEnabled.includes(id));
  const enabledForMix = mixSourceIds.length;

  const mixSubText =
    activeFilters.length === 0 && enabledForMix === SETS.length && SETS.length > 0
      ? t('mixFromAll', { count: state.dailyGoal })
      : t('mixFromTopics', { count: state.dailyGoal, topics: enabledForMix });
  document.getElementById('mix-sub').textContent = mixSubText;
  document.getElementById('daily-goal').value = state.dailyGoal;

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
    const labels = getAllCategoryLabels();
    const addChip = (text, isActive) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'category-chip' + (isActive ? ' active' : '');
      btn.textContent = translateCategory(text);
      btn.onclick = () => {
        const next = new Set(getActiveCategoryFilters());
        if (next.has(text)) {
          next.delete(text);
        } else {
          next.add(text);
        }
        state.homeCategoryFilter = [...next];
        saveState();
        renderHome();
      };
      catWrap.appendChild(btn);
    };
    labels.forEach((cat) => addChip(cat, activeFilters.includes(cat)));
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
    const p = state.progress[set.id] || { seen: [], correct: [] };
    const total = set.cards.length;
    const seen = p.seen ? p.seen.length : 0;
    const pct = Math.round((seen / total) * 100);
    const isDone = seen >= total;
    const isEnabled = state.enabledSets ? state.enabledSets.includes(set.id) : true;

    const el = document.createElement('div');
    el.className = 'set-item' + (isDone ? ' done' : '');
    el.onclick = () => startSet(set.id);
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

function toggleAllSets() {
  const visibleIds = getVisibleIds();
  if (visibleIds.length === 0) return;
  if (state.enabledSets == null) state.enabledSets = SETS.map((s) => s.id);
  const enabled = state.enabledSets;
  const allVisibleEnabled = visibleIds.every((id) => enabled.includes(id));
  if (allVisibleEnabled) {
    state.enabledSets = enabled.filter((id) => !visibleIds.includes(id));
  } else {
    state.enabledSets = [...new Set([...enabled, ...visibleIds])];
  }
  saveState();
  renderHome();
}

function toggleSetInMix(setId) {
  if (!state.enabledSets) state.enabledSets = SETS.map((s) => s.id);
  const idx = state.enabledSets.indexOf(setId);
  if (idx === -1) {
    state.enabledSets.push(setId);
  } else {
    state.enabledSets.splice(idx, 1);
  }
  saveState();
  renderHome();
}

// START MIX — random cards from enabled sets
function startMix() {
  const goal = state.dailyGoal;
  const visibleIds = getVisibleIds();
  const baseEnabled = getBaseEnabledIds();
  const mixIds = visibleIds.filter((id) => baseEnabled.includes(id));
  let pool = [];
  SETS.filter((s) => mixIds.includes(s.id)).forEach((set) => {
    set.cards.forEach((card, i) => {
      pool.push({ ...card, _setId: set.id, _cardIdx: i });
    });
  });

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const queue = pool.slice(0, goal);

  session = createSession('mix', queue);

  document.getElementById('study-title').textContent = t('randomMix');
  showScreen('study-screen');
  showCard();
}

// START SET
function startSet(setId) {
  const set = SETS.find((s) => s.id === setId);
  if (!set) return;

  const p = state.progress[setId] || { seen: [], correct: [] };
  let unseen = set.cards
    .map((card, i) => ({ ...card, _setId: setId, _cardIdx: i }))
    .filter((card) => !p.seen.includes(card._cardIdx));
  let seenWrong = set.cards
    .map((card, i) => ({ ...card, _setId: setId, _cardIdx: i }))
    .filter((card) => p.seen.includes(card._cardIdx) && !p.correct.includes(card._cardIdx));
  let queue = [...unseen, ...seenWrong];
  if (queue.length === 0) {
    queue = set.cards.map((card, i) => ({ ...card, _setId: setId, _cardIdx: i }));
  }

  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }

  session = createSession(setId, queue);

  document.getElementById('study-title').textContent = translateSetName(set.name);
  showScreen('study-screen');
  showCard();
}

function updateMascotMessage() {
  const el = document.getElementById('mascot-text');
  if (!el) return;

  const total = session.queue.length;
  const current = session.index + 1;
  const remaining = Math.max(total - session.index, 0);

  if (session.index >= total) {
    el.textContent = pickMascotLine(getMascotLines('doneGood'), t('doneTitle'));
    return;
  }

  if (!session.flipped) {
    if (remaining === 1) {
      el.textContent = pickMascotLine(getMascotLines('final'), '');
    } else if (current <= 2) {
      el.textContent = pickMascotLine(getMascotLines('opening'), '');
    } else if (remaining <= 3) {
      el.textContent = pickMascotLine(getMascotLines('late'), '');
    } else if (current > Math.ceil(total / 2)) {
      el.textContent = pickMascotLine(getMascotLines('mid'), '');
    } else {
      el.textContent = pickMascotLine(getMascotLines('early'), '');
    }
    return;
  }

  el.textContent = pickMascotLine(getMascotLines('flipped'), '');
}

function setMascotMood(mood) {
  const el = document.getElementById('study-mascot');
  if (!el) return;
  el.dataset.mood = mood;
}

function setMascotText(text, elementId = 'mascot-text') {
  const el = document.getElementById(elementId);
  if (!el || !text) return;
  el.textContent = text;
}

function clearMascotAmbient() {
  if (mascotAmbientTimerId) {
    clearTimeout(mascotAmbientTimerId);
    mascotAmbientTimerId = null;
  }
}

function scheduleMascotAmbient() {
  clearMascotAmbient();
  const studyScreen = document.getElementById('study-screen');
  if (!studyScreen || !studyScreen.classList.contains('active')) return;
  if (session.index >= session.queue.length || session.transitioning) return;

  const delay = 4200 + Math.floor(Math.random() * 2200);
  mascotAmbientTimerId = window.setTimeout(() => {
    if (!studyScreen.classList.contains('active') || session.transitioning) return;

    const remaining = session.queue.length - session.index;
    const r = Math.random();
    const mood = session.flipped
      ? 'blink'
      : r > 0.84 ? 'coffee'
      : r > 0.68 ? 'smoke'
      : r > 0.52 ? 'basketball'
      : r > 0.32 ? 'wonder'
      : 'idle';
    const lines = session.flipped
      ? getMascotLines('ambientReveal')
      : mood === 'coffee'
        ? getMascotLines('coffee')
        : mood === 'smoke'
          ? getMascotLines('smoke')
        : mood === 'basketball'
          ? getMascotLines('basketball')
          : remaining <= 2
            ? getMascotLines('final')
            : r > 0.7
              ? getMascotLines('wonder')
              : getMascotLines('ambient');

    setMascotText(pickMascotLine(lines, ''));
    triggerMascotReaction(mood);
    scheduleMascotAmbient();
  }, delay);
}

const MOOD_DURATION = {
  reveal: 450, cheer: 520, nudge: 420, wonder: 500, blink: 340,
  somersault: 1200, wave: 750, thumbsup: 850,
  clap: 1200, boxing: 1050, basketball: 1450, telescope: 650,
  coffee: 2200, smoke: 2200, moonwalk: 1250, facepalm: 980,
};

function triggerMascotReaction(mood, elementId = 'study-mascot') {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (mascotReactionTimerIds[elementId]) clearTimeout(mascotReactionTimerIds[elementId]);
  el.dataset.mood = mood;
  el.classList.remove('is-reacting');
  void el.offsetWidth;
  el.classList.add('is-reacting');

  mascotReactionTimerIds[elementId] = window.setTimeout(() => {
    el.classList.remove('is-reacting');
    el.dataset.mood = 'idle';
  }, MOOD_DURATION[mood] ?? 520);
}

function getMascotTapLines(mood) {
  if (mood === 'facepalm') return getMascotLines('facepalm');
  if (mood === 'moonwalk') return getMascotLines('moonwalk');
  return getMascotLines(mood);
}

function triggerMascotTapReaction(elementId = 'study-mascot', textId = 'mascot-text') {
  const mascot = document.getElementById(elementId);
  if (!mascot) return;

  const pool = elementId === 'done-mascot' ? MASCOT_TAP_POOLS.done : MASCOT_TAP_POOLS.study;
  const mood = pool[Math.floor(Math.random() * pool.length)];
  const lines = getMascotTapLines(mood);
  setMascotText(pickMascotLine(lines, ''), textId);
  triggerMascotReaction(mood, elementId);

  if (elementId === 'study-mascot') scheduleMascotAmbient();
}

function bindMascotInteraction(elementId, textId) {
  const mascot = document.getElementById(elementId);
  if (!mascot) return;

  const run = () => triggerMascotTapReaction(elementId, textId);
  mascot.addEventListener('click', run);
  mascot.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    run();
  });
}

function triggerDoneCelebration(perfect) {
  const doneMascot = document.getElementById('done-mascot');
  const doneText = document.getElementById('done-mascot-text');
  const doneCelebration = document.getElementById('done-celebration');
  if (doneMascot) {
    doneMascot.dataset.mood = perfect ? 'clap' : 'wonder';
    doneMascot.classList.remove('is-reacting');
    void doneMascot.offsetWidth;
    doneMascot.classList.add('is-reacting');
  }
  if (doneText) {
    doneText.textContent = pickMascotLine(
      perfect ? getMascotLines('donePerfect') : getMascotLines('doneGood'),
      perfect ? t('excellentTitle') : t('doneTitle'),
    );
  }
  if (doneCelebration) {
    doneCelebration.classList.remove('is-celebrating', 'is-perfect');
    void doneCelebration.offsetWidth;
    doneCelebration.classList.add('is-celebrating');
    if (perfect) doneCelebration.classList.add('is-perfect');
  }
}

function showCard() {
  if (session.index >= session.queue.length) {
    showDone();
    return;
  }
  const card = session.queue[session.index];
  const total = session.queue.length;
  const idx = session.index;
  const cardArea = document.getElementById('card-area');

  document.getElementById('front-word').textContent = card.ru;
  document.getElementById('back-word').textContent = card.en;
  document.getElementById('front-hint').textContent = '';
  document.getElementById('back-hint').textContent = '';

  const crumbEl = document.getElementById('card-breadcrumb');
  if (crumbEl) {
    const set = SETS.find((s) => s.id === card._setId);
    if (set) {
      const crumb = getSetBreadcrumb(set);
      crumbEl.textContent = [crumb, translateSetName(set.name)].filter(Boolean).join(' · ');
    }
  }
  document.getElementById('study-counter').textContent = `${idx + 1} / ${total}`;
  document.getElementById('progress-fill').style.width = `${(idx / total) * 100}%`;
  document.getElementById('tap-hint').textContent = t('tapToFlip');
  const prevBtn = document.getElementById('study-backtrack-btn');
  if (prevBtn) prevBtn.disabled = idx === 0;

  session.flipped = false;
  session.transitioning = false;
  document.querySelector('.card-face.front').classList.remove('hidden');
  document.querySelector('.card-face.back').classList.remove('visible');
  if (cardArea) {
    cardArea.classList.remove('is-advancing', 'is-answer-right', 'is-answer-wrong', 'is-entering');
    if (cardEnterTimerId) clearTimeout(cardEnterTimerId);
    if (idx > 0) {
      cardArea.classList.add('is-entering');
      cardEnterTimerId = setTimeout(() => {
        cardArea.classList.remove('is-entering');
      }, 180);
    }
  }
  if (idx === 0 && session.answers.every((a) => a === undefined)) {
    setTimeout(() => {
      setMascotText(pickMascotLine(getMascotLines('wave'), ''));
      triggerMascotReaction('wave');
    }, 350);
  } else {
    updateMascotMessage();
  }
  setMascotMood('idle');
  scheduleMascotAmbient();

  document.getElementById('btn-wrong').style.opacity = '0.35';
  document.getElementById('btn-right').style.opacity = '0.35';
}

function recomputeSessionState() {
  Object.entries(session.initialProgress || {}).forEach(([setId, snapshot]) => {
    state.progress[setId] = cloneProgressEntry(snapshot);
  });

  let answeredCount = 0;
  let right = 0;
  const wrong = [];

  session.answers.forEach((answer, idx) => {
    if (typeof answer !== 'boolean') return;

    answeredCount++;
    const card = session.queue[idx];
    const setId = card._setId;
    const cardIdx = card._cardIdx;

    if (!state.progress[setId]) state.progress[setId] = { seen: [], correct: [] };
    const p = state.progress[setId];

    if (!p.seen.includes(cardIdx)) p.seen.push(cardIdx);

    if (answer) {
      right++;
      if (!p.correct.includes(cardIdx)) p.correct.push(cardIdx);
    } else {
      p.correct = p.correct.filter((i) => i !== cardIdx);
      wrong.push(card);
    }
  });

  session.right = right;
  session.wrong = wrong;
  state.todayCount = session.baseTodayCount + answeredCount;
  saveState();
  scheduleReminderCheck();
}

function flipCard() {
  const front = document.querySelector('.card-face.front');
  const back = document.querySelector('.card-face.back');

  if (!session.flipped) {
    front.classList.add('hidden');
    back.classList.add('visible');
    session.flipped = true;
    document.getElementById('tap-hint').textContent = t('knewThisWord');
    document.getElementById('btn-wrong').style.opacity = '1';
    document.getElementById('btn-right').style.opacity = '1';
    updateMascotMessage();
    triggerMascotReaction(Math.random() > 0.5 ? 'telescope' : 'reveal');
    scheduleMascotAmbient();
  } else {
    front.classList.remove('hidden');
    back.classList.remove('visible');
    session.flipped = false;
    document.getElementById('tap-hint').textContent = t('tapToFlip');
    document.getElementById('btn-wrong').style.opacity = '0.35';
    document.getElementById('btn-right').style.opacity = '0.35';
    updateMascotMessage();
    triggerMascotReaction('blink');
    scheduleMascotAmbient();
  }
}

function answer(correct) {
  if (session.transitioning || session.index >= session.queue.length) return;

  const mascotText = document.getElementById('mascot-text');
  if (mascotText) {
    const answeredCount =
      session.answers.filter((a) => typeof a === 'boolean').length + 1;
    let consecutiveCorrect = 0;
    for (let i = session.index - 1; i >= 0; i--) {
      if (session.answers[i] === true) consecutiveCorrect++;
      else break;
    }
    let answerMood, lines;
    if (correct) {
      if (consecutiveCorrect >= 2) {
        answerMood = 'somersault';
        lines = getMascotLines('somersault');
      } else if (consecutiveCorrect >= 1) {
        answerMood = 'thumbsup';
        lines = getMascotLines('thumbsup');
      } else {
        answerMood = 'thumbsup';
        lines =
          answeredCount > 1 && answeredCount % 3 === 0
            ? getMascotLines('streak')
            : getMascotLines('correct');
      }
    } else {
      answerMood = 'boxing';
      lines = getMascotLines('wrong');
    }
    mascotText.textContent = pickMascotLine(lines, '');
    triggerMascotReaction(answerMood);
  } else {
    triggerMascotReaction(correct ? 'cheer' : 'nudge');
  }
  session.transitioning = true;
  clearMascotAmbient();

  const cardArea = document.getElementById('card-area');
  if (cardArea) {
    cardArea.classList.remove('is-entering', 'is-answer-right', 'is-answer-wrong');
    cardArea.classList.add('is-advancing', correct ? 'is-answer-right' : 'is-answer-wrong');
  }

  session.answers[session.index] = correct;
  recomputeSessionState();

  if (cardAdvanceTimerId) clearTimeout(cardAdvanceTimerId);
  cardAdvanceTimerId = setTimeout(() => {
    session.index++;
    showCard();
  }, 150);
}

function goPrevCard() {
  if (session.transitioning || session.index <= 0) return;
  session.index--;
  setMascotText(pickMascotLine(getMascotLines('back'), ''));
  triggerMascotReaction('wave');
  showScreen('study-screen');
  showCard();
}

function showDone() {
  showScreen('done-screen');
  const total = session.queue.length;
  const right = session.right;
  const wrong = total - right;
  document.getElementById('done-right').textContent = right;
  document.getElementById('done-wrong').textContent = wrong;
  document.getElementById('done-total').textContent = total;

  const name =
    session.setId === 'mix'
      ? t('randomMix')
      : translateSetName(SETS.find((s) => s.id === session.setId).name);
  const perfect = right === total;
  document.getElementById('done-title').textContent = perfect
    ? t('excellentTitle')
    : t('doneTitle');
  document.getElementById('done-sub').textContent = t('doneSub', { name, right, total });
  document.getElementById('progress-fill').style.width = '100%';
  triggerDoneCelebration(perfect);
  renderHome();
}

function restartWrong() {
  if (session.wrong.length === 0) {
    goHome();
    return;
  }
  session = createSession(session.setId, [...session.wrong]);
  showScreen('study-screen');
  showCard();
}

function restartAll() {
  if (session.setId === 'mix') {
    startMix();
    return;
  }
  startSet(session.setId);
}

function goHome() {
  showScreen('home-screen');
  renderHome();
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const footer = document.querySelector('.app-footer');
  if (footer) footer.classList.toggle('visible', id === 'home-screen' || id === 'table-screen');
  if (id === 'study-screen') {
    scheduleMascotAmbient();
  } else {
    clearMascotAmbient();
  }
}

function getSetBreadcrumb(set) {
  const cats = normalizeCategories(set).map((c) => translateCategory(c));
  return cats.length ? cats.join(' · ') : null;
}

function renderTableScreen(title, subtitle, groups) {
  document.getElementById('table-title').textContent = title;
  const subEl = document.getElementById('table-subtitle');
  if (subEl) subEl.textContent = subtitle || '';

  let allRevealed = false;

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
            e.currentTarget.classList.remove('blurred');
            e.stopPropagation();
          });
        }
        body.appendChild(row);
      });
    });

    const btn = document.getElementById('table-toggle-ru');
    btn.textContent = allRevealed ? `◉ ${t('tableHide')}` : `○ ${t('tableReveal')}`;
  }

  document.getElementById('table-toggle-ru').onclick = () => {
    allRevealed = !allRevealed;
    renderTable();
  };

  renderTable();
  showScreen('table-screen');
}

function showTableView(setId) {
  const set = SETS.find((s) => s.id === setId);
  if (!set) return;
  renderTableScreen(
    translateSetName(set.name),
    getSetBreadcrumb(set),
    [{ label: null, cards: set.cards }],
  );
}

function showMixTableView() {
  const visibleIds = getVisibleIds();
  const baseEnabled = getBaseEnabledIds();
  const mixIds = visibleIds.filter((id) => baseEnabled.includes(id));
  const sets = SETS.filter((s) => mixIds.includes(s.id));
  if (sets.length === 0) return;

  const groups = sets.map((set) => {
    const crumb = getSetBreadcrumb(set);
    const label = [crumb, translateSetName(set.name)].filter(Boolean).join(' · ');
    return { label, cards: set.cards };
  });

  renderTableScreen(t('randomMix'), null, groups);
}

// THEME
const THEME_COLORS = { light: '#f5f2eb', dark: '#2a2824' };

function applyThemeColor(theme) {
  document.getElementById('theme-color-meta').setAttribute('content', THEME_COLORS[theme]);
}

function toggleTheme() {
  const html = document.documentElement;
  const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('ec_theme', newTheme);
  applyThemeColor(newTheme);
}

function applyLanguage() {
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

function toggleLanguage() {
  state.uiLang = getLang() === 'en' ? 'ru' : 'en';
  saveState();
  lastMascotLine = '';
  applyLanguage();
  renderHome();

  if (
    document.getElementById('study-screen')?.classList.contains('active') &&
    session.queue.length
  ) {
    const studyTitle = document.getElementById('study-title');
    if (studyTitle && session.setId === 'mix') studyTitle.textContent = t('randomMix');
    document.getElementById('tap-hint').textContent = session.flipped
      ? t('knewThisWord')
      : t('tapToFlip');
    updateMascotMessage();
  }

  if (
    document.getElementById('done-screen')?.classList.contains('active') &&
    session.queue.length
  ) {
    showDone();
  }
}

function initTheme() {
  const saved = localStorage.getItem('ec_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  applyThemeColor(saved);
}

// DOM
function buildDOM() {
  const v = window.APP_VERSION || '';

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'styles.css' + (v ? '?v=' + v : '');
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
      <button id="lang-toggle" onclick="toggleLanguage()">EN</button>
      <button id="theme-toggle" onclick="toggleTheme()">◐</button>
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
        <button class="select-all-btn" id="select-all-btn" onclick="toggleAllSets()"></button>
      </div>

      <div class="set-list" id="set-list"></div>
      <div class="home-actions">
        <div class="mix-fab" id="mix-btn">
          <button class="mix-fab-half" type="button" onclick="showMixTableView()" title="Список">≡</button>
          <div class="mix-fab-sep"></div>
          <button class="mix-fab-half" type="button" onclick="startMix()" title="Карточки">⊡</button>
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
        <button id="back-btn" onclick="goHome()">←</button>
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

      <div class="card-area" id="card-area" onclick="flipCard()">
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
          <button class="study-backtrack-btn" id="study-backtrack-btn" onclick="goPrevCard()" data-i18n="back"></button>
        </div>
        <div class="answer-row">
          <button class="answer-btn" id="btn-wrong" onclick="answer(false)" data-i18n="didntKnow"></button>
          <button class="answer-btn" id="btn-right" onclick="answer(true)" data-i18n="knew"></button>
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
        <button class="done-btn" onclick="restartWrong()" data-i18n="retryMistakes"></button>
        <button class="done-btn" onclick="restartAll()" data-i18n="goAgain"></button>
        <button class="done-btn primary" onclick="goHome()" data-i18n="backToTopics"></button>
      </div>
    </div>

    <div id="table-screen" class="screen">
      <div id="table-header">
        <button id="table-back-btn" onclick="goHome()">←</button>
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

  document.getElementById('daily-goal').addEventListener('input', function () {
    state.dailyGoal = parseInt(this.value);
    saveState();
    renderHome();
    scheduleReminderCheck();
  });

  document.getElementById('reminder-toggle').addEventListener('click', function () {
    if (state.reminderEnabled && getReminderPermission() === 'granted') {
      disableReminder();
      return;
    }
    enableReminder();
  });

  document.getElementById('reminder-time').addEventListener('input', function () {
    state.reminderTime = formatReminderTime(this.value);
    state.reminderLastSentOn = null;
    saveState();
    renderHome();
    scheduleReminderCheck();
  });

  bindMascotInteraction('study-mascot', 'mascot-text');
  bindMascotInteraction('done-mascot', 'done-mascot-text');
  applyLanguage();
}

document.addEventListener('visibilitychange', function () {
  if (!document.hidden) scheduleReminderCheck();
});

window.addEventListener('focus', function () {
  scheduleReminderCheck();
});

// INIT
async function init() {
  initTheme();
  await loadSets();
  loadState();
  buildDOM();
  let shouldSave = false;
  if (state.enabledSets === null) {
    state.enabledSets = SETS.map((s) => s.id);
    shouldSave = true;
  }
  const labels = getAllCategoryLabels();
  const nextFilters = getActiveCategoryFilters().filter((label) => labels.includes(label));
  if (
    nextFilters.length !== getActiveCategoryFilters().length ||
    !Array.isArray(state.homeCategoryFilter)
  ) {
    state.homeCategoryFilter = nextFilters;
    shouldSave = true;
  }
  const normalizedReminderTime = formatReminderTime(state.reminderTime);
  if (state.reminderTime !== normalizedReminderTime) {
    state.reminderTime = normalizedReminderTime;
    shouldSave = true;
  }
  if (getReminderPermission() !== 'granted') {
    if (state.reminderEnabled) shouldSave = true;
    state.reminderEnabled = false;
  }
  if (shouldSave) saveState();
  renderHome();
  scheduleReminderCheck();
}

init();
