// DATA
let SETS = [];
let reminderTimerId = null;
let mascotReactionTimerId = null;
let cardAdvanceTimerId = null;
let cardEnterTimerId = null;
let mascotAmbientTimerId = null;
let lastMascotLine = '';

const MASCOT_LINES = {
  opening: ['погнали. две-три подряд и уже полетело', 'старт хороший. держи темп', 'поехали спокойно, но без пауз'],
  early: ['нормально идём', 'ритм уже появился', 'ещё немного и разгонишься'],
  mid: ['середину тоже забираем', 'темп держится, не роняй', 'ещё несколько и будет красиво'],
  late: ['финиш уже близко', 'почти дожали', 'добираем последние'],
  final: ['последняя карточка. добей её', 'одна осталась. не отпускай', 'финальный тап и готово'],
  flipped: ['оцени честно и поехали дальше', 'если сомневаешься, жми честно', 'решай быстро, ритм важнее'],
  ambient: ['ещё одну', 'хорошо идёшь', 'давай без пауз', 'держим ход', 'ты уже в ритме'],
  ambientReveal: ['смотри спокойно', 'сейчас быстро решим', 'не тяни, отвечай по ощущению'],
  correct: ['вау, отлично. ещё одну', 'чисто. забираем дальше', 'да, вот так', 'сильный ответ'],
  wrong: ['нормально. следующую доберём', 'ошибка не страшна. дальше', 'быстро поправимся на следующих'],
  streak: ['пошла серия', 'вот это уже красиво', 'ритм прям хороший'],
  wonder: ['сейчас будет лёгкая', 'интересная попалась', 'эта с подвохом, но ты вывезешь'],
  back: ['можно перепроверить', 'вернёмся и добьём', 'смотри ещё раз спокойно'],
  donePerfect: ['идеально. можно праздновать', 'разнёс. чистое прохождение', 'вот это я понимаю финиш'],
  doneGood: ['хорошая сессия. можно ещё круг', 'крепко прошёл. добьём остаток потом', 'нормально забрал, идём дальше'],
};

function pickMascotLine(lines, fallback = '') {
  const pool = Array.isArray(lines) ? lines.filter(Boolean) : [];
  if (pool.length === 0) return fallback;
  const filtered = pool.filter((line) => line !== lastMascotLine);
  const source = filtered.length ? filtered : pool;
  const next = source[Math.floor(Math.random() * source.length)];
  lastMascotLine = next;
  return next;
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
        .then((set) => ({ ...set, id: i + 1 }))
    )
  );
}

