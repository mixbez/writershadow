# WriterShadow — План реализации

> Этот документ — исчерпывающее техническое задание. Следуй ему пошагово.
> Каждый шаг описан достаточно детально, чтобы реализовывать без дополнительных решений.

---

## 1. Обзор

**WriterShadow** — Telegram-бот для авторов блогов.

### Что делает бот:
1. Живёт в двух чатах: **канал автора** (публикует посты, бот — админ) и **группа черновиков** (читает сообщения, бот — участник)
2. Каждый день в заданное время напоминает: «пора писать»
3. Отслеживает каждое сообщение автора в группе черновиков (знаки, черновики)
4. Соединяет выбранные черновики в один пост
5. Публикует пост в канал по команде автора
6. Показывает статистику: знаки / черновики / посты за день, неделю, месяц с динамикой
7. Анализирует стиль прошлых публикаций через Claude API и предлагает идеи в стиле автора

### Чего бот НЕ делает:
- Не редактирует текст
- Не публикует без явного подтверждения автора

---

## 2. Технологический стек

| Слой | Технология | Почему |
|---|---|---|
| Язык | **Node.js 20 LTS** | Единообразно с Comparity |
| Telegram | **Telegraf v4** | Зрелая библиотека, поддержка webhook |
| HTTP-сервер | **Fastify v4** | Быстрый, используется в Comparity |
| База данных | **PostgreSQL 15** | Общий инстанс, отдельная БД `writershadow` |
| Кэш/сессии | **Redis 7** | Общий инстанс, префикс `writershadow:` |
| Планировщик | **node-cron** | Легковесный, без внешних зависимостей |
| AI | **Anthropic Claude API** (`@anthropic-ai/sdk`) | Анализ стиля и генерация идей |
| Контейнер | **Docker** + **Docker Compose** | Интеграция с существующим стеком |

---

## 3. Что НЕ охвачено в limitations.md (нужно добавить)

Перед реализацией обрати внимание: в `limitations.md` нет упоминания:
- `ANTHROPIC_API_KEY` — нужна отдельная переменная окружения
- Таймзона сервера влияет на `node-cron` — у каждого пользователя своя таймзона, планировщик должен это учитывать
- Redis без пароля — в `limitations.md` есть предупреждение, но нет конкретных инструкций; добавь `REDIS_PASSWORD` в `.env`

---

## 4. Структура файлов

Создавай файлы строго в этой структуре:

```
writershadow/
├── Dockerfile
├── .env.example
├── package.json
├── src/
│   ├── index.js                    # Точка входа: Fastify + webhook
│   ├── bot/
│   │   ├── index.js                # Создаёт и экспортирует экземпляр Telegraf
│   │   ├── commands/
│   │   │   ├── start.js            # /start — регистрация и настройка
│   │   │   ├── stats.js            # /stats — статистика
│   │   │   ├── drafts.js           # /drafts — список черновиков
│   │   │   ├── combine.js          # /combine — сборка поста
│   │   │   ├── post.js             # /post — публикация
│   │   │   └── suggest.js          # /suggest — идея от AI
│   │   ├── handlers/
│   │   │   ├── draftMessage.js     # Трекинг сообщений в группе черновиков
│   │   │   └── callbackQuery.js    # Inline-кнопки
│   │   └── middleware/
│   │       └── requireSetup.js     # Проверка, что пользователь настроен
│   ├── db/
│   │   ├── index.js                # Пул подключений (pg)
│   │   ├── migrations/
│   │   │   └── 001_initial.sql     # Все таблицы
│   │   └── models/
│   │       ├── user.js
│   │       ├── draft.js
│   │       ├── post.js
│   │       └── dailyStats.js
│   ├── redis/
│   │   └── client.js               # Redis с префиксом writershadow:
│   ├── scheduler/
│   │   └── reminders.js            # Ежедневные напоминания
│   └── ai/
│       └── suggest.js              # Вызов Claude API
```

---

## 5. База данных

### Миграция: `src/db/migrations/001_initial.sql`

