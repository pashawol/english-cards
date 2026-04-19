# CLAUDE.md

This file is the working guide for any coding agent entering this repository.

Read this before changing layout, study flow, reminders, or data structure.

## Project Summary

`english-cards` is a small vanilla web app for repeating English cards.

It is intentionally simple:
- no framework
- no build step
- no package manager
- no backend
- all runtime state is in browser memory or `localStorage`

The app is mobile-first and heavily tuned for one-hand usage on phones.
Many recent UI decisions were made specifically for iPhone/Safari ergonomics.

## Run Locally

Use a local HTTP server. `fetch()` will not work from `file://`.

```bash
npx serve .
# or
python3 -m http.server 8080
```

There is no test suite. The minimum safe verification after JS edits is:

```bash
node --check app.js
```

## File Map

- `index.html` — all markup for the app
- `styles.css` — all styles and animations
- `app.js` — all application logic
- `manifest.json` — PWA manifest
- `version.js` — app version label shown in header
- `data/manifest.json` — ordered list of card-set JSON files
- `data/*.json` — individual card-set data files

## App Structure

The app uses three screens inside one HTML file:

- `#home-screen`
- `#study-screen`
- `#done-screen`

Visibility is controlled by `showScreen(id)` via the `.active` class.

There is no router.

## Architecture

### HTML

`index.html` contains:

- compact header with app name, version, and theme toggle
- home screen with:
  - daily progress card
  - daily goal slider
  - reminder controls
  - list of sets
  - fixed bottom action area with circular mix button and category filters
- study screen with:
  - compact top bar
  - progress bar
  - mascot
  - flip card
  - back-in-session button
  - bottom answer actions
- done screen with:
  - stats
  - mascot
  - celebration burst

### CSS

`styles.css` is the only stylesheet.

Important traits:

- light/dark theme via CSS custom properties on `[data-theme]`
- mobile-first sizing
- bottom-fixed controls on home
- lower-screen interaction zones on study
- card swap animation and mascot animation live here

### JavaScript

`app.js` owns everything:

- loading set JSON
- localStorage state
- rendering home
- study session flow
- answer history and recompute
- theme switching
- reminder logic
- mascot text and reactions

There is no component system. Most updates are direct DOM writes.

## Data Model

### Card sets

Files in `data/*.json` look like:

```json
{
  "name": "Название темы",
  "cards": [
    { "ru": "русский", "en": "english" }
  ]
}
```

Some sets also use categories in loaded data. The app normalizes both:

- `categories: string[]`
- `category: string`

via `normalizeCategories(set)`.

### Set ordering

`data/manifest.json` controls display order.

Set ids are assigned by load order:

- first file in manifest => `id = 1`
- second => `id = 2`
- etc.

Do not reorder manifest casually unless you accept changed ids and progress mapping.

## Runtime State

### Persistent state

Stored in `localStorage` key `ec_state`.

Current main fields:

- `dailyGoal`
- `todayCount`
- `streak`
- `lastDate`
- `progress`
- `enabledSets`
- `homeCategoryFilter`
- `reminderEnabled`
- `reminderTime`
- `reminderLastSentOn`

Theme is stored separately in `ec_theme`.

### Session state

`session` is in-memory only.

Important fields:

- `setId`
- `queue`
- `index`
- `wrong`
- `right`
- `flipped`
- `answers`
- `baseTodayCount`
- `initialProgress`
- `transitioning`

The app now uses answer-history replay instead of increment-only counters.
That matters for back navigation inside a study session.

## Session / Progress Logic

### Queue building

`startSet(setId)` currently builds queue like this:

1. unseen cards first
2. seen but incorrect cards next
3. if nothing fits, restart with all cards
4. shuffle before session starts

`startMix()` builds a cross-set queue from currently enabled and visible sets.

### Progress storage

Per-set progress lives in:

`state.progress[setId] = { seen: number[], correct: number[] }`

Mix mode maps each mixed card back to its original set via:

- `card._setId`
- `card._cardIdx`

### Back navigation in study mode

The `← назад` button is session-local.

It only navigates to already opened cards.

Important implementation detail:

- answers are stored in `session.answers`
- `recomputeSessionState()` rebuilds `state.progress`, `session.right`, `session.wrong`, and `state.todayCount`
- this avoids double counting when user goes back and changes a previous answer

Do not replace this with naive increment/decrement logic unless you re-verify all edge cases.

## Home Screen UX Rules

The current home layout is intentionally compact.

### Fixed bottom action area

`home-actions` is `position: fixed`, not `sticky`.

Reason:
- `sticky` caused bad behavior during filtering
- fixed positioning keeps filters and mix launch stable

Because of that, `#home-screen.active` has bottom padding so content is not hidden behind the fixed block.

If you change height of the bottom area, you must also adjust home bottom padding.

### Scroll behavior

The app intentionally uses page-level vertical scrolling on home instead of an inner scroll container.

Reason:
- mobile Safari / Chrome behavior is better with real page scroll
- pull-down browser behavior feels more native

Do not reintroduce `overflow-y: auto` on `#home-screen.active` unless you explicitly want inner scrolling again.

### Mix launch button

The main launch CTA is now a circular floating action button:

- compact
- fixed low on the screen
- minimal text

Current supporting text about the mix source stays below category filters in `#mix-sub`.

### Filters

Category filters support multi-select.

Rules:

- tap adds category
- tap again removes category
- no selected categories means “show all”

This behavior replaced the earlier explicit `all` filter chip.

### Reminder control

Reminder UI is intentionally compact.

It is not a robust background push system.

Current logic:

