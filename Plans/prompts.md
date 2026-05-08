# Промпты и команды для запуска параллельных задач

Три параллельных задачи в отдельных git worktree:

1. **Sonnet** — код (`feat/examples-swipe`)
2. **Haiku batch A** — контент в файлах 01–19 (`feat/content-examples-a`)
3. **Haiku batch B** — контент в файлах 20–37 (`feat/content-examples-b`)

Конфликтов между ветками не будет: Sonnet трогает только код, Haiku — только данные, и батчи Haiku работают над разными файлами.

---

## Шаг 1. Создать worktree (выполнить ОДИН РАЗ в основном репо)

```bash
cd /Users/pawel/Documents/projects/english-cards

git worktree add ../english-cards-sonnet  -b feat/examples-swipe
git worktree add ../english-cards-haiku-a -b feat/content-examples-a
git worktree add ../english-cards-haiku-b -b feat/content-examples-b
```

Проверь:
```bash
git worktree list
```

---

## Шаг 2. Запустить три инстанса Claude в отдельных терминалах

### Терминал 1 — Sonnet (код)

```bash
cd ../english-cards-sonnet
claude
```

**Промпт (вставить целиком):**

> Прочитай файл `Plans/sonnet-code.md` в этом репо и выполни задачу полностью.
>
> Контекст:
> - это git worktree, текущая ветка `feat/examples-swipe`
> - параллельно (в других worktree) идёт задача наполнения `data/*.json` примерами — её выполняет другой агент, тебе их трогать не нужно
> - твоя зона ответственности: только `app.js`, `styles.css`, `index.html`
>
> Перед началом — прочитай также `CLAUDE.md` (особенно разделы про Study Screen UX и Fragile Areas) и текущую структуру `index.html` / `app.js` / `styles.css`.
>
> Когда план понятен — реализуй A (рендер примеров на обороте), B (свайп-жесты), C (стили). Для проверки рендера временно добавь `examples` в 1-2 карточки одного файла (например `data/07-verb-prep-1.json`) и **перед коммитом удали** эти временные данные.
>
> После реализации:
> 1. `node --check app.js`
> 2. запусти `npx serve .`, проверь все пункты чек-листа из плана (включая тёмную тему и mobile emulation)
> 3. сделай ОДИН коммит с сообщением `feat: add card examples on flip + swipe gestures`
>
> Если есть UX-неоднозначности — спрашивай, не выдумывай.

---

### Терминал 2 — Haiku batch A (файлы 01–19)

```bash
cd ../english-cards-haiku-a
claude --model haiku
```

> Если флаг `--model haiku` не сработает, попробуй `--model claude-haiku-4-5-20251001`.

**Промпт (вставить целиком):**

> Прочитай файл `Plans/haiku-content.md` в этом репо и выполни задачу для следующего батча файлов:
>
> ```
> data/01-article-a.json
> data/02-article-the.json
> data/03-article-zero.json
> data/04-adj-prep-1.json
> data/05-adj-prep-2.json
> data/06-adj-prep-3.json
> data/07-verb-prep-1.json
> data/08-verb-prep-2.json
> data/09-verb-prep-3.json
> data/10-noun-prep.json
> data/11-manner-prep-1.json
> data/12-manner-prep-2.json
> data/13-phrasal-1.json
> data/14-phrasal-2.json
> data/15-phrasal-3.json
> data/16-phrasal-4.json
> data/17-synonyms-verbs.json
> data/18-synonyms-adj.json
> data/19-word-formation-verb.json
> ```
>
> Контекст:
> - это git worktree, текущая ветка `feat/content-examples-a`
> - параллельно работают другие агенты: один над кодом (`app.js`/`styles.css`/`index.html`), другой над файлами 20–37; не трогай ничего за пределами своего батча
>
> Порядок:
> 1. Берёшь один файл, добавляешь `examples` к каждой карточке по правилам из плана
> 2. Валидируешь: `node -e "JSON.parse(require('fs').readFileSync('data/XX-...json'))"`
> 3. Если у карточки уже есть непустое `examples` — пропускаешь её
> 4. Коммитишь пачками по 5 файлов: `content: add examples (01-05)`, `content: add examples (06-10)`, и т.д.
>
> Особое внимание:
> - **Phrasal verbs (13-16)** — минимум один пример каждой карточки с разрывом конструкции дополнением (`<b>bring</b> him <b>up</b>`)
> - **Verb+prep (07-10)** — хотя бы один пример с дополнением между глаголом и предлогом
>
> НЕ менять поля `ru`, `en`, `name`, `category`, `categories`. Только добавить `examples` после `en` в каждой карточке.