```sql
-- Пользователи
CREATE TABLE users (
  id                SERIAL PRIMARY KEY,
  telegram_user_id  BIGINT UNIQUE NOT NULL,
  username          TEXT,
  blog_channel_id   BIGINT,          -- ID канала (отрицательное число или @username)
  draft_group_id    BIGINT,          -- ID группы черновиков
  reminder_time     TIME DEFAULT '09:00',   -- Время напоминания в таймзоне пользователя
  timezone          TEXT DEFAULT 'Europe/Moscow',
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Черновики
CREATE TABLE drafts (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id      BIGINT NOT NULL,    -- ID сообщения в Telegram
  chat_id         BIGINT NOT NULL,    -- ID группы черновиков
  text            TEXT NOT NULL,
  char_count      INTEGER NOT NULL,
  is_used         BOOLEAN DEFAULT FALSE,
  post_id         INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Посты (публикации в канале)
CREATE TABLE posts (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_message_id  BIGINT,          -- ID сообщения в канале после публикации
  text                TEXT NOT NULL,
  char_count          INTEGER NOT NULL,
  status              TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Суточная статистика (один ряд = один день для одного пользователя)
CREATE TABLE daily_stats (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  chars_written   INTEGER DEFAULT 0,
  drafts_count    INTEGER DEFAULT 0,
  posts_published INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

-- Индексы
CREATE INDEX idx_drafts_user_unused ON drafts(user_id) WHERE is_used = FALSE;
CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_daily_stats_user_date ON daily_stats(user_id, date);
```

> **Важно:** `posts` должна быть создана до `drafts` из-за внешнего ключа.
> В `001_initial.sql` порядок CREATE TABLE: сначала `users`, затем `posts`, затем `drafts`, затем `daily_stats`.

---

## 6. Переменные окружения

### `.env.example`

```
# Telegram
BOT_TOKEN=<writershadow_bot_token>
BOT_WEBHOOK_URL=https://v2202504269079335176.supersrv.de/ws-webhook

# Server
PORT=3001

# Database
DATABASE_URL=postgresql://writershadow:writershadow_pass@postgres:5432/writershadow

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=
REDIS_KEY_PREFIX=writershadow:

# AI
ANTHROPIC_API_KEY=<your_anthropic_api_key>

# Environment
NODE_ENV=production
```

---

## 7. Инициализация сервера (`src/index.js`)

```javascript
import Fastify from 'fastify';
import { bot } from './bot/index.js';
import { startScheduler } from './scheduler/reminders.js';
import { runMigrations } from './db/index.js';

const server = Fastify({ logger: true });

await runMigrations();
startScheduler();

if (process.env.NODE_ENV === 'production') {
  // Webhook mode
  server.post('/ws-webhook', async (req, reply) => {
    await bot.handleUpdate(req.body);
    return { ok: true };
  });
  await server.listen({ port: Number(process.env.PORT || 3001), host: '0.0.0.0' });
  await bot.telegram.setWebhook(`${process.env.BOT_WEBHOOK_URL}`);
  console.log('Webhook set:', process.env.BOT_WEBHOOK_URL);
} else {
  // Long polling mode для разработки
  await bot.launch();
  console.log('Bot started in polling mode');
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
```

---

## 8. База данных (`src/db/index.js`)

```javascript
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function runMigrations() {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const sql = readFileSync(join(__dir, 'migrations/001_initial.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migrations applied');
}

export async function query(text, params) {
  return pool.query(text, params);
}
```

---

## 9. Redis (`src/redis/client.js`)

```javascript
import { createClient } from 'redis';

const PREFIX = process.env.REDIS_KEY_PREFIX || 'writershadow:';

const client = createClient({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD || undefined,
});

await client.connect();

export const redis = {
  get: (key) => client.get(`${PREFIX}${key}`),
  set: (key, value, ttlSeconds) =>
    ttlSeconds
      ? client.setEx(`${PREFIX}${key}`, ttlSeconds, value)
      : client.set(`${PREFIX}${key}`, value),
  del: (key) => client.del(`${PREFIX}${key}`),
};
```

---

## 10. Telegram-бот (`src/bot/index.js`)

```javascript
import { Telegraf, session } from 'telegraf';
import { startCommand } from './commands/start.js';
import { statsCommand } from './commands/stats.js';
import { draftsCommand } from './commands/drafts.js';
import { combineCommand } from './commands/combine.js';
import { postCommand } from './commands/post.js';
import { suggestCommand } from './commands/suggest.js';
import { handleDraftMessage } from './handlers/draftMessage.js';
import { handleCallbackQuery } from './handlers/callbackQuery.js';

export const bot = new Telegraf(process.env.BOT_TOKEN);

// Сессия в памяти (для multi-step диалогов настройки)
bot.use(session());

// Команды
bot.command('start', startCommand);
bot.command('stats', statsCommand);
bot.command('drafts', draftsCommand);
bot.command('combine', combineCommand);
bot.command('post', postCommand);
bot.command('suggest', suggestCommand);

// Трекинг сообщений
bot.on('message', handleDraftMessage);

// Inline-кнопки
bot.on('callback_query', handleCallbackQuery);
```