- uses `Notification`
- uses in-page timer logic
- no service worker
- no Push API

Mobile nuance:

- in mobile browser tab context, reminder is intentionally treated as unavailable
- the UI hints that reminder works after install to Home Screen / app-like context

This was done because plain mobile browser tabs are not reliable for background reminder behavior.

If you implement proper push later, revisit this section and the reminder UI.

## Study Screen UX Rules

Study mode is optimized for one-hand use.

Preserve that unless asked otherwise.

### Layout intent

- informational header stays small
- mascot sits above card
- card is visually lowered on screen
- answer buttons are in bottom zone

### Flip behavior

Tapping the card flips it.

Answer buttons no longer force a flip first.
Current behavior:

- `знал / не знал` immediately records answer
- card transitions to the next item with a visible swap animation

This was changed on purpose because the previous behavior felt too slow.

### Card transition

There are now two distinct motion systems:

- flip/reveal motion for front/back of the same card
- swap motion for moving to the next card after answering

Do not merge them casually; they solve different UX problems.

### Mascot

Mascot is now more than decoration.

It has:

- staged text pools
- ambient timed messages
- reaction moods such as `reveal`, `cheer`, `nudge`, `wonder`, `blink`
- done-screen celebration state

Relevant logic is in `app.js`.
Relevant animation is in `styles.css`.

If you add mascot behavior, prefer adding:

- new line pools
- new moods
- small reaction hooks

instead of hardcoding repetitive single messages.

## Done Screen

Done screen now includes:

- summary stats
- mascot block
- celebration burst animation

Keep it lightweight. It should feel rewarding but fast.

## Theme

Theme is toggled by `toggleTheme()` and stored in `localStorage`.

When changing theme-related colors:

- update CSS variables instead of scattering hardcoded values
- verify both light and dark theme
- verify button contrast, especially in dark mode

Dark-mode contrast was a real issue in earlier iterations.

## Notifications / Reminder Limitations

This is important.

Current reminders are not true web push notifications.

The project does not currently have:

- a service worker
- `PushManager`
- push subscription flow
- a backend for sending pushes

What exists now is closer to a local reminder while app/page is active.

On iOS/iPadOS, real Web Push is supported for Home Screen web apps, not ordinary tabs:
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

If an agent is asked to “fix reminders”, first determine whether the user wants:

1. better local in-page reminders
2. real push notifications

Those are different implementations.

## Adding New Sets

To add a new card set:

1. create a new file in `data/`
2. keep the existing shape:

```json
{
  "name": "Название темы",
  "cards": [
    { "ru": "русский", "en": "english" }
  ]
}
```

3. append the filename to `data/manifest.json`

If you want category filters to work well, include category metadata in a consistent form.

## Implementation Style Guidelines For Agents

When changing this repo:

- prefer simple direct DOM updates over abstraction
- preserve the no-build vanilla structure
- avoid introducing frameworks or tooling
- keep mobile-first ergonomics
- keep the UI compact
- verify dark theme if you touch controls
- verify iPhone-sized layouts if you touch typography or bottom actions

Prefer incremental changes. This project evolves quickly and the user often iterates visually.

## Fragile / Easy-To-Break Areas

Be careful in these areas:

### 1. `showScreen()` and screen sizing

There were multiple rounds of fixes around:

- page scroll vs inner scroll
- fixed bottom home controls
- full-height study screen

If you touch screen overflow or viewport sizing, verify:

- home scroll
- browser pull-down behavior
- no hidden content under fixed controls
- no accidental extra scroll in study mode

### 2. Reminder UI vs actual capability

The UI has already been simplified several times.

If you change reminder copy, keep it honest about capability.

### 3. Session backtracking

Any change to answer recording must be checked with:

- answer a card
- go back
- change answer
- finish session
- verify `todayCount`, wrong list, and progress remain correct

### 4. Manifest order

Reordering `data/manifest.json` changes set ids and can break saved progress mapping.

### 5. Footer and bottom overlays

Bottom overlays, footer visibility, and home padding interact.

Check low-height phones after layout changes.

## Future Roadmap Notes

These are not implemented yet, but the project is likely heading here.

### 1. Login / account support

If login is added later, likely consequences:

- local-only `state` will need sync strategy
- `progress`, `streak`, and enabled sets should become user-scoped
- migration path from existing `localStorage` data will matter

Recommended future direction:

- keep a thin client state layer
- isolate persistence behind helper functions before adding remote auth

### 2. User-created card sets

Likely future need:

- upload or create custom sets
- persist them separately from bundled `data/*.json`

Recommended future direction:

- distinguish built-in sets from user sets
- avoid assuming all sets come from static manifest
- introduce a normalized set shape early

### 3. Folder / hierarchy navigation

The app currently assumes a flat list of sets.

If folders are added later, likely changes are needed in:

- data format
- home render
- mix selection logic
- category filtering

Recommended future direction:

- introduce a tree or grouped structure separately from individual set ids
- keep per-card progress keyed to stable set ids, not folder position

### 4. Real push notifications

If this is built later, expect:

- service worker
- push subscription storage
- backend delivery
- explicit separation between installed-PWA support and plain browser tab behavior

## Suggested First Read For A New Agent

If you just entered the repo, read in this order:

1. `CLAUDE.md`
2. `index.html`
3. `app.js`
4. `styles.css`
5. `data/manifest.json`

Then inspect the exact area you plan to change.

## Current Mental Model

This app is not a generic flashcard platform yet.

Right now it is:

- a fast personal repetition tool
- local-first
- single-user
- static-data-based
- mobile-optimized

When making changes, preserve that simplicity unless the task explicitly asks for a structural expansion.