---

### Терминал 3 — Haiku batch B (файлы 20–37)

```bash
cd ../english-cards-haiku-b
claude --model haiku
```

**Промпт (вставить целиком):**

> Прочитай файл `Plans/haiku-content.md` в этом репо и выполни задачу для следующего батча файлов:
>
> ```
> data/20-word-formation-adj.json
> data/21-irregular-verbs-1.json
> data/22-irregular-verbs-2.json
> data/23-irregular-verbs-3.json
> data/24-irregular-verbs-4.json
> data/25-singular-only-nouns.json
> data/26-singular-only-special.json
> data/27-plural-only-nouns.json
> data/28-plural-only-pairs.json
> data/29-same-form-nouns.json
> data/30-prep-time-at.json
> data/31-prep-time-in.json
> data/32-prep-time-on.json
> data/33-prep-time-other.json
> data/34-prep-place-at-in-on.json
> data/35-prep-place-other.json
> data/36-prep-movement.json
> data/37-prep-reason-manner.json
> ```
>
> Контекст:
> - это git worktree, текущая ветка `feat/content-examples-b`
> - параллельно работают другие агенты: один над кодом, другой над файлами 01–19; не трогай ничего за пределами своего батча
>
> Порядок:
> 1. Берёшь один файл, добавляешь `examples` к каждой карточке по правилам из плана
> 2. Валидируешь: `node -e "JSON.parse(require('fs').readFileSync('data/XX-...json'))"`
> 3. Если у карточки уже есть непустое `examples` — пропускаешь её
> 4. Коммитишь пачками по 5 файлов
>
> Особое внимание:
> - **Irregular verbs (21-24)** — РОВНО 3 примера на карточку, по одному с каждой формой (V1 / V2 / V3). Например для `see / saw / seen` — один пример с `see`, один с `saw`, один с `seen`. Все три формы — в `<b>` тегах в своих примерах.
> - **Time prepositions (30-33)** — подсветить связку `<b>at night</b>`, `<b>in 2026</b>`, `<b>on Monday</b>` целиком.
> - **Place / Movement prepositions (34-37)** — аналогично, подсвечивать связку `prep + noun` целиком.
>
> НЕ менять поля `ru`, `en`, `name`, `category`, `categories`. Только добавить `examples` после `en` в каждой карточке.

---

## Шаг 3. Когда все три задачи завершены — мердж в `main`

```bash
cd /Users/pawel/Documents/projects/english-cards

# убедись, что находишься на main и working tree чистый
git status
git checkout main

# мерджим
git merge feat/examples-swipe
git merge feat/content-examples-a
git merge feat/content-examples-b
```

Конфликтов быть не должно (разные файлы). Если что-то — `git status`, `git mergetool`.

### Финальная проверка после мерджа

```bash
node --check app.js

# валидность всех JSON
for f in data/*.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f'))" || echo "BROKEN: $f"
done

# смоук-тест в браузере
npx serve .
```

### Уборка worktree

```bash
git worktree remove ../english-cards-sonnet
git worktree remove ../english-cards-haiku-a
git worktree remove ../english-cards-haiku-b

# опционально — удалить ветки, если уже не нужны
git branch -d feat/examples-swipe feat/content-examples-a feat/content-examples-b
```

---

## Что делать, если…

- **Sonnet закончит раньше Haiku** — это норма, на main можно мерджить в любом порядке.
- **Haiku пишет странные примеры** — останови, обнови `Plans/haiku-content.md` (добавь правило/уточнение), скажи Haiku перечитать план и продолжить.
- **Один из батчей Haiku отстаёт** — можно домерджить остальные ветки на main и доделать оставшийся батч позже.
- **Sonnet хочет тестировать с реальными примерами** — он добавит временные `examples` в 1-2 карточки и удалит перед коммитом. Это не пересечётся с работой Haiku, потому что работа идёт в разных worktree (разные рабочие копии файла).