---

## 11. Команды

### 11.1 `/start` — настройка (`src/bot/commands/start.js`)

**Сценарий:**

Шаг 1 (при первом `/start`): «Привет! Я WriterShadow 🖊 Помогаю писать регулярно. Давай настроимся. Напиши `@username` или перешли любое сообщение из твоего **канала** (где публикуешь посты).»

Шаг 2 (ожидаем ответ — канал): валидируем, что бот там есть и является администратором. Если нет — просим добавить бота. Сохраняем `blog_channel_id`.

Шаг 3: «Теперь напиши `@username` или перешли сообщение из твоей **группы черновиков**.»

Шаг 4 (ожидаем ответ — группа): валидируем, что бот там есть. Сохраняем `draft_group_id`.

Шаг 5: «В какое время напоминать тебе писать? (формат HH:MM, например: 09:00)»

Шаг 6 (ожидаем ответ — время): валидируем формат HH:MM. Сохраняем `reminder_time`.

Шаг 7: «Твой часовой пояс? Примеры: `Europe/Moscow`, `Europe/Berlin`, `Asia/Almaty`. Можно прислать геолокацию.»

Шаг 8 (ожидаем ответ — таймзона или геолокация): если геолокация — определяем таймзону по координатам через `geotz` (npm-пакет). Если текст — валидируем через `Intl.supportedValuesOf('timeZone')`. Сохраняем `timezone`.

Подтверждение: «Всё готово! Жду тебя каждый день в [время] [таймзона]. Удачи с написанием!»

**Реализация через session:**
```javascript
// ctx.session.setupStep: 'channel' | 'group' | 'time' | 'timezone' | null
```

Если пользователь уже настроен и пишет `/start` снова — показывать текущие настройки и спрашивать: «Хочешь изменить настройки? (да/нет)»

**Модель пользователя (`src/db/models/user.js`):**
```javascript
export async function createOrGetUser(telegramUserId, username) { ... }
export async function updateUser(telegramUserId, fields) { ... }  // fields — объект с полями
export async function getUser(telegramUserId) { ... }
export async function isUserSetup(telegramUserId) { ... } // true если blog_channel_id и draft_group_id заполнены
```

---

### 11.2 Трекинг черновиков (`src/bot/handlers/draftMessage.js`)

**Логика:**
1. Сообщение пришло в группу (не в личку)
2. Находим пользователя у которого `draft_group_id` совпадает с `ctx.chat.id`
3. Проверяем, что отправитель сообщения — это сам пользователь (`ctx.from.id === user.telegram_user_id`)
4. Берём текст сообщения, считаем `text.length` знаков
5. Сохраняем в `drafts`
6. Обновляем `daily_stats` (UPSERT):
   ```sql
   INSERT INTO daily_stats (user_id, date, chars_written, drafts_count)
   VALUES ($1, CURRENT_DATE, $2, 1)
   ON CONFLICT (user_id, date) DO UPDATE
   SET chars_written = daily_stats.chars_written + $2,
       drafts_count = daily_stats.drafts_count + 1
   ```
7. Не отвечать на сообщение (невидимый трекинг). Исключение: если это первое сообщение сегодня — добавить реакцию ✍️ через `ctx.react('✍')` (Telegraf v4.12+, если версия ниже — просто не добавлять реакцию).

**Модель черновика (`src/db/models/draft.js`):**
```javascript
export async function saveDraft(userId, messageId, chatId, text) { ... }
export async function getUnusedDrafts(userId, limit = 20) { ... }
export async function markDraftsAsUsed(draftIds, postId) { ... }
```

---

### 11.3 `/stats` (`src/bot/commands/stats.js`)

**Сценарий:** работает только в личном чате с ботом. Проверяет, что пользователь настроен.

**Формат ответа:**
```
📊 Твоя статистика

Сегодня: 1 234 зн. · 3 черновика · 0 постов

Эта неделя: 8 456 зн. · 14 черновиков · 2 поста
Прошлая неделя: 5 200 зн. · 9 черновиков · 1 пост
Динамика: ▲ 63% по знакам

Этот месяц: 32 100 зн. · 52 черновика · 7 постов
Прошлый месяц: 28 500 зн. · 44 черновика · 5 постов
Динамика: ▲ 13% по знакам
```

