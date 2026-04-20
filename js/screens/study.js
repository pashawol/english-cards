import {
  app,
  cloneProgressEntry,
  createSession,
  getMascotLines,
  pickMascotLine,
  saveState,
  t,
  translateSetName,
} from '../core.js';
import {
  clearMascotAmbient,
  scheduleMascotAmbient,
  setMascotMood,
  setMascotText,
  triggerDoneCelebration,
  triggerMascotReaction,
  updateMascotMessage,
} from '../mascot.js';
import { getSetBreadcrumb } from './table.js';

export function startMix({ showScreen, dailyGoal }) {
  const pool = [];
  const mixIds = dailyGoal.getMixIds();
  app.sets
    .filter((set) => mixIds.includes(set.id))
    .forEach((set) => {
      set.cards.forEach((card, i) => pool.push({ ...card, _setId: set.id, _cardIdx: i }));
    });

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  app.session = createSession('mix', pool.slice(0, app.state.dailyGoal));
  document.getElementById('study-title').textContent = t('randomMix');
  showScreen('study-screen');
}

export function startSet(setId, { showScreen }) {
  const set = app.sets.find((item) => item.id === setId);
  if (!set) return;

  const p = app.state.progress[setId] || { seen: [], correct: [] };
  const allCards = set.cards.map((card, i) => ({ ...card, _setId: setId, _cardIdx: i }));
  const unseen = allCards.filter((card) => !p.seen.includes(card._cardIdx));
  const seenWrong = allCards.filter(
    (card) => p.seen.includes(card._cardIdx) && !p.correct.includes(card._cardIdx),
  );
  const queue = unseen.length || seenWrong.length ? [...unseen, ...seenWrong] : allCards;

  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }

  app.session = createSession(setId, queue);
  document.getElementById('study-title').textContent = translateSetName(set.name);
  showScreen('study-screen');
}

