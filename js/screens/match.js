const matchState = {
  pairs: [],
  ruOrder: [],
  enOrder: [],
  selectedRu: null,
  selectedEn: null,
  matched: new Set(),
  checking: false,
  sourceCards: [],
};

function getBtn(side, pairId) {
  return document.querySelector(`#match-col-${side} [data-pair-id="${pairId}"]`);
}

export function startMatch(cards, { showScreen }) {
  matchState.sourceCards = cards;
  const pool = [...cards].sort(() => Math.random() - 0.5).slice(0, Math.min(6, cards.length));
  matchState.pairs = pool.map((card, i) => ({ ru: card.ru, en: card.en, id: i }));
  matchState.ruOrder = matchState.pairs.map((_, i) => i);
  matchState.enOrder = [...matchState.ruOrder].sort(() => Math.random() - 0.5);
  matchState.selectedRu = null;
  matchState.selectedEn = null;
  matchState.matched = new Set();
  matchState.checking = false;

  document.getElementById('match-done-area').hidden = true;
  document.getElementById('match-grid').hidden = false;
  renderMatchGrid();
  updateMatchCounter();
  showScreen('match-screen');
}

function renderMatchGrid() {
  const ruCol = document.getElementById('match-col-ru');
  const enCol = document.getElementById('match-col-en');
  ruCol.innerHTML = '';
  enCol.innerHTML = '';

  matchState.ruOrder.forEach((pairId) => {
    const btn = document.createElement('button');
    btn.className = 'match-item';
    btn.textContent = matchState.pairs[pairId].ru;
    btn.dataset.pairId = pairId;
    btn.addEventListener('click', () => tapMatch('ru', pairId));
    ruCol.appendChild(btn);
  });

  matchState.enOrder.forEach((pairId) => {
    const btn = document.createElement('button');
    btn.className = 'match-item';
    btn.textContent = matchState.pairs[pairId].en;
    btn.dataset.pairId = pairId;
    btn.addEventListener('click', () => tapMatch('en', pairId));
    enCol.appendChild(btn);
  });
}

function updateMatchCounter() {
  const total = matchState.pairs.length;
  const matched = matchState.matched.size;
  document.getElementById('match-counter').textContent = `${matched} / ${total}`;
}

export function tapMatch(side, pairId) {
  if (matchState.checking) return;
  if (matchState.matched.has(pairId)) return;

  if (side === 'ru') {
    if (matchState.selectedRu === pairId) {
      matchState.selectedRu = null;
      getBtn('ru', pairId)?.classList.remove('selected');
      return;
    }
    if (matchState.selectedRu !== null) {
      getBtn('ru', matchState.selectedRu)?.classList.remove('selected');
    }
    matchState.selectedRu = pairId;
    getBtn('ru', pairId)?.classList.add('selected');
  } else {
    if (matchState.selectedEn === pairId) {
      matchState.selectedEn = null;
      getBtn('en', pairId)?.classList.remove('selected');
      return;
    }
    if (matchState.selectedEn !== null) {
      getBtn('en', matchState.selectedEn)?.classList.remove('selected');
    }
    matchState.selectedEn = pairId;
    getBtn('en', pairId)?.classList.add('selected');
  }

  if (matchState.selectedRu !== null && matchState.selectedEn !== null) {
    checkMatchPair();
  }
}

function checkMatchPair() {
  const ruId = matchState.selectedRu;
  const enId = matchState.selectedEn;
  matchState.checking = true;

  const ruBtn = getBtn('ru', ruId);
  const enBtn = getBtn('en', enId);

  if (ruId === enId) {
    ruBtn?.classList.remove('selected');
    enBtn?.classList.remove('selected');
    ruBtn?.classList.add('matched');
    enBtn?.classList.add('matched');
    matchState.matched.add(ruId);
    matchState.selectedRu = null;
    matchState.selectedEn = null;
    matchState.checking = false;
    updateMatchCounter();

    if (matchState.matched.size === matchState.pairs.length) {
      setTimeout(showMatchDone, 400);
    }
  } else {
    ruBtn?.classList.add('wrong');
    enBtn?.classList.add('wrong');
    setTimeout(() => {
      ruBtn?.classList.remove('selected', 'wrong');
      enBtn?.classList.remove('selected', 'wrong');
      matchState.selectedRu = null;
      matchState.selectedEn = null;
      matchState.checking = false;
    }, 600);
  }
}

function showMatchDone() {
  document.getElementById('match-grid').hidden = true;
  document.getElementById('match-done-area').hidden = false;
}

export function restartMatch(deps) {
  startMatch(matchState.sourceCards, deps);
}