**Запросы в БД (`src/db/models/dailyStats.js`):**
```javascript
export async function getStatsForPeriod(userId, dateFrom, dateTo) {
  // SELECT SUM(chars_written), SUM(drafts_count), SUM(posts_published)
  // FROM daily_stats WHERE user_id = $1 AND date BETWEEN $2 AND $3
}
export async function getTodayStats(userId) { ... }
```

---

### 11.4 `/drafts` (`src/bot/commands/drafts.js`)

**Сценарий:** показывает список неиспользованных черновиков.

**Формат ответа:**
```
📝 Твои черновики (последние 20):

1. [14 фев, 18:32] — 342 зн.
   «Когда я думаю о прокрастинации, я понимаю что...»

2. [15 фев, 10:15] — 218 зн.
   «Утро началось с идеи о том, что настоящий текст...»

...

Всего: 5 черновиков · 1 234 знака
Используй /combine чтобы собрать пост.
```

Текст черновика обрезается до 80 символов с «...».

---

### 11.5 `/combine` (`src/bot/commands/combine.js`)

**Сценарий:**

Шаг 1: Показывает нумерованный список черновиков (как в `/drafts`).

Шаг 2: «Введи номера черновиков через пробел (например: `1 3 5`) или напиши `все` чтобы взять все.»

Шаг 3 (ожидаем ответ): Парсим числа. Если «все» — берём все. Если числа — фильтруем валидные.

Шаг 4: Собираем текст в порядке возрастания даты черновика. Разделяем двойным переносом строки.

Шаг 5: Показываем предпросмотр:
```
📄 Предпросмотр поста (1 234 знака):

[объединённый текст]

---
Нажми /post чтобы опубликовать в [название канала].
```

Сохраняем собранный пост в `posts` со статусом `draft`. Сохраняем `post_id` в сессию Redis: `writershadow:pending_post:{user_id}`.

**Модель поста (`src/db/models/post.js`):**
```javascript
export async function createDraftPost(userId, text, draftIds) { ... }
export async function publishPost(postId, channelMessageId) { ... }
export async function getLatestDraftPost(userId) { ... }
export async function getRecentPublishedPosts(userId, limit = 15) { ... }
```

---

### 11.6 `/post` (`src/bot/commands/post.js`)

**Сценарий:**

1. Ищем pending post из Redis или последний черновик поста в БД.
2. Если нет — «Нет готового поста. Сначала используй /combine.»
3. Если есть — показываем текст поста и кнопки:
   ```
   [✅ Опубликовать] [❌ Отмена]
   ```
4. При нажатии «Опубликовать»:
   - Отправляем текст в канал: `bot.telegram.sendMessage(user.blog_channel_id, post.text)`
   - Получаем `message_id` ответа
   - Обновляем `posts`: `status = 'published'`, `channel_message_id`, `published_at = NOW()`
   - Помечаем черновики как использованные (`is_used = TRUE`)
   - Обновляем `daily_stats.posts_published += 1`
   - Удаляем pending post из Redis
   - Отвечаем: «✅ Опубликовано!»
5. При нажатии «Отмена» — «Публикация отменена. Пост сохранён, можешь вернуться к нему позже.»

---

### 11.7 `/suggest` (`src/bot/commands/suggest.js`)

**Сценарий:**

1. «Анализирую твои тексты...» (отправляем сразу, пока думает AI)
2. Берём последние 15 опубликованных постов из БД (`getRecentPublishedPosts`)
3. Если меньше 3 — «У тебя пока мало опубликованных постов. Напиши хотя бы 3, тогда смогу помочь с идеями.»
4. Формируем промпт для Claude (см. раздел 12)
5. Отправляем запрос к API
6. Возвращаем ответ пользователю

---

## 12. AI-модуль (`src/ai/suggest.js`)

```javascript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateSuggestion(publishedPosts) {
  const postsText = publishedPosts
    .map((p, i) => `--- Пост ${i + 1} ---\n${p.text}`)
    .join('\n\n');

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Ты — литературный ассистент. Проанализируй тексты автора и предложи одну конкретную идею для нового поста в его стиле.

Важно:
- Не редактируй и не переписывай тексты автора
- Предложи тему или угол зрения, которого ещё не было
- Укажи, что именно в стиле автора ты заметил
- Ответ — не длиннее 150 слов

Тексты автора:
${postsText}`,
      },
    ],
  });

  return response.content[0].text;
}
```

---

## 13. Планировщик напоминаний (`src/scheduler/reminders.js`)

**Логика:**

Каждую минуту (или каждые 5 минут — экономичнее) проверяем всех активных пользователей и смотрим, наступило ли их время напоминания с учётом их таймзоны.

```javascript
import cron from 'node-cron';
import { bot } from '../bot/index.js';
import { query } from '../db/index.js';
import { getTodayStats } from '../db/models/dailyStats.js';

