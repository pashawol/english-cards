# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

Requires a local HTTP server — `fetch()` won't work with `file://` protocol:

```bash
npx serve .
# or
python3 -m http.server 8080
```

No build step, no bundler, no package manager.

## Architecture

Vanilla HTML/CSS/JS, no framework. Three screens rendered inside one `index.html`, toggled by the `.active` class via `showScreen(id)`.

**Files:**
- `index.html` — markup only, three screen divs: `#home-screen`, `#study-screen`, `#done-screen`
- `styles.css` — all styles, light/dark via CSS custom properties on `[data-theme]`
- `app.js` — all logic: state, rendering, session flow, localStorage
- `data/manifest.json` — ordered list of JSON filenames to load
- `data/*.json` — one file per card set, format: `{ "name": "...", "cards": [{ "ru": "...", "en": "..." }] }`

**State flow:**
- On init: `loadSets()` (async, fetches manifest + all JSON) → `loadState()` (localStorage) → `renderHome()`
- Global `SETS` array is populated by `loadSets()`, ids assigned by index position in manifest
- Global `state` object persisted to `localStorage` key `ec_state`: daily goal, today count, streak, per-set progress
- Global `session` object is in-memory only: current queue, index, wrong cards, flip state

**Progress tracking (in `state.progress[setId]`):**
- `seen: number[]` — indices of cards the user has seen at least once
- `correct: number[]` — indices of cards marked correct
- Mix mode tracks progress back to the original set via `card._setId` / `card._cardIdx`

**Card queue logic in `startSet()`:**
1. Unseen cards first, then seen-but-wrong cards
2. If all cards seen → restart with all cards
3. Shuffled before each session

## Adding a new card set

1. Create `data/NN-topic-name.json`:
```json
{
  "name": "Название темы",
  "cards": [
    { "ru": "русский", "en": "english" }
  ]
}
```
2. Append the filename to `data/manifest.json` — order determines display order and assigned id.

## localStorage keys

| Key | Content |
|-----|---------|
| `ec_state` | JSON of the `state` object |
| `ec_theme` | `"light"` or `"dark"` |