export function showCard({ showDone }) {
  if (app.session.index >= app.session.queue.length) {
    showDone();
    return;
  }

  const card = app.session.queue[app.session.index];
  const total = app.session.queue.length;
  const idx = app.session.index;
  const cardArea = document.getElementById('card-area');

  document.getElementById('front-word').textContent = card.ru;
  document.getElementById('back-word').textContent = card.en;
  document.getElementById('front-hint').textContent = '';
  document.getElementById('back-hint').textContent = '';

  const crumbEl = document.getElementById('card-breadcrumb');
  if (crumbEl) {
    const set = app.sets.find((item) => item.id === card._setId);
    if (set) {
      crumbEl.textContent = [getSetBreadcrumb(set), translateSetName(set.name)]
        .filter(Boolean)
        .join(' · ');
    }
  }

  document.getElementById('study-counter').textContent = `${idx + 1} / ${total}`;
  document.getElementById('progress-fill').style.width = `${(idx / total) * 100}%`;
  document.getElementById('tap-hint').textContent = t('tapToFlip');
  const prevBtn = document.getElementById('study-backtrack-btn');
  if (prevBtn) prevBtn.disabled = idx === 0;

  app.session.flipped = false;
  app.session.transitioning = false;
  document.querySelector('.card-face.front').classList.remove('hidden');
  document.querySelector('.card-face.back').classList.remove('visible');

  if (cardArea) {
    cardArea.classList.remove('is-advancing', 'is-answer-right', 'is-answer-wrong', 'is-entering');
    if (app.timers.cardEnterId) clearTimeout(app.timers.cardEnterId);
    if (idx > 0) {
      cardArea.classList.add('is-entering');
      app.timers.cardEnterId = setTimeout(() => cardArea.classList.remove('is-entering'), 180);
    }
  }

  if (idx === 0 && app.session.answers.every((a) => a === undefined)) {
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

export function flipCard() {
  const front = document.querySelector('.card-face.front');
  const back = document.querySelector('.card-face.back');

  if (!app.session.flipped) {
    front.classList.add('hidden');
    back.classList.add('visible');
    app.session.flipped = true;
    document.getElementById('tap-hint').textContent = t('knewThisWord');
    document.getElementById('btn-wrong').style.opacity = '1';
    document.getElementById('btn-right').style.opacity = '1';
    updateMascotMessage();
    triggerMascotReaction(Math.random() > 0.5 ? 'telescope' : 'reveal');
  } else {
    front.classList.remove('hidden');
    back.classList.remove('visible');
    app.session.flipped = false;
    document.getElementById('tap-hint').textContent = t('tapToFlip');
    document.getElementById('btn-wrong').style.opacity = '0.35';
    document.getElementById('btn-right').style.opacity = '0.35';
    updateMascotMessage();
    triggerMascotReaction('blink');
  }

  scheduleMascotAmbient();
}

function recomputeSessionState({ onAfterProgressChange }) {
  Object.entries(app.session.initialProgress || {}).forEach(([setId, snapshot]) => {
    app.state.progress[setId] = cloneProgressEntry(snapshot);
  });

  let answeredCount = 0;
  let right = 0;
  const wrong = [];

  app.session.answers.forEach((answer, idx) => {
    if (typeof answer !== 'boolean') return;
    answeredCount++;
    const card = app.session.queue[idx];
    const setId = card._setId;
    const cardIdx = card._cardIdx;

    if (!app.state.progress[setId]) app.state.progress[setId] = { seen: [], correct: [] };
    const p = app.state.progress[setId];

    if (!p.seen.includes(cardIdx)) p.seen.push(cardIdx);
    if (answer) {
      right++;
      if (!p.correct.includes(cardIdx)) p.correct.push(cardIdx);
    } else {
      p.correct = p.correct.filter((i) => i !== cardIdx);
      wrong.push(card);
    }
  });

  app.session.right = right;
  app.session.wrong = wrong;
  app.state.todayCount = app.session.baseTodayCount + answeredCount;
  saveState();
  onAfterProgressChange();
}

export function answer(correct, { onAfterProgressChange, showCard }) {
  if (app.session.transitioning || app.session.index >= app.session.queue.length) return;

  const mascotText = document.getElementById('mascot-text');
  if (mascotText) {
    const answeredCount = app.session.answers.filter((a) => typeof a === 'boolean').length + 1;
    let consecutiveCorrect = 0;
    for (let i = app.session.index - 1; i >= 0; i--) {
      if (app.session.answers[i] === true) consecutiveCorrect++;
      else break;
    }

    let answerMood;
    let lines;
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

  app.session.transitioning = true;
  clearMascotAmbient();

  const cardArea = document.getElementById('card-area');
  if (cardArea) {
    cardArea.classList.remove('is-entering', 'is-answer-right', 'is-answer-wrong');
    cardArea.classList.add('is-advancing', correct ? 'is-answer-right' : 'is-answer-wrong');
  }

  app.session.answers[app.session.index] = correct;
  recomputeSessionState({ onAfterProgressChange });

  if (app.timers.cardAdvanceId) clearTimeout(app.timers.cardAdvanceId);
  app.timers.cardAdvanceId = setTimeout(() => {
    app.session.index++;
    showCard();
  }, 150);
}

export function goPrevCard({ showScreen, showCard }) {
  if (app.session.transitioning || app.session.index <= 0) return;
  app.session.index--;
  setMascotText(pickMascotLine(getMascotLines('back'), ''));
  triggerMascotReaction('wave');
  showScreen('study-screen');
  showCard();
}

export function showDone({ showScreen, renderHome }) {
  showScreen('done-screen');
  const total = app.session.queue.length;
  const right = app.session.right;
  const name =
    app.session.setId === 'mix'
      ? t('randomMix')
      : translateSetName(app.sets.find((set) => set.id === app.session.setId)?.name || '');
  const perfect = right === total;

  document.getElementById('done-right').textContent = right;
  document.getElementById('done-wrong').textContent = total - right;
  document.getElementById('done-total').textContent = total;
  document.getElementById('done-title').textContent = perfect
    ? t('excellentTitle')
    : t('doneTitle');
  document.getElementById('done-sub').textContent = t('doneSub', { name, right, total });
  document.getElementById('progress-fill').style.width = '100%';
  triggerDoneCelebration(perfect);
  renderHome();
}

export function restartWrong({ goHome, showScreen, showCard }) {
  if (app.session.wrong.length === 0) {
    goHome();
    return;
  }
  app.session = createSession(app.session.setId, [...app.session.wrong]);
  showScreen('study-screen');
  showCard();
}

export function restartAll({ startMix, startSet }) {
  if (app.session.setId === 'mix') {
    startMix();
    return;
  }
  startSet(app.session.setId);
}

export function refreshStudyLanguage() {
  if (
    !document.getElementById('study-screen')?.classList.contains('active') ||
    !app.session.queue.length
  ) {
    return;
  }
  const studyTitle = document.getElementById('study-title');
  if (studyTitle && app.session.setId === 'mix') studyTitle.textContent = t('randomMix');
  document.getElementById('tap-hint').textContent = app.session.flipped
    ? t('knewThisWord')
    : t('tapToFlip');
  updateMascotMessage();
}

export function refreshDoneLanguage({ showDone }) {
  if (
    !document.getElementById('done-screen')?.classList.contains('active') ||
    !app.session.queue.length
  ) {
    return;
  }
  showDone();
}