export function startScheduler() {
  // Каждые 5 минут проверяем пользователей
  cron.schedule('*/5 * * * *', async () => {
    await checkReminders();
  });
}

async function checkReminders() {
  const { rows: users } = await query(`
    SELECT * FROM users WHERE is_active = TRUE
    AND blog_channel_id IS NOT NULL AND draft_group_id IS NOT NULL
  `);

  for (const user of users) {
    const now = new Date();
    // Текущее время в таймзоне пользователя
    const userTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: user.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    // Округляем до 5 минут для сравнения
    const [hh, mm] = userTime.split(':').map(Number);
    const roundedMinutes = Math.floor(mm / 5) * 5;
    const currentSlot = `${String(hh).padStart(2, '0')}:${String(roundedMinutes).padStart(2, '0')}`;

    const reminderSlot = user.reminder_time.slice(0, 5); // "09:00"

    if (currentSlot === reminderSlot) {
      await sendDailyReminder(user);
    }
  }
}

async function sendDailyReminder(user) {
  const stats = await getTodayStats(user.id);
  const dateKey = new Date().toISOString().slice(0, 10);

  // Проверяем, что сегодня ещё не отправляли напоминание (Redis lock)
  const lockKey = `reminder:${user.id}:${dateKey}`;
  const { redis } = await import('../redis/client.js');
  const alreadySent = await redis.get(lockKey);
  if (alreadySent) return;
  await redis.set(lockKey, '1', 86400); // TTL 24 часа

  let text = `✍️ Время писать!\n\n`;
  if (stats && stats.chars_written > 0) {
    text += `Сегодня уже: ${stats.chars_written} зн. · ${stats.drafts_count} черновика`;
  } else {
    text += `Сегодня ещё ничего не написано. Начни с одного предложения.`;
  }

  try {
    await bot.telegram.sendMessage(user.telegram_user_id, text);
  } catch (err) {
    console.error(`Failed to send reminder to ${user.telegram_user_id}:`, err.message);
  }
}
```

---

## 14. Middleware (`src/bot/middleware/requireSetup.js`)

```javascript
export function requireSetup() {
  return async (ctx, next) => {
    const { getUser, isUserSetup } = await import('../db/models/user.js');
    if (ctx.chat?.type !== 'private') return next(); // В группах не проверяем
    const setup = await isUserSetup(ctx.from.id);
    if (!setup) {
      return ctx.reply('Сначала настрой бота командой /start.');
    }
    return next();
  };
}
```

Применяй этот middleware ко всем командам кроме `/start`.

---

## 15. Docker

### `Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3001
CMD ["node", "src/index.js"]
```

### Дополнение в `docker-compose.yml` (Comparity-репозиторий)

Добавить сервис:
```yaml
  backend-writershadow:
    build: ../writershadow
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3001
      BOT_TOKEN: ${WRITERSHADOW_BOT_TOKEN}
      BOT_WEBHOOK_URL: https://v2202504269079335176.supersrv.de/ws-webhook
      DATABASE_URL: postgresql://writershadow:${WRITERSHADOW_DB_PASS}@postgres:5432/writershadow
      REDIS_URL: redis://redis:6379
      REDIS_KEY_PREFIX: writershadow:
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on:
      - postgres
      - redis
    networks:
      - app-network
