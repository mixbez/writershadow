# WriterShadow

**English version below** | [Русская версия ниже](#writershadow-русская-версия)

---

## WriterShadow (English)

A Telegram bot for writers: helps manage drafts, combine them into posts, and publish to a channel. Supports AI assistance (Claude / Groq), writing reminders, and statistics.

### Contents

- [What the bot does](#what-the-bot-does)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Database](#database)
- [Bot commands](#bot-commands)
- [AI integration](#ai-integration)
- [Subscription system](#subscription-system)
- [Security](#security)
- [Environment variables](#environment-variables)
- [Running](#running)
- [Tests](#tests)
- [Deployment and releases](#deployment-and-releases)

---

### What the bot does

WriterShadow solves a core problem for authors — the gap between when an idea appears and when a post gets published.

**Workflow:**

1. The writer saves short drafts — thoughts, sketches, quotes — using `/new`
2. When enough drafts accumulate, `/combine` assembles them into a post
3. AI (optional) generates connective text between fragments
4. `/post` publishes the finished text directly to a Telegram channel or schedules it for a specific time
5. Daily reminders and weekly statistics help maintain writing momentum

---

### Architecture

```
Telegram ──webhook──► Fastify (HTTP) ──► Telegraf (bot)
                                              │
                          ┌───────────────────┼───────────────────┐
                          ▼                   ▼                   ▼
                    PostgreSQL             Redis              AI Provider
                    (data)                (sessions)         (Claude / Groq)
```

**Stack:**

| Layer | Technology |
|---|---|
| Runtime | Node.js 20, ES modules |
| Bot framework | Telegraf 4.16 |
| HTTP server | Fastify 4.28 |
| Database | PostgreSQL 16 |
| Cache / Sessions | Redis 7 |
| AI | Anthropic SDK (Claude) + Groq SDK |
| Scheduler | node-cron 3.0 |
| Encryption | Node.js crypto (AES-256-GCM) |
| Deployment | Docker + docker-compose |

---

### Project structure

```
writershadow/
├── src/
│   ├── index.js                    # Entry point: Fastify + webhook + scheduler
│   ├── bot/
│   │   ├── index.js                # Command registration and middleware
│   │   ├── commands/               # Command handlers (one file per command)
│   │   │   ├── start.js            # /start — initial setup, configure channel
│   │   │   ├── new.js              # /new — create draft
│   │   │   ├── drafts.js           # /drafts — list drafts
│   │   │   ├── draftsFull.js       # /drafts_full — show full draft text
│   │   │   ├── combine.js          # /combine — assemble post from drafts
│   │   │   ├── post.js             # /post — publish or schedule
│   │   │   ├── delete.js           # /delete — remove drafts
│   │   │   ├── setai.js            # /setai — choose AI provider
│   │   │   ├── suggest.js          # /suggest — idea for next post (Pro)
│   │   │   ├── settings.js         # /settings — reminders and timezone
│   │   │   ├── stats.js            # /stats — writing statistics
│   │   │   ├── admin.js            # /admin — manage subscriptions
│   │   │   └── info.js             # /info — bot guide
│   │   ├── handlers/
│   │   │   ├── draftMessage.js     # Handle text without command (→ draft)
│   │   │   └── callbackQuery.js    # Handle inline button presses
│   │   └── middleware/
│   │       ├── session.js          # Redis sessions (7-day TTL)
│   │       ├── requireAdmin.js     # Check admin rights
│   │       └── requireSetup.js     # Check channel setup
│   ├── db/
│   │   ├── index.js                # PostgreSQL connection pool
│   │   ├── migrate.js              # Run migrations on startup
│   │   ├── models/
│   │   │   ├── user.js             # User CRUD
│   │   │   ├── draft.js            # Draft CRUD
│   │   │   ├── post.js             # Post CRUD
│   │   │   ├── dailyStats.js       # Daily statistics
│   │   │   └── commandLog.js       # Command audit log
│   │   └── migrations/             # SQL migrations (1…7, additive only)
│   ├── ai/
│   │   ├── provider.js             # Router: select provider
│   │   ├── anthropic.js            # Anthropic SDK wrapper
│   │   ├── groq.js                 # Groq SDK wrapper
│   │   ├── sanitize.js             # Prompt injection defense
│   │   └── prompt.js               # Prompt templates
│   ├── redis/
│   │   └── client.js               # Redis connection
│   ├── scheduler/
│   │   └── reminders.js            # Cron tasks (reminders, publications)
│   ├── api/
│   │   └── analytics.js            # REST endpoints for analytics
│   ├── crypto/
│   │   └── keys.js                 # Encrypt/decrypt API keys
│   └── utils/
│       ├── tags.js                 # Parse and strip tags (## tagname)
│       ├── splitText.js            # Split long texts into parts
│       └── timezone.js             # Convert local time to UTC
├── tests/                          # Jest tests
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── SECURITY.md
└── CLAUDE.md
```

---

### Database

#### `users`

One user = one row. Stores all settings.

| Field | Description |
|---|---|
| `telegram_id` | Unique user ID in Telegram |
| `channel_id` | Channel ID for publishing posts |
| `draft_group_id` | Group ID for storing drafts (optional) |
| `reminder_time` | Reminder time (`HH:MM`) |
| `timezone` | Timezone (e.g., `Europe/Moscow`) |
| `evening_nudge` | Is evening reminder enabled |
| `ai_provider` | Provider: `none` / `groq` / `anthropic` / `paid` |
| `encrypted_api_key` | Encrypted AES-256-GCM user key |
| `subscription_status` | `trial` / `active` / `expired` |
| `demo_expires_at` | Trial period expiration date |
| `ai_tags_enabled` | Auto-generate tags (Pro) |
| `bridge_enabled` | AI-merge drafts on combine (Pro) |
| `channel_member_count` | Subscriber count (cached from Telegram) |
| `channel_member_count_updated_at` | When subscriber count was last fetched |
| `promote_enabled` | Whether author is visible in the promote pool |

#### `drafts`

Text fragments saved by user.

| Field | Description |
|---|---|
| `user_id` | FK → users |
| `post_id` | FK → posts (if draft is part of post) |
| `content` | Draft text (including tags `## tagname`) |
| `char_count` | Character count |
| `used` | Flag: used in post |
| `created_at` | Creation time |

#### `posts`

Finished posts (published or scheduled).

| Field | Description |
|---|---|
| `user_id` | FK → users |
| `content` | Final post text |
| `status` | `draft` / `published` / `imported` / `scheduled` |
| `channel_message_id` | Message ID in channel (after publishing) |
| `scheduled_at` | Scheduled publication time (UTC) |
| `published_at` | Actual publication time |

#### `daily_stats`

Aggregated statistics per user per day.

| Field | Description |
|---|---|
| `user_id` | FK → users |
| `date` | Date (`YYYY-MM-DD`) |
| `chars_written` | Characters written per day |
| `drafts_created` | Drafts created |
| `posts_published` | Posts published |

#### `command_logs`

Audit of all command calls.

| Field | Description |
|---|---|
| `user_id` | FK → users |
| `command` | Command name |
| `success` | Success / error |
| `error_message` | Error text (if any) |
| `data` | Additional data as JSON |

---

### Bot commands

#### Core workflow

##### `/start`
Initial setup. Bot asks for channel ID or username. After saving, user gets access to all commands.

##### `/new [text]`
Create a draft.
- If text is provided — saves immediately
- If no text — bot waits for next message
- Any text message without a command also becomes a draft
- Pro: if `ai_tags_enabled` is on, AI auto-adds tags (`## tagname`)

##### `/drafts [tag]`
List drafts with dates and character counts. Can filter by tag: `/drafts travel`.

##### `/drafts_full [tag]`
Same as above, but shows full text of each draft.

##### `/combine`
Interactive post assembler:
1. Bot shows drafts with buttons — user selects needed ones
2. Drafts are concatenated in selection order
3. Pro (`bridge_enabled`): AI receives all selected drafts at once and produces a single cohesive text, preserving the author's style. May reorder fragments and remove duplicate ideas.
4. Shows preview; can save as post or cancel

##### `/post`
Publish or schedule. If there's a finished post:
- **Now** — sends immediately
- **Schedule** — asks for date and time (in user's timezone)

After publishing, bot asks: delete used drafts or keep them.

Long texts (>4096 chars) auto-split into parts.

##### `/delete [all]`
Delete drafts.
- `/delete` — select specific ones via buttons
- `/delete all` — delete all at once

#### AI and settings

##### `/setai`
Choose AI provider:
- **Groq** — free, shared key, LLaMA 3.3-70B model
- **Anthropic** — user provides own API key (encrypted storage)
- **Pro** — bot owner's key, full feature set

##### `/suggest` *(Pro)*
Generate next post idea based on last 15 published. Requires minimum 3 posts in history. Returns topic and angle (max 150 words).

##### `/ask` *(Pro)*
AI acts as a curious reader who knows the author's topics but not the details. Returns 3–5 questions in the author's language to inspire deeper exploration of existing material.

##### `/settings`
Configure reminders:
- Daily reminder time
- Timezone
- Enable / disable evening reminder (if no writing that day)

##### `/stats`
Statistics: characters, drafts, and posts for today, week, and month. Shows trend (up / down). Also shows current subscriber count for the author's channel (fetched from Telegram on each call).

#### Administrative

##### `/promote`
Opt in to a mutual promotion pool:
- Enables visibility of the author's `@username` to other users
- Shows up to 3 authors in the pool with the closest subscriber count
- `/promote off` — opt out and become hidden

##### `/admin`
Owner only (by `ADMIN_USER_ID`):
- Grant / revoke Pro subscription
- View aggregated stats for all users

##### `/info`
Detailed guide for all commands in the bot.

---

### AI integration

#### Three usage scenarios

```
ai_provider = 'groq'       → Groq API (free, shared key)
ai_provider = 'anthropic'  → Anthropic API (user's key, decrypted)
ai_provider = 'paid'       → Anthropic API (owner's key, Pro mode)
```

#### Generated content

| Function | Input | Output |
|---|---|---|
| `generateSuggestion` | Up to 15 published posts | Next topic idea (≤150 words) |
| `generateTags` | Draft text | 1–3 comma-separated tags |
| `generateCombine` | All selected drafts | Single cohesive text in author's style |
| `generateAsk` | Up to 15 published posts | 3–5 reader questions |

#### Prompt injection defense (`src/ai/sanitize.js`)

Before sending to AI, all user text is checked for attack patterns:
- `ignore instructions`, `you are now`, `forget everything`
- `act as`, `pretend`, `jailbreak`, `DAN mode`

Additionally:
- XML entity escaping (`&`, `<`, `>`)
- Text truncation (max 500–800 chars per request)

---

### Subscription system

| Tier | Condition | AI features |
|---|---|---|
| **Free** | Default | None (drafts and publishing only) |
| **Trial** | First 14 days | Groq for `/suggest` |
| **Pro** | `subscription_status = 'active'` | Full access: auto-tags, bridges, `/suggest` with Claude |

Subscriptions granted manually via `/admin`. Expired subscriptions revoked automatically hourly (cron).

---

### Security

#### API key encryption

User keys are encrypted before storage in DB:

```
AES-256-GCM(plaintext, key=ENCRYPTION_KEY, iv=random_16_bytes)
→ "iv_hex:authTag_hex:ciphertext_hex"
```

`ENCRYPTION_KEY` — 64 hex characters (32 bytes), set in `.env`.

#### Authorization

- **Admin middleware** (`requireAdmin.js`): compares `ctx.from.id` with `ADMIN_USER_ID` from env. Non-admins silently ignored.
- **Setup middleware** (`requireSetup.js`): most commands unavailable until user completes initial setup via `/start`.

#### SQL

All queries use parameterization (`$1, $2, ...`). No string concatenation in SQL.

#### Migrations

All migrations are additive (only `ADD COLUMN`, `CREATE TABLE`). Destructive schema changes forbidden — allows safe rollback to previous image version without data loss.

---

### Environment variables

See `.env.example`.

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | yes | Telegram bot token |
| `BOT_WEBHOOK_URL` | yes | Webhook URL (prod) |
| `PORT` | no | Fastify port (default `3001`) |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `REDIS_URL` | yes | Redis connection URL |
| `ENCRYPTION_KEY` | yes | 64 hex chars for AES-256-GCM |
| `ADMIN_USER_ID` | yes | Admin's Telegram ID |
| `OWNER_CONTACT` | yes | Contact for subscription signup |
| `ANTHROPIC_API_KEY` | no | Claude key (for Pro users) |
| `GROQ_API_KEY` | no | Groq key (shared, optional) |
| `NODE_ENV` | no | `production` / `development` |

---

### Running

#### Development (polling)

```bash
cp .env.example .env
# fill in .env

npm install
npm run dev    # polling mode, no webhook needed
```

#### Production (Docker)

```bash
cp .env.example .env
# fill in .env, including BOT_WEBHOOK_URL

docker compose up -d
```

Container startup automatically applies all pending migrations.

---

### Tests

```bash
npm test                            # all tests
npm run test:coverage               # with coverage report
npx jest tests/crypto.test.js       # single file
```

Tests in `tests/`. Uses Jest with `--experimental-vm-modules` for ES module support.

**Coverage priority:**

| Module | Why critical |
|---|---|
| `src/crypto/keys.js` | Key loss = can't decrypt user data |
| `src/ai/sanitize.js` | Error = prompt injection bypass |
| `src/bot/middleware/requireAdmin.js` | Error = anyone becomes admin |
| `src/bot/middleware/requireSetup.js` | Error = access without setup |
| `src/db/models/user.js` | Incorrect user data handling |

---

### Deployment and releases

#### Branches

```
feature/name  →  dev  →  master (production)
```

Never push directly to `master`.

#### Release

```bash
# 1. Check tests pass
npm test

# 2. Merge dev into master and tag
git checkout master
git merge dev
git tag v1.x.x
git push origin master
git push origin v1.x.x

# 3. Build image
docker build -t writershadow:v1.x.x .

# 4. Apply migrations
node src/db/migrate.js

# 5. Deploy
VERSION=v1.x.x docker compose up -d

# 6. Check logs
docker logs writershadow-app --tail=50
```

#### Rollback

```bash
VERSION=v1.x-1 docker compose up -d
```

Previous version image must be built in advance.

#### CI

GitHub Actions runs `npm test` and `npm audit` on every push and PR to `master`/`dev`.
Config: `.github/workflows/ci.yml`.

---

---

# WriterShadow (Русская версия)

Telegram-бот для авторов: помогает вести черновики, собирать из них посты и публиковать в канал. Поддерживает AI-помощника (Claude / Groq), напоминания о написании текстов и статистику.

## Содержание

- [Что делает бот](#что-делает-бот)
- [Архитектура](#архитектура)
- [Структура проекта](#структура-проекта)
- [База данных](#база-данных)
- [Команды бота](#команды-бота)
- [AI-интеграция](#ai-интеграция)
- [Система подписок](#система-подписок)
- [Безопасность](#безопасность)
- [Переменные окружения](#переменные-окружения)
- [Запуск](#запуск)
- [Тесты](#тесты)
- [Деплой и релизы](#деплой-и-релизы)

---

## Что делает бот

WriterShadow решает главную проблему авторов — разрыв между моментом, когда появилась мысль, и моментом публикации поста.

**Рабочий процесс:**

1. Автор сохраняет короткие черновики — мысли, наброски, цитаты — командой `/new`
2. Когда черновиков накопилось достаточно, `/combine` собирает из них пост
3. AI (опционально) генерирует связующий текст между фрагментами
4. `/post` публикует готовый текст напрямую в Telegram-канал или планирует публикацию на конкретное время
5. Ежедневные напоминания и еженедельная статистика помогают не терять темп

---

## Архитектура

```
Telegram ──webhook──► Fastify (HTTP) ──► Telegraf (bot)
                                              │
                          ┌───────────────────┼───────────────────┐
                          ▼                   ▼                   ▼
                    PostgreSQL             Redis              AI Provider
                    (данные)           (сессии)         (Claude / Groq)
```

**Стек:**

| Слой | Технология |
|---|---|
| Runtime | Node.js 20, ES modules |
| Bot framework | Telegraf 4.16 |
| HTTP server | Fastify 4.28 |
| База данных | PostgreSQL 16 |
| Кэш / сессии | Redis 7 |
| AI | Anthropic SDK (Claude) + Groq SDK |
| Планировщик | node-cron 3.0 |
| Шифрование | Node.js crypto (AES-256-GCM) |
| Деплой | Docker + docker-compose |

---

## Структура проекта

```
writershadow/
├── src/
│   ├── index.js                    # Точка входа: Fastify + webhook + scheduler
│   ├── bot/
│   │   ├── index.js                # Регистрация команд и middleware
│   │   ├── commands/               # Обработчики команд (по одному файлу на команду)
│   │   │   ├── start.js            # /start — первый запуск, настройка канала
│   │   │   ├── new.js              # /new — создать черновик
│   │   │   ├── drafts.js           # /drafts — список черновиков
│   │   │   ├── draftsFull.js       # /drafts_full — полный текст черновиков
│   │   │   ├── combine.js          # /combine — собрать пост из черновиков
│   │   │   ├── post.js             # /post — опубликовать или запланировать
│   │   │   ├── delete.js           # /delete — удалить черновики
│   │   │   ├── setai.js            # /setai — выбор AI-провайдера
│   │   │   ├── suggest.js          # /suggest — идея для следующего поста (Pro)
│   │   │   ├── settings.js         # /settings — напоминания и таймзона
│   │   │   ├── stats.js            # /stats — статистика написанного
│   │   │   ├── admin.js            # /admin — управление подписками
│   │   │   └── info.js             # /info — справка по боту
│   │   ├── handlers/
│   │   │   ├── draftMessage.js     # Обработка текста без команды (→ черновик)
│   │   │   └── callbackQuery.js    # Обработка нажатий inline-кнопок
│   │   └── middleware/
│   │       ├── session.js          # Redis-сессии (TTL 7 дней)
│   │       ├── requireAdmin.js     # Проверка прав администратора
│   │       └── requireSetup.js     # Проверка настройки канала
│   ├── db/
│   │   ├── index.js                # Пул соединений PostgreSQL
│   │   ├── migrate.js              # Запуск миграций при старте
│   │   ├── models/
│   │   │   ├── user.js             # CRUD пользователей
│   │   │   ├── draft.js            # CRUD черновиков
│   │   │   ├── post.js             # CRUD постов
│   │   │   ├── dailyStats.js       # Ежедневная статистика
│   │   │   └── commandLog.js       # Лог команд (аудит)
│   │   └── migrations/             # SQL-миграции (1…7, аддитивные)
│   ├── ai/
│   │   ├── provider.js             # Роутинг: выбор нужного провайдера
│   │   ├── anthropic.js            # Обёртка над Anthropic SDK
│   │   ├── groq.js                 # Обёртка над Groq SDK
│   │   ├── sanitize.js             # Защита от prompt injection
│   │   └── prompt.js               # Шаблоны промптов
│   ├── redis/
│   │   └── client.js               # Подключение к Redis
│   ├── scheduler/
│   │   └── reminders.js            # Cron-задачи (напоминания, публикации)
│   ├── api/
│   │   └── analytics.js            # REST-эндпоинты для аналитики
│   ├── crypto/
│   │   └── keys.js                 # Шифрование/дешифрование API-ключей
│   └── utils/
│       ├── tags.js                 # Парсинг и удаление тегов (## tagname)
│       ├── splitText.js            # Разбивка длинных текстов на части
│       └── timezone.js             # Конвертация локального времени в UTC
├── tests/                          # Jest-тесты
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── SECURITY.md
└── CLAUDE.md
```

---

## База данных

### `users`

Один пользователь = одна строка. Хранит все настройки.

| Поле | Описание |
|---|---|
| `telegram_id` | Уникальный ID пользователя в Telegram |
| `channel_id` | ID канала для публикации постов |
| `draft_group_id` | ID группы для хранения черновиков (опционально) |
| `reminder_time` | Время напоминания (`HH:MM`) |
| `timezone` | Часовой пояс (например `Europe/Moscow`) |
| `evening_nudge` | Включён ли вечерний напоминатель |
| `ai_provider` | Провайдер: `none` / `groq` / `anthropic` / `paid` |
| `encrypted_api_key` | Зашифрованный AES-256-GCM ключ пользователя |
| `subscription_status` | `trial` / `active` / `expired` |
| `demo_expires_at` | Дата окончания пробного периода |
| `ai_tags_enabled` | Автоматическая генерация тегов (Pro) |
| `bridge_enabled` | AI-объединение черновиков при combine (Pro) |
| `channel_member_count` | Число подписчиков канала (кэш из Telegram) |
| `channel_member_count_updated_at` | Когда последний раз обновлялся счётчик |
| `promote_enabled` | Виден ли автор в пуле взаимопиара |

### `drafts`

Текстовые фрагменты, сохранённые пользователем.

| Поле | Описание |
|---|---|
| `user_id` | FK → users |
| `post_id` | FK → posts (если черновик уже в составе поста) |
| `content` | Текст черновика (включая теги `## tagname`) |
| `char_count` | Количество символов |
| `used` | Флаг: использован в посте |
| `created_at` | Время создания |

### `posts`

Готовые посты (опубликованные или запланированные).

| Поле | Описание |
|---|---|
| `user_id` | FK → users |
| `content` | Итоговый текст поста |
| `status` | `draft` / `published` / `imported` / `scheduled` |
| `channel_message_id` | ID сообщения в канале (после публикации) |
| `scheduled_at` | Запланированное время публикации (UTC) |
| `published_at` | Фактическое время публикации |

### `daily_stats`

Агрегированная статистика за каждый день.

| Поле | Описание |
|---|---|
| `user_id` | FK → users |
| `date` | Дата (`YYYY-MM-DD`) |
| `chars_written` | Символов написано за день |
| `drafts_created` | Черновиков создано |
| `posts_published` | Постов опубликовано |

### `command_logs`

Аудит всех вызовов команд.

| Поле | Описание |
|---|---|
| `user_id` | FK → users |
| `command` | Название команды |
| `success` | Успешно / с ошибкой |
| `error_message` | Текст ошибки (если есть) |
| `data` | JSON с дополнительными данными |

---

## Команды бота

### Основной рабочий процесс

#### `/start`
Первый запуск. Бот просит прислать ID или username канала. После сохранения пользователь получает доступ ко всем командам.

#### `/new [текст]`
Создать черновик.
- Если текст передан сразу — сохраняется мгновенно
- Если без текста — бот ждёт следующего сообщения
- Любое текстовое сообщение без команды тоже становится черновиком
- Pro: если включена `ai_tags_enabled`, AI автоматически добавляет теги (`## tagname`)

#### `/drafts [тег]`
Список черновиков с датами и количеством символов. Можно фильтровать по тегу: `/drafts путешествия`.

#### `/drafts_full [тег]`
То же, но показывает полный текст каждого черновика.

#### `/combine`
Интерактивный сборщик поста:
1. Бот показывает черновики с кнопками — пользователь выбирает нужные
2. Черновики объединяются в порядке выбора
3. Pro (`bridge_enabled`): AI получает все выбранные черновики сразу и создаёт единый связный текст, сохраняя авторский стиль. Может менять порядок фрагментов и убирать дублирующиеся мысли.
4. Показывается превью; можно сохранить как пост или отменить

#### `/post`
Публикация или планирование. Если есть готовый пост:
- **Сейчас** — отправляет немедленно
- **Запланировать** — просит дату и время (в часовом поясе пользователя)

После публикации бот спрашивает: удалить использованные черновики или оставить.

Длинные тексты (>4096 символов) разбиваются на части автоматически.

#### `/delete [all]`
Удаление черновиков.
- `/delete` — выбор конкретных через кнопки
- `/delete all` — удалить все сразу

### AI и настройки

#### `/setai`
Выбор AI-провайдера:
- **Groq** — бесплатно, используется общий ключ, модель LLaMA 3.3-70B
- **Anthropic** — пользователь вводит свой API-ключ (хранится в зашифрованном виде)
- **Pro** — ключ владельца бота, полный набор функций

#### `/suggest` *(Pro)*
Генерирует идею для следующего поста на основе последних 15 опубликованных. Требует минимум 3 поста в истории. Возвращает тему и угол подачи (до 150 слов).

#### `/ask` *(Pro)*
AI ведёт себя как любопытный читатель, который знаком с темами автора, но знает меньше деталей. Возвращает 3–5 вопросов на языке автора, чтобы побудить копнуть глубже в уже существующий материал.

#### `/settings`
Настройка напоминаний:
- Время ежедневного напоминания
- Часовой пояс
- Включить / выключить вечерний напоминатель (если не писал в этот день)

#### `/stats`
Статистика: символов, черновиков и постов за сегодня, неделю и месяц. Показывает тренд (растёт / падает). Также отображает актуальное число подписчиков канала (запрашивается у Telegram при каждом вызове).

### Служебные

#### `/promote`
Вступление в пул взаимопиара:
- Делает `@username` автора видимым другим пользователям пула
- Показывает до 3 авторов с наиболее близким числом подписчиков
- `/promote off` — выход из пула и скрытие из выдачи

#### `/admin`
Только для владельца (по `ADMIN_USER_ID`):
- Выдать / отозвать Pro-подписку пользователю
- Посмотреть агрегированную статистику по всем пользователям

#### `/info`
Подробный гайд по всем командам прямо в боте.

---

## AI-интеграция

### Три сценария использования

```
ai_provider = 'groq'       → Groq API (бесплатный, общий ключ)
ai_provider = 'anthropic'  → Anthropic API (ключ пользователя, расшифровывается)
ai_provider = 'paid'       → Anthropic API (ключ владельца, режим Pro)
```

### Генерируемый контент

| Функция | Вход | Выход |
|---|---|---|
| `generateSuggestion` | До 15 опубликованных постов | Идея для следующей темы (≤150 слов) |
| `generateTags` | Текст черновика | 1–3 тега через запятую |
| `generateCombine` | Все выбранные черновики | Единый связный текст в авторском стиле |
| `generateAsk` | До 15 опубликованных постов | 3–5 вопросов от читателя |

### Защита от prompt injection (`src/ai/sanitize.js`)

Перед отправкой в AI любой пользовательский текст проверяется на наличие шаблонов атак:
- `ignore instructions`, `you are now`, `forget everything`
- `act as`, `pretend`, `jailbreak`, `DAN mode`

Дополнительно применяются:
- Экранирование XML-сущностей (`&`, `<`, `>`)
- Усечение текста (макс. 500–800 символов на запрос)

---

## Система подписок

| Уровень | Условие | AI-функции |
|---|---|---|
| **Free** | По умолчанию | Нет (только создание черновиков и публикация) |
| **Trial** | Первые 14 дней | Groq для `/suggest` |
| **Pro** | `subscription_status = 'active'` | Полный доступ: автотеги, bridges, `/suggest` с Claude |

Подписки выдаются вручную через `/admin`. Просроченные подписки отзываются автоматически раз в час (cron).

---

## Безопасность

### Шифрование API-ключей

Ключи пользователей шифруются перед записью в БД:

```
AES-256-GCM(plaintext, key=ENCRYPTION_KEY, iv=random_16_bytes)
→ "iv_hex:authTag_hex:ciphertext_hex"
```

`ENCRYPTION_KEY` — 64 hex-символа (32 байта), задаётся в `.env`.

### Авторизация

- **Admin middleware** (`requireAdmin.js`): сравнивает `ctx.from.id` с `ADMIN_USER_ID` из env. Не-администраторам команда молча игнорируется.
- **Setup middleware** (`requireSetup.js`): большинство команд недоступны, пока пользователь не завершил первичную настройку через `/start`.

### SQL

Все запросы используют параметризацию (`$1, $2, ...`). Конкатенация строк в SQL отсутствует.

### Миграции

Все миграции аддитивные (только `ADD COLUMN`, `CREATE TABLE`). Деструктивные изменения схемы запрещены — это позволяет безопасно откатиться на предыдущую версию образа без потери данных.

---

## Переменные окружения

Пример в файле `.env.example`.

| Переменная | Обязательная | Описание |
|---|---|---|
| `BOT_TOKEN` | да | Токен Telegram-бота |
| `BOT_WEBHOOK_URL` | да | URL для webhook (prod) |
| `PORT` | нет | Порт Fastify (по умолчанию `3001`) |
| `DATABASE_URL` | да | PostgreSQL connection string |
| `REDIS_URL` | да | Redis connection URL |
| `ENCRYPTION_KEY` | да | 64 hex-символа для AES-256-GCM |
| `ADMIN_USER_ID` | да | Telegram ID администратора |
| `OWNER_CONTACT` | да | Контакт для оформления подписки |
| `ANTHROPIC_API_KEY` | нет | Ключ Claude (для Pro-пользователей) |
| `GROQ_API_KEY` | нет | Ключ Groq (shared, опционально) |
| `NODE_ENV` | нет | `production` / `development` |

---

## Запуск

### Разработка (polling)

```bash
cp .env.example .env
# заполни .env

npm install
npm run dev    # polling-режим, webhook не нужен
```

### Production (Docker)

```bash
cp .env.example .env
# заполни .env, в том числе BOT_WEBHOOK_URL

docker compose up -d
```

При старте контейнера автоматически применяются все непримененные миграции.

---

## Тесты

```bash
npm test                            # все тесты
npm run test:coverage               # с отчётом покрытия
npx jest tests/crypto.test.js       # один файл
```

Тесты лежат в `tests/`. Используется Jest с `--experimental-vm-modules` для поддержки ES modules.

**Приоритет покрытия:**

| Модуль | Почему критично |
|---|---|
| `src/crypto/keys.js` | Потеря ключей = невозможно расшифровать данные пользователей |
| `src/ai/sanitize.js` | Ошибка = обход защиты от prompt injection |
| `src/bot/middleware/requireAdmin.js` | Ошибка = любой получает права администратора |
| `src/bot/middleware/requireSetup.js` | Ошибка = доступ к командам без настройки |
| `src/db/models/user.js` | Некорректная работа с данными пользователей |

---

## Деплой и релизы

### Ветки

```
feature/имя  →  dev  →  master (production)
```

Никогда не пушить напрямую в `master`.

### Релиз

```bash
# 1. Проверить тесты
npm test

# 2. Смержить dev в master и поставить тег
git checkout master
git merge dev
git tag v1.x.x
git push origin master
git push origin v1.x.x

# 3. Собрать образ
docker build -t writershadow:v1.x.x .

# 4. Применить миграции
node src/db/migrate.js

# 5. Запустить
VERSION=v1.x.x docker compose up -d

# 6. Проверить логи
docker logs writershadow-app --tail=50
```

### Откат

```bash
VERSION=v1.x-1 docker compose up -d
```

Образ предыдущей версии должен быть собран заранее.

### CI

GitHub Actions запускает `npm test` и `npm audit` на каждый push и PR в `master`/`dev`.
Конфигурация: `.github/workflows/ci.yml`.
