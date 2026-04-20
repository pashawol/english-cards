import { app, getMascotLines, pickMascotLine, t } from './core.js';

const MASCOT_TAP_POOLS = {
  study: ['somersault', 'coffee', 'smoke', 'moonwalk', 'facepalm', 'thumbsup', 'clap', 'basketball', 'wave'],
  done: ['clap', 'somersault', 'moonwalk', 'thumbsup', 'wave', 'coffee'],
};

const MOOD_DURATION = {
  reveal: 450,
  cheer: 520,
  nudge: 420,
  wonder: 500,
  blink: 340,
  somersault: 1200,
  wave: 750,
  thumbsup: 850,
  clap: 1200,
  boxing: 1050,
  basketball: 1450,
  telescope: 650,
  coffee: 2200,
  smoke: 2200,
  moonwalk: 1250,
  facepalm: 980,
};

export function updateMascotMessage() {
  const el = document.getElementById('mascot-text');
  if (!el) return;

  const total = app.session.queue.length;
  const current = app.session.index + 1;
  const remaining = Math.max(total - app.session.index, 0);

  if (app.session.index >= total) {
    el.textContent = pickMascotLine(getMascotLines('doneGood'), t('doneTitle'));
    return;
  }

  if (!app.session.flipped) {
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

export function setMascotMood(mood) {
  const el = document.getElementById('study-mascot');
  if (!el) return;
  el.dataset.mood = mood;
}

export function setMascotText(text, elementId = 'mascot-text') {
  const el = document.getElementById(elementId);
  if (!el || !text) return;
  el.textContent = text;
}

export function clearMascotAmbient() {
  if (app.timers.mascotAmbientId) {
    clearTimeout(app.timers.mascotAmbientId);
    app.timers.mascotAmbientId = null;
  }
}

export function scheduleMascotAmbient() {
  clearMascotAmbient();
  const studyScreen = document.getElementById('study-screen');
  if (!studyScreen || !studyScreen.classList.contains('active')) return;
  if (app.session.index >= app.session.queue.length || app.session.transitioning) return;

  const delay = 4200 + Math.floor(Math.random() * 2200);
  app.timers.mascotAmbientId = window.setTimeout(() => {
    if (!studyScreen.classList.contains('active') || app.session.transitioning) return;

    const remaining = app.session.queue.length - app.session.index;
    const r = Math.random();
    const mood = app.session.flipped
      ? 'blink'
      : r > 0.84
        ? 'coffee'
        : r > 0.68
          ? 'smoke'
          : r > 0.52
            ? 'basketball'
            : r > 0.32
              ? 'wonder'
              : 'idle';
    const lines = app.session.flipped
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

export function triggerMascotReaction(mood, elementId = 'study-mascot') {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (app.timers.mascotReactionIds[elementId]) {
    clearTimeout(app.timers.mascotReactionIds[elementId]);
  }
  el.dataset.mood = mood;
  el.classList.remove('is-reacting');
  void el.offsetWidth;
  el.classList.add('is-reacting');

  app.timers.mascotReactionIds[elementId] = window.setTimeout(() => {
    el.classList.remove('is-reacting');
    el.dataset.mood = 'idle';
  }, MOOD_DURATION[mood] ?? 520);
}

function getMascotTapLines(mood) {
  if (mood === 'facepalm') return getMascotLines('facepalm');
  if (mood === 'moonwalk') return getMascotLines('moonwalk');
  return getMascotLines(mood);
}

export function triggerMascotTapReaction(elementId = 'study-mascot', textId = 'mascot-text') {
  const mascot = document.getElementById(elementId);
  if (!mascot) return;

  const pool = elementId === 'done-mascot' ? MASCOT_TAP_POOLS.done : MASCOT_TAP_POOLS.study;
  const mood = pool[Math.floor(Math.random() * pool.length)];
  setMascotText(pickMascotLine(getMascotTapLines(mood), ''), textId);
  triggerMascotReaction(mood, elementId);

  if (elementId === 'study-mascot') scheduleMascotAmbient();
}

export function bindMascotInteraction(elementId, textId) {
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

export function triggerDoneCelebration(perfect) {
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