```

### Дополнение в Caddyfile

```caddyfile
reverse_proxy /ws-webhook backend-writershadow:3001
```

---

## 16. `package.json`

```json
{
  "name": "writershadow",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "NODE_ENV=development node src/index.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.27.0",
    "fastify": "^4.28.0",
    "geotz": "^0.2.0",
    "node-cron": "^3.0.3",
    "pg": "^8.12.0",
    "redis": "^4.7.0",
    "telegraf": "^4.16.3"
  }
}
```

---

## 17. Порядок реализации

Следуй строго этому порядку. Каждый шаг — отдельный коммит.

### Шаг 1: Скаффолдинг проекта
- Создать `package.json`
- Создать `.env.example`
- Создать `Dockerfile`
- Создать `src/index.js` (заглушка: просто логирует «started»)
- Запустить `npm install`

### Шаг 2: База данных
- Создать `src/db/index.js`
- Создать `src/db/migrations/001_initial.sql`
- Проверить: `npm start` должен выполнить миграцию без ошибок

### Шаг 3: Redis
- Создать `src/redis/client.js`
- Проверить: в `src/index.js` добавить тест `redis.set('test', 'ok')`, убедиться что не падает

### Шаг 4: Базовый бот
- Создать `src/bot/index.js`
- Подключить webhook в `src/index.js`
- Добавить `/start` как заглушку (`ctx.reply('Бот работает')`)
- Проверить: бот отвечает на `/start`

### Шаг 5: Регистрация (`/start`)
- Создать все модели в `src/db/models/`
- Реализовать полный флоу `/start` с multi-step сессией
- Проверить: пользователь проходит все шаги и сохраняется в БД

### Шаг 6: Трекинг черновиков
- Реализовать `src/bot/handlers/draftMessage.js`
- Проверить: сообщения в группе сохраняются в `drafts` и обновляют `daily_stats`

### Шаг 7: Статистика (`/stats`)
- Реализовать `src/db/models/dailyStats.js`
- Реализовать `src/bot/commands/stats.js`
- Проверить: команда выводит корректные данные

### Шаг 8: Черновики и сборка поста (`/drafts`, `/combine`)
- Реализовать `src/bot/commands/drafts.js`
- Реализовать `src/bot/commands/combine.js`
- Проверить: команды показывают правильный список, сборка сохраняется в БД

### Шаг 9: Публикация (`/post`)
- Реализовать `src/bot/commands/post.js` с inline-кнопками
- Реализовать `src/bot/handlers/callbackQuery.js`
- Проверить: пост уходит в канал, статистика обновляется

### Шаг 10: Напоминания
- Реализовать `src/scheduler/reminders.js`
- Интегрировать в `src/index.js`
- Проверить: напоминание приходит в нужное время

### Шаг 11: AI-подсказки (`/suggest`)
- Реализовать `src/ai/suggest.js`
- Реализовать `src/bot/commands/suggest.js`
- Проверить: команда возвращает предложение

### Шаг 12: Docker и деплой
- Проверить что `Dockerfile` собирается
- Добавить сервис в docker-compose Comparity
- Добавить маршрут в Caddyfile
- Создать БД на сервере
- Проверить webhook

---

## 18. Известные ограничения и обходные пути

| Ограничение | Решение |
|---|---|
| Бот не может читать историю чатов | Черновики трекаются только с момента добавления бота в группу |
| Telegram не позволяет боту видеть сообщения других участников группы, если не включён `privacy_mode` | Отключить privacy mode у бота через BotFather (`/setprivacy → Disable`) |
| Canal admin check: бот должен быть admin в канале для публикации | При настройке проверять через `getChatMember` |
| Reacts API доступен только в Telegraf 4.12+ | Перед использованием `ctx.react()` проверить версию или убрать реакции |
| node-cron работает по серверному времени, не по таймзоне пользователя | Учтено: сравниваем текущее время с `Intl.DateTimeFormat` для таймзоны пользователя |

---

## 19. Команды бота (итог для BotFather)

```
start - Настройка бота
stats - Статистика: знаки, черновики, посты
drafts - Список черновиков
combine - Собрать пост из черновиков
post - Опубликовать в канал
suggest - Идея в моём стиле (AI)
```

---

## 20. Чеклист перед деплоем

- [ ] `BOT_TOKEN` — новый токен, не Comparity
- [ ] `BOT_WEBHOOK_URL` — `https://.../ws-webhook` (не `/webhook`)
- [ ] `DATABASE_URL` — база `writershadow`, не `comparity`
- [ ] `REDIS_KEY_PREFIX` — `writershadow:`
- [ ] `ANTHROPIC_API_KEY` — заполнен
- [ ] Privacy mode у бота **отключён** (через BotFather)
- [ ] Бот добавлен в группу черновиков как **участник**
- [ ] Бот добавлен в канал как **администратор** (права: публикация сообщений)
- [ ] Caddyfile обновлён, Caddy перезагружен
- [ ] БД `writershadow` создана на сервере
- [ ] Миграция выполнена успешно (видно в логах)
- [ ] Тестовый пост отправлен и дошёл до канала
