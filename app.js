// DATA
let SETS = [];

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
};

let session = {
  setId: null,
  queue: [],
  index: 0,
  wrong: [],
  right: 0,
  flipped: false,
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
    saveState();
  }
}

// RENDER HOME
function renderHome() {
  const goal = state.dailyGoal;
  const done = state.todayCount;
  document.getElementById('daily-count').textContent = `${Math.min(done, goal)} / ${goal}`;
  document.getElementById('daily-sub').textContent =
    done >= goal ? 'цель выполнена!' : `ещё ${goal - done} карточек`;
  document.getElementById('streak-num').textContent = state.streak || 0;
  const enabledCount = state.enabledSets ? state.enabledSets.length : SETS.length;
  const mixSubText =
    enabledCount === SETS.length
      ? `${state.dailyGoal} карточек из всех тем`
      : `${state.dailyGoal} карточек из ${enabledCount} тем`;
  document.getElementById('mix-sub').textContent = mixSubText;
  document.getElementById('daily-goal').value = state.dailyGoal;
  document.getElementById('goal-val').textContent = state.dailyGoal;

  const allIds = SETS.map((s) => s.id);
  const noneEnabled = !state.enabledSets || state.enabledSets.length === 0;
  const allEnabled = !noneEnabled && allIds.every((id) => state.enabledSets.includes(id));
  document.getElementById('select-all-btn').textContent = allEnabled ? 'снять все' : 'выбрать все';

  const warning = document.getElementById('mix-warning');
  const mixBtn = document.getElementById('mix-btn');
  warning.style.display = noneEnabled ? 'block' : 'none';
  mixBtn.style.opacity = noneEnabled ? '0.4' : '1';
  mixBtn.style.pointerEvents = noneEnabled ? 'none' : 'auto';

  const list = document.getElementById('set-list');
  list.innerHTML = '';
  SETS.forEach((set) => {
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
  const allIds = SETS.map((s) => s.id);
  const allEnabled = allIds.every((id) => state.enabledSets.includes(id));
  state.enabledSets = allEnabled ? [] : [...allIds];
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
  const enabledIds = state.enabledSets || SETS.map((s) => s.id);
  let pool = [];
  SETS.filter((s) => enabledIds.includes(s.id)).forEach((set) => {
    set.cards.forEach((card, i) => {
      pool.push({ ...card, _setId: set.id, _cardIdx: i });
    });
  });

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const queue = pool.slice(0, goal);

  session = { setId: 'mix', queue, index: 0, wrong: [], right: 0, flipped: false };

  document.getElementById('study-title').textContent = 'случайный микс';
  showScreen('study-screen');
  showCard();
}

// START SET
function startSet(setId) {
  const set = SETS.find((s) => s.id === setId);
  if (!set) return;

  const p = state.progress[setId] || { seen: [], correct: [] };
  let unseen = set.cards.filter((_, i) => !p.seen.includes(i));
  let seenWrong = set.cards.filter((_, i) => p.seen.includes(i) && !p.correct.includes(i));
  let queue = [...unseen, ...seenWrong];
  if (queue.length === 0) queue = [...set.cards];

  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }

  session = { setId, queue, index: 0, wrong: [], right: 0, flipped: false };

  document.getElementById('study-title').textContent = set.name;
  showScreen('study-screen');
  showCard();
}

function showCard() {
  if (session.index >= session.queue.length) {
    showDone();
    return;
  }
  const card = session.queue[session.index];
  const total = session.queue.length;
  const idx = session.index;

  document.getElementById('front-word').textContent = card.ru;
  document.getElementById('back-word').textContent = card.en;
  document.getElementById('front-hint').textContent = '';
  document.getElementById('back-hint').textContent = '';
  document.getElementById('study-counter').textContent = `${idx + 1} / ${total}`;
  document.getElementById('progress-fill').style.width = `${(idx / total) * 100}%`;
  document.getElementById('tap-hint').textContent = 'нажми чтобы перевернуть';

  session.flipped = false;
  document.querySelector('.card-face.front').classList.remove('hidden');
  document.querySelector('.card-face.back').classList.remove('visible');

  document.getElementById('btn-wrong').style.opacity = '0.35';
  document.getElementById('btn-right').style.opacity = '0.35';
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
  } else {
    front.classList.remove('hidden');
    back.classList.remove('visible');
    session.flipped = false;
    document.getElementById('tap-hint').textContent = 'нажми чтобы перевернуть';
    document.getElementById('btn-wrong').style.opacity = '0.35';
    document.getElementById('btn-right').style.opacity = '0.35';
  }
}

function answer(correct) {
  if (!session.flipped) {
    flipCard();
    return;
  }

  const card = session.queue[session.index];

  if (session.setId === 'mix') {
    const setId = card._setId;
    const cardIdx = card._cardIdx;
    if (!state.progress[setId]) state.progress[setId] = { seen: [], correct: [] };
    const p = state.progress[setId];
    if (!p.seen.includes(cardIdx)) p.seen.push(cardIdx);
    if (correct) {
      session.right++;
      if (!p.correct.includes(cardIdx)) p.correct.push(cardIdx);
    } else {
      session.wrong.push(card);
      p.correct = p.correct.filter((i) => i !== cardIdx);
    }
  } else {
    const set = SETS.find((s) => s.id === session.setId);
    const cardIdx = set.cards.indexOf(card);
    if (!state.progress[session.setId])
      state.progress[session.setId] = { seen: [], correct: [] };
    const p = state.progress[session.setId];
    if (!p.seen.includes(cardIdx)) p.seen.push(cardIdx);
    if (correct) {
      session.right++;
      if (!p.correct.includes(cardIdx)) p.correct.push(cardIdx);
    } else {
      session.wrong.push(card);
      p.correct = p.correct.filter((i) => i !== cardIdx);
    }
  }

  state.todayCount++;
  saveState();

  session.index++;
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
  document.getElementById('done-title').textContent = right === total ? 'Отлично!' : 'Готово!';
  document.getElementById('done-sub').textContent = `${name} · ${right} из ${total} правильно`;
  document.getElementById('progress-fill').style.width = '100%';
  renderHome();
}

function restartWrong() {
  if (session.wrong.length === 0) {
    goHome();
    return;
  }
  session.queue = [...session.wrong];
  session.index = 0;
  session.wrong = [];
  session.right = 0;
  session.flipped = false;
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
  document.getElementById('goal-val').textContent = this.value;
  saveState();
  renderHome();
});

// INIT
async function init() {
  initTheme();
  await loadSets();
  loadState();
  if (state.enabledSets === null) {
    state.enabledSets = SETS.map((s) => s.id);
    saveState();
  }
  renderHome();
}

init();
