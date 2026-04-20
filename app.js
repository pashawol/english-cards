import {
  app,
  checkNewDay,
  getActiveCategoryFilters,
  getAllCategoryLabels,
  getBaseEnabledIds,
  getVisibleIds,
  loadSets,
  loadState,
  resetMascotLineMemory,
  saveState,
} from './js/core.js';
import {
  disableReminder,
  enableReminder,
  formatReminderTime,
  getReminderPermission,
  scheduleReminderCheck,
} from './js/reminders.js';
import { showScreen } from './js/navigation.js';
import {
  answer as answerScreen,
  flipCard,
  goPrevCard as goPrevCardScreen,
  refreshDoneLanguage,
  refreshStudyLanguage,
  restartAll as restartAllScreen,
  restartWrong as restartWrongScreen,
  showCard as showCardScreen,
  showDone as showDoneScreen,
  startMix as startMixScreen,
  startSet as startSetScreen,
} from './js/screens/study.js';
import { renderHome as renderHomeScreen, toggleAllSets as toggleAllSetsScreen, toggleSetInMix as toggleSetInMixScreen } from './js/screens/home.js';
import { showMixTableView as showMixTableViewScreen, showTableView as showTableViewScreen } from './js/screens/table.js';
import {
  buildDOM,
  initTheme,
  toggleLanguage as toggleLanguageBase,
  toggleTheme,
} from './js/ui.js';

function showDone() {
  showDoneScreen({ showScreen, renderHome });
}

function showCard() {
  showCardScreen({ showDone });
}

function startSet(setId) {
  startSetScreen(setId, { showScreen });
  showCard();
}

function startMix() {
  startMixScreen({
    showScreen,
    dailyGoal: {
      getMixIds: () => getVisibleIds().filter((id) => getBaseEnabledIds().includes(id)),
    },
  });
  showCard();
}

function renderHome() {
  renderHomeScreen({
    startSet,
    toggleSetInMix,
    showTableView,
  });
}

function toggleAllSets() {
  toggleAllSetsScreen({ renderHome });
}

function toggleSetInMix(setId) {
  toggleSetInMixScreen({ setId, renderHome });
}

function showTableView(setId) {
  showTableViewScreen(setId, { showScreen });
}

function showMixTableView() {
  showMixTableViewScreen({ showScreen });
}

function answer(correct) {
  answerScreen(correct, {
    onAfterProgressChange: () => scheduleReminderCheck(renderHome),
    showCard,
  });
}

function goPrevCard() {
  goPrevCardScreen({ showScreen, showCard });
}

function goHome() {
  showScreen('home-screen');
  renderHome();
}

function restartWrong() {
  restartWrongScreen({ goHome, showScreen, showCard });
}

function restartAll() {
  restartAllScreen({ startMix, startSet });
}

function toggleLanguage() {
  toggleLanguageBase({
    onRenderHome: renderHome,
    onStudyRefresh: refreshStudyLanguage,
    onDoneRefresh: () => refreshDoneLanguage({ showDone }),
    resetMascotLineMemory,
  });
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleReminderCheck(renderHome);
});

window.addEventListener('focus', () => {
  scheduleReminderCheck(renderHome);
});

async function init() {
  initTheme();
  await loadSets();
  loadState();

  buildDOM({
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
    enableReminder: () =>
      enableReminder({
        renderHome,
        scheduleCheck: () => scheduleReminderCheck(renderHome),
      }),
    disableReminder: () =>
      disableReminder({
        renderHome,
        scheduleCheck: () => scheduleReminderCheck(renderHome),
      }),
    scheduleReminderCheck: () => scheduleReminderCheck(renderHome),
    formatReminderTime,
    getReminderPermission,
  });

  let shouldSave = false;
  if (app.state.enabledSets === null) {
    app.state.enabledSets = app.sets.map((set) => set.id);
    shouldSave = true;
  }

  const labels = getAllCategoryLabels();
  const nextFilters = getActiveCategoryFilters().filter((label) => labels.includes(label));
  if (
    nextFilters.length !== getActiveCategoryFilters().length ||
    !Array.isArray(app.state.homeCategoryFilter)
  ) {
    app.state.homeCategoryFilter = nextFilters;
    shouldSave = true;
  }

  const normalizedReminderTime = formatReminderTime(app.state.reminderTime);
  if (app.state.reminderTime !== normalizedReminderTime) {
    app.state.reminderTime = normalizedReminderTime;
    shouldSave = true;
  }

  if (getReminderPermission() !== 'granted') {
    if (app.state.reminderEnabled) shouldSave = true;
    app.state.reminderEnabled = false;
  }

  if (shouldSave) saveState();
  checkNewDay();
  renderHome();
  scheduleReminderCheck(renderHome);
}

init();
