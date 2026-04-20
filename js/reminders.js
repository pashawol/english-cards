import { app, checkNewDay, saveState, t } from './core.js';

export function hasPendingDailyCards() {
  return app.state.todayCount < app.state.dailyGoal;
}

export function getReminderPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export function isStandaloneApp() {
  const mediaStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = window.navigator.standalone === true;
  return mediaStandalone || iosStandalone;
}

export function isMobileBrowserContext() {
  const ua = navigator.userAgent || '';
  const mobileDevice =
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  return mobileDevice && !isStandaloneApp();
}

export function formatReminderTime(value) {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? value : '20:00';
}

function getReminderDateParts(now = new Date()) {
  const [hours, minutes] = formatReminderTime(app.state.reminderTime).split(':').map(Number);
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  return { now, target };
}

function getPendingCardsCount() {
  return Math.max(app.state.dailyGoal - app.state.todayCount, 0);
}

function showReminderNotification(renderHome) {
  if (getReminderPermission() !== 'granted' || !hasPendingDailyCards()) return;
  const remaining = getPendingCardsCount();
  const body =
    remaining === 1 ? t('reminderBodyOne') : t('reminderBodyMany', { count: remaining });

  new Notification(t('reminderNotificationTitle'), {
    body,
    tag: `daily-reminder-${new Date().toDateString()}`,
  });
  app.state.reminderLastSentOn = new Date().toDateString();
  saveState();
  renderHome();
}

function maybeSendReminder(renderHome) {
  const lastDate = app.state.lastDate;
  checkNewDay();
  if (app.state.lastDate !== lastDate) renderHome();
  if (
    !app.state.reminderEnabled ||
    app.state.reminderLastSentOn === new Date().toDateString()
  ) {
    return;
  }
  if (!hasPendingDailyCards()) return;
  const { now, target } = getReminderDateParts();
  if (now >= target) showReminderNotification(renderHome);
}

export function scheduleReminderCheck(renderHome) {
  if (app.timers.reminderId) {
    clearTimeout(app.timers.reminderId);
    app.timers.reminderId = null;
  }

  if (!app.state.reminderEnabled || getReminderPermission() !== 'granted') return;

  maybeSendReminder(renderHome);

  const { now, target } = getReminderDateParts();
  const nextCheckAt = now < target ? target : new Date(now.getTime() + 60 * 1000);
  const delay = Math.max(nextCheckAt.getTime() - now.getTime(), 1000);
  app.timers.reminderId = window.setTimeout(() => scheduleReminderCheck(renderHome), delay);
}

export async function enableReminder({ renderHome, scheduleCheck }) {
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

  app.state.reminderEnabled = permission === 'granted';
  saveState();
  renderHome();
  scheduleCheck();
}

export function disableReminder({ renderHome, scheduleCheck }) {
  app.state.reminderEnabled = false;
  saveState();
  renderHome();
  scheduleCheck();
}
