export const IS_DEV = ['localhost', '127.0.0.1', ''].includes(location.hostname);
export const I18N = window.I18N || {};

export const app = {
  sets: [],
  state: {
    uiLang: 'en',
    dailyGoal: 10,
    todayCount: 0,
    streak: 0,
    lastDate: null,
    progress: {},
    enabledSets: null,
    homeCategoryFilter: [],
    reminderEnabled: false,
    reminderTime: '20:00',
    reminderLastSentOn: null,
  },
  session: {
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
  },
  timers: {
    reminderId: null,
    mascotReactionIds: {},
    cardAdvanceId: null,
    cardEnterId: null,
    mascotAmbientId: null,
  },
  lastMascotLine: '',
};

export function getLang() {
  return app.state.uiLang === 'ru' ? 'ru' : 'en';
}

export function t(key, vars = {}) {
  const lang = getLang();
  const value = I18N[lang]?.[key] ?? I18N.en?.[key] ?? key;
  if (typeof value !== 'string') return value;
  return value.replace(/\{(\w+)\}/g, (_, token) => `${vars[token] ?? ''}`);
}

export function getMascotLines(key) {
  const lang = getLang();
  return I18N[lang]?.mascot?.[key] ?? I18N.en?.mascot?.[key] ?? [];
}

export function translateCategory(label) {
  const lang = getLang();
  return I18N[lang]?.categories?.[label] ?? I18N.en?.categories?.[label] ?? label;
}

export function translateSetName(name) {
  const lang = getLang();
  return I18N[lang]?.setNames?.[name] ?? I18N.en?.setNames?.[name] ?? name;
}

export function pickMascotLine(lines, fallback = '') {
  const pool = Array.isArray(lines) ? lines.filter(Boolean) : [];
  if (pool.length === 0) return fallback;
  const filtered = pool.filter((line) => line !== app.lastMascotLine);
  const source = filtered.length ? filtered : pool;
  const next = source[Math.floor(Math.random() * source.length)];
  app.lastMascotLine = next;
  return next;
}

export function resetMascotLineMemory() {
  app.lastMascotLine = '';
}

export function formatCardCount(count) {
  return t('cards', { count });
}

export function normalizeCategories(set) {
  if (Array.isArray(set.categories)) {
    return set.categories.filter((c) => typeof c === 'string' && c);
  }
  if (typeof set.category === 'string' && set.category) return [set.category];
  return [];
}

export function getAllCategoryLabels() {
  const labels = new Set();
  app.sets.forEach((set) => normalizeCategories(set).forEach((c) => labels.add(c)));
  return [...labels].sort((a, b) => a.localeCompare(b, 'ru'));
}

export function getActiveCategoryFilters() {
  const value = app.state.homeCategoryFilter;
  if (Array.isArray(value)) return value.filter((c) => typeof c === 'string' && c);
  if (typeof value === 'string' && value) return [value];
  return [];
}

export function getVisibleSets() {
  const filters = getActiveCategoryFilters();
  if (filters.length === 0) return app.sets;
  return app.sets.filter((set) => normalizeCategories(set).some((cat) => filters.includes(cat)));
}

export function getVisibleIds() {
  return getVisibleSets().map((set) => set.id);
}

export function getBaseEnabledIds() {
  return app.state.enabledSets != null ? app.state.enabledSets : app.sets.map((set) => set.id);
}

export function cloneProgressEntry(entry) {
  return {
    seen: Array.isArray(entry?.seen) ? [...entry.seen] : [],
    correct: Array.isArray(entry?.correct) ? [...entry.correct] : [],
  };
}

export function createSession(setId, queue) {
  const touchedSetIds = [...new Set(queue.map((card) => card._setId))];
  const initialProgress = {};
  touchedSetIds.forEach((id) => {
    initialProgress[id] = cloneProgressEntry(app.state.progress[id]);
  });

  return {
    setId,
    queue,
    index: 0,
    wrong: [],
    right: 0,
    flipped: false,
    answers: Array(queue.length).fill(undefined),
    baseTodayCount: app.state.todayCount,
    initialProgress,
    transitioning: false,
  };
}

export async function loadSets() {
  const manifest = await fetch('data/manifest.json').then((r) => r.json());
  app.sets = await Promise.all(
    manifest.map((file, i) =>
      fetch(`data/${file}`)
        .then((r) => r.json())
        .then((set) => ({ ...set, id: i + 1 })),
    ),
  );
}

export function saveState() {
  localStorage.setItem('ec_state', JSON.stringify(app.state));
}

export function checkNewDay() {
  const today = new Date().toDateString();
  if (app.state.lastDate !== today) {
    if (app.state.lastDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (
        app.state.lastDate === yesterday.toDateString() &&
        app.state.todayCount >= app.state.dailyGoal
      ) {
        app.state.streak = (app.state.streak || 0) + 1;
      } else if (app.state.lastDate !== yesterday.toDateString()) {
        app.state.streak = 0;
      }
    }
    app.state.todayCount = 0;
    app.state.lastDate = today;
    app.state.reminderLastSentOn = null;
    saveState();
  }
}

export function loadState() {
  const raw = localStorage.getItem('ec_state');
  if (raw) {
    try {
      app.state = { ...app.state, ...JSON.parse(raw) };
    } catch {}
  }
  checkNewDay();
}