// STATE
let state = {
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
  const body =
    remaining === 1
      ? 'На сегодня осталась 1 карточка.'
      : `На сегодня осталось ${remaining} карточек.`;

  new Notification('English Cards', {
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
  const mobileBrowserContext = isMobileBrowserContext();
  document.getElementById('daily-count').textContent = `${Math.min(done, goal)} / ${goal}`;
  document.getElementById('streak-num').textContent = state.streak || 0;

  const reminderToggle = document.getElementById('reminder-toggle');
  const reminderTime = document.getElementById('reminder-time');
  const reminderNote = document.getElementById('reminder-note');
  reminderToggle.textContent = mobileBrowserContext
    ? 'напомнить · app'
    : reminderEnabled
      ? 'напомнить · вкл'
      : 'напомнить';
  reminderToggle.classList.toggle('active', reminderEnabled);
  reminderTime.value = formatReminderTime(state.reminderTime);
  reminderTime.disabled = !reminderEnabled || mobileBrowserContext;
  reminderToggle.disabled = permission === 'unsupported' || mobileBrowserContext;
  if (reminderNote) {
    reminderNote.textContent = mobileBrowserContext
      ? 'на телефоне работает после установки на экран'
      : permission === 'unsupported'
        ? 'уведомления здесь не поддерживаются'
        : '';
  }

  const visibleIds = getVisibleIds();
  const baseEnabled = getBaseEnabledIds();
  const mixSourceIds = visibleIds.filter((id) => baseEnabled.includes(id));
  const enabledForMix = mixSourceIds.length;

  const mixSubText =
    activeFilters.length === 0 && enabledForMix === SETS.length && SETS.length > 0
      ? `${state.dailyGoal} карточек из всех тем`
      : `${state.dailyGoal} карточек из ${enabledForMix} тем`;
  document.getElementById('mix-sub').textContent = mixSubText;
  document.getElementById('mix-fab-count').textContent = state.dailyGoal;
  document.getElementById('daily-goal').value = state.dailyGoal;

  const noneEnabled = mixSourceIds.length === 0;
  const allVisibleEnabled =
    visibleIds.length > 0 && visibleIds.every((id) => baseEnabled.includes(id));
  document.getElementById('select-all-btn').textContent = allVisibleEnabled ? 'снять все' : 'выбрать все';

  const sectionTitleEl = document.querySelector('#home-screen .section-title');
  if (sectionTitleEl) {
    if (activeFilters.length === 0) {
      sectionTitleEl.textContent = 'все темы';
    } else if (activeFilters.length <= 2) {
      sectionTitleEl.textContent = `темы: ${activeFilters.join(', ')}`;
    } else {
      sectionTitleEl.textContent = `темы: ${activeFilters.length} категорий`;
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
      btn.textContent = text;
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
        <div class="set-name">${set.name}</div>
        <div class="set-meta">${total} карточек${isDone ? ' · пройден' : ''}</div>
      </div>
      <div class="set-progress">
        <div class="set-bar-wrap"><div class="set-bar" style="width:${pct}%"></div></div>
        <div class="set-pct">${pct}%</div>
      </div>
    `;
    el.querySelector('.set-check').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSetInMix(set.id);
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

  document.getElementById('study-title').textContent = 'случайный микс';
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

  document.getElementById('study-title').textContent = set.name;
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
    el.textContent = pickMascotLine(MASCOT_LINES.doneGood, 'готово. можно ещё круг');
    return;
  }

  if (!session.flipped) {
    if (remaining === 1) {
      el.textContent = pickMascotLine(MASCOT_LINES.final, 'последняя карточка. добей её');
    } else if (current <= 2) {
      el.textContent = pickMascotLine(MASCOT_LINES.opening, 'хороший темп. жми на карточку');
    } else if (remaining <= 3) {
      el.textContent = pickMascotLine(MASCOT_LINES.late, `осталось ${remaining}. держим ритм`);
    } else if (current > Math.ceil(total / 2)) {
      el.textContent = pickMascotLine(MASCOT_LINES.mid, `осталось ${remaining}. держим ритм`);
    } else {
      el.textContent = pickMascotLine(MASCOT_LINES.early, `осталось ${remaining}. держим ритм`);
    }
    return;
  }

  el.textContent = pickMascotLine(MASCOT_LINES.flipped, 'оцени честно и поехали дальше');
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
    const mood = session.flipped ? 'blink' : Math.random() > 0.55 ? 'wonder' : 'idle';
    const lines = session.flipped
      ? MASCOT_LINES.ambientReveal
      : remaining <= 2
        ? MASCOT_LINES.final
        : Math.random() > 0.7
          ? MASCOT_LINES.wonder
          : MASCOT_LINES.ambient;

    setMascotText(pickMascotLine(lines, 'держим ход'));
    triggerMascotReaction(mood);
    scheduleMascotAmbient();
  }, delay);
}

function triggerMascotReaction(mood) {
  const el = document.getElementById('study-mascot');
  if (!el) return;

  if (mascotReactionTimerId) clearTimeout(mascotReactionTimerId);
  el.dataset.mood = mood;
  el.classList.remove('is-reacting');
  void el.offsetWidth;
  el.classList.add('is-reacting');

  mascotReactionTimerId = window.setTimeout(() => {
    el.classList.remove('is-reacting');
    el.dataset.mood = 'idle';
  }, 520);
}

function triggerDoneCelebration(perfect) {
  const doneMascot = document.getElementById('done-mascot');
  const doneText = document.getElementById('done-mascot-text');
  const doneCelebration = document.getElementById('done-celebration');
  if (doneMascot) {
    doneMascot.dataset.mood = perfect ? 'cheer' : 'wonder';
    doneMascot.classList.remove('is-reacting');
    void doneMascot.offsetWidth;
    doneMascot.classList.add('is-reacting');
  }
  if (doneText) {
    doneText.textContent = pickMascotLine(
      perfect ? MASCOT_LINES.donePerfect : MASCOT_LINES.doneGood,
      perfect ? 'идеально. можно праздновать' : 'хорошая сессия. можно ещё круг'
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
  document.getElementById('study-counter').textContent = `${idx + 1} / ${total}`;
  document.getElementById('progress-fill').style.width = `${(idx / total) * 100}%`;
  document.getElementById('tap-hint').textContent = 'нажми чтобы перевернуть';
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
  updateMascotMessage();
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
    document.getElementById('tap-hint').textContent = 'знал это слово?';
    document.getElementById('btn-wrong').style.opacity = '1';
    document.getElementById('btn-right').style.opacity = '1';
    updateMascotMessage();
    triggerMascotReaction('reveal');
    scheduleMascotAmbient();
  } else {
    front.classList.remove('hidden');
    back.classList.remove('visible');
    session.flipped = false;
    document.getElementById('tap-hint').textContent = 'нажми чтобы перевернуть';
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
      session.answers.filter((answer) => typeof answer === 'boolean').length + 1;
    const lines = correct
      ? answeredCount > 1 && answeredCount % 3 === 0
        ? MASCOT_LINES.streak
        : MASCOT_LINES.correct
      : MASCOT_LINES.wrong;
    mascotText.textContent = pickMascotLine(
      lines,
      correct ? 'вау, отлично. ещё одну' : 'нормально. следующую доберём'
    );
  }
  triggerMascotReaction(correct ? 'cheer' : 'nudge');
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
  setMascotText(pickMascotLine(MASCOT_LINES.back, 'вернёмся и добьём'));
  triggerMascotReaction('wonder');
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
    session.setId === 'mix' ? 'случайный микс' : SETS.find((s) => s.id === session.setId).name;
  const perfect = right === total;
  document.getElementById('done-title').textContent = perfect ? 'Отлично!' : 'Готово!';
  document.getElementById('done-sub').textContent = `${name} · ${right} из ${total} правильно`;
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
  if (id === 'study-screen') {
    scheduleMascotAmbient();
  } else {
    clearMascotAmbient();
  }
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

function initTheme() {
  const saved = localStorage.getItem('ec_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  applyThemeColor(saved);
}

// DAILY GOAL
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

document.addEventListener('visibilitychange', function () {
  if (!document.hidden) scheduleReminderCheck();
});

window.addEventListener('focus', function () {
  scheduleReminderCheck();
});

// INIT
async function init() {
  initTheme();
  const vEl = document.getElementById('app-version');
  if (vEl && window.APP_VERSION) vEl.textContent = window.APP_VERSION;
  await loadSets();
  loadState();
  let shouldSave = false;
  if (state.enabledSets === null) {
    state.enabledSets = SETS.map((s) => s.id);
    shouldSave = true;
  }
  const labels = getAllCategoryLabels();
  const nextFilters = getActiveCategoryFilters().filter((label) => labels.includes(label));
  if (nextFilters.length !== getActiveCategoryFilters().length || !Array.isArray(state.homeCategoryFilter)) {
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
