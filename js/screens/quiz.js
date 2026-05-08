import { app, t } from '../core.js';

const quizState = {
  questions: [],
  index: 0,
  right: 0,
  sourceCards: [],
};

function buildOptions(correctCard) {
  const allCards = app.sets.flatMap((s) => s.cards);
  const pool = allCards.filter((c) => c.en !== correctCard.en);
  const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 3).map((c) => c.en);
  const options = [correctCard.en, ...shuffled].sort(() => Math.random() - 0.5);
  return { options, correctIdx: options.indexOf(correctCard.en) };
}

function buildQuestions(cards) {
  return [...cards]
    .sort(() => Math.random() - 0.5)
    .map((card) => {
      const { options, correctIdx } = buildOptions(card);
      return { ru: card.ru, options, correctIdx };
    });
}

export function startQuiz(cards, { showScreen }) {
  quizState.sourceCards = cards;
  quizState.questions = buildQuestions(cards);
  quizState.index = 0;
  quizState.right = 0;

  const doneArea = document.getElementById('quiz-done-area');
  const questionArea = document.getElementById('quiz-question-area');
  if (doneArea) doneArea.hidden = true;
  if (questionArea) questionArea.hidden = false;

  document.getElementById('quiz-title').textContent = t('quizTitle') || 'Quiz';
  showScreen('quiz-screen');
  renderQuestion();
}

function renderQuestion() {
  const { questions, index } = quizState;
  const total = questions.length;
  const q = questions[index];

  document.getElementById('quiz-counter').textContent = `${index + 1} / ${total}`;
  document.getElementById('quiz-progress-fill').style.width = `${(index / total) * 100}%`;
  document.getElementById('quiz-question').textContent = q.ru;

  document.querySelectorAll('.quiz-option-btn').forEach((btn, i) => {
    btn.textContent = q.options[i];
    btn.className = 'quiz-option-btn';
    btn.disabled = false;
  });
}

export function answerQuiz(optionIdx, deps) {
  const { questions, index } = quizState;
  const q = questions[index];
  const correct = optionIdx === q.correctIdx;

  if (correct) quizState.right++;

  document.querySelectorAll('.quiz-option-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correctIdx) btn.classList.add('correct');
    else if (i === optionIdx && !correct) btn.classList.add('wrong');
  });

  setTimeout(() => {
    quizState.index++;
    if (quizState.index >= questions.length) {
      showQuizDone(deps);
    } else {
      renderQuestion();
    }
  }, 700);
}

function showQuizDone(deps) {
  const total = quizState.questions.length;
  const right = quizState.right;

  document.getElementById('quiz-progress-fill').style.width = '100%';
  document.getElementById('quiz-done-right').textContent = right;
  document.getElementById('quiz-done-wrong').textContent = total - right;
  document.getElementById('quiz-done-total').textContent = total;
  document.getElementById('quiz-question-area').hidden = true;
  document.getElementById('quiz-done-area').hidden = false;
}

export function restartQuiz(deps) {
  quizState.questions = buildQuestions(quizState.sourceCards);
  quizState.index = 0;
  quizState.right = 0;
  document.getElementById('quiz-done-area').hidden = true;
  document.getElementById('quiz-question-area').hidden = false;
  renderQuestion();
}
