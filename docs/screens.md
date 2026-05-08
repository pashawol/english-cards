# Screens

All screens live in `js/screens/`. Each module exports functions that take a `deps` object for injected callbacks — no direct imports of `app.js`.

---

## home.js

Renders the home screen: daily progress, set list, category filters, reminder controls.

### Exports

| Function | Signature | Description |
|---|---|---|
| `renderHome` | `({ startSet, toggleSetInMix, showTableView, startQuiz })` | Full re-render of home screen DOM |
| `toggleAllSets` | `({ renderHome })` | Toggles all visible sets in/out of mix |
| `toggleSetInMix` | `({ setId, renderHome })` | Toggles a single set in/out of mix |

### Set item buttons

Each set row renders three action buttons:
- `≡` (`set-view-btn`) — opens table view for that set
- `⊞` (`set-quiz-btn`) — launches quiz for that set via `startQuiz(set.id)`
- Clicking the row body — calls `startSet(set.id)`

---

## study.js

Study session: card display, flip, answer recording, back-navigation, done screen.

### Exports

| Function | Signature | Description |
|---|---|---|
| `startSet` | `(setId, { showScreen })` | Builds queue for a single set and starts session |
| `startMix` | `({ showScreen, dailyGoal })` | Builds cross-set queue up to `dailyGoal` cards |
| `showCard` | `({ showDone })` | Renders current card from `app.session` |
| `flipCard` | `()` | Toggles front/back of current card |
| `answer` | `(correct, { onAfterProgressChange, showCard })` | Records answer, advances session |
| `goPrevCard` | `({ showScreen, showCard })` | Goes back one card in session |
| `showDone` | `({ showScreen, renderHome })` | Transitions to done screen with stats |
| `restartWrong` | `({ goHome, showScreen, showCard })` | Restarts session with wrong-answer cards only |
| `restartAll` | `({ startMix, startSet })` | Restarts full session |
| `refreshStudyLanguage` | `()` | Re-applies i18n strings to study screen |
| `refreshDoneLanguage` | `({ showDone })` | Re-applies i18n strings to done screen |

### Session state

`recomputeSessionState()` is called after every answer. It replays `session.answers` from scratch to rebuild `state.progress`, `session.right`, `session.wrong`, and `state.todayCount`. Do not replace with naive increment/decrement — see CLAUDE.md.

---

## quiz.js

Multiple-choice exercise. Shows Russian word, user picks correct English translation from 4 options.

### Exports

| Function | Signature | Description |
|---|---|---|
| `startQuiz` | `(cards, { showScreen })` | Builds shuffled questions from `cards`, shows `#quiz-screen` |
| `answerQuiz` | `(optionIdx, deps)` | Records answer, highlights correct/wrong, advances after 700ms |
| `restartQuiz` | `(deps)` | Rebuilds questions from `sourceCards`, resets index |

### State (`quizState`)

| Field | Type | Description |
|---|---|---|
| `questions` | `Array<{ru, options, correctIdx}>` | Built once per session, reshuffled on restart |
| `index` | `number` | Current question index |
| `right` | `number` | Correct answer count |
| `sourceCards` | `Array` | Original cards passed to `startQuiz`, kept for restart |

### Entry points

- Home screen: `⊞` button per set → `startQuiz(set.cards, deps)`
- Done screen: "⊞ quiz" button → `startQuizFromSession()` in `app.js` using `app.session.queue`

### Wrong options

3 distractors are picked randomly from `app.sets.flatMap(s => s.cards)`, filtered to exclude the correct card's `en` value.

---

## match.js

Matching-pairs exercise. Two columns (Russian / English), tap one from each side — if they match they disappear, if not they shake.

### Exports

| Function | Signature | Description |
|---|---|---|
| `startMatch` | `(cards, { showScreen })` | Picks up to 6 random cards, renders grid, shows `#match-screen` |
| `tapMatch` | `(side, pairId)` | Handles tap on a match item; `side` is `'ru'` or `'en'` |
| `restartMatch` | `(deps)` | Restarts with same `sourceCards` |

### State (`matchState`)

| Field | Type | Description |
|---|---|---|
| `pairs` | `Array<{ru, en, id}>` | Up to 6 pairs for this round |
| `ruOrder` | `number[]` | Pair ids in left-column order |
| `enOrder` | `number[]` | Pair ids in right-column order, shuffled |
| `selectedRu` / `selectedEn` | `number \| null` | Currently selected pair id per side |
| `matched` | `Set<number>` | Pair ids already matched |
| `checking` | `boolean` | Locked during wrong-answer animation (600ms) |
| `sourceCards` | `Array` | Original cards kept for restart |

### Match check

A pair matches when `selectedRu === selectedEn` (both hold the same `pairId`). On mismatch: `.wrong` class triggers CSS shake animation, state clears after 600ms.

### Entry points

- Done screen: "⊟ match" button → `startMatchFromSession()` in `app.js` using `app.session.queue`

---

## table.js

Read-only table view of a set or mix. Supports reveal/hide of English column.

### Exports

| Function | Signature | Description |
|---|---|---|
| `showTableView` | `(setId, { showScreen })` | Shows table for a single set |
| `showMixTableView` | `({ showScreen })` | Shows table for all enabled+visible sets grouped |
| `getSetBreadcrumb` | `(set)` | Returns category string for a set, used by `study.js` |
