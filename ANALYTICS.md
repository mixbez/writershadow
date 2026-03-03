# 📊 Analytics System

Система аналитики для логирования всех команд бота и мониторинга активности пользователей.

## 🚀 Быстрый старт

### 1. Дашборд
После запуска приложения дашборд доступен по адресу:
- **Локально**: `http://localhost:3001/analytics`
- **По IP**: `http://your-vps-ip:3001/analytics`
- **По домену**: `https://your-domain.com/analytics`

### Аутентификация (Опционально)

По умолчанию дашборд открыт для всех. Если хочешь добавить пароль:

```bash
export ANALYTICS_KEY="your-secret-key-here"
npm run dev
```

Затем открывай дашборд с ключом в URL:
```
http://your-vps-ip:3001/analytics?key=your-secret-key-here
```

Или введи ключ в форме на странице дашборда (если он закрыт)

### 2. API эндпоинты

#### Получить статистику
```bash
GET /api/analytics/stats
```

Ответ:
```json
{
  "stats": {
    "total_commands": 1234,
    "commands_24h": 45,
    "errors_total": 12,
    "errors_24h": 2,
    "unique_users": 34
  },
  "commandStats": [
    {
      "command": "start",
      "status": "success",
      "count": 200,
      "count_24h": 5
    }
  ]
}
```

#### Получить логи команд
```bash
GET /api/analytics/logs?command=start&status=success&telegramUserId=123&fromDate=2026-03-01&toDate=2026-03-03
```

#### Получить статистику по пользователю
```bash
GET /api/analytics/user/:telegramUserId
```

## 📝 Как использовать в коде

### Вариант 1: Автоматическое логирование с декоратором

```javascript
import { withAnalytics } from '../utils/analyticsLogger.js';

// В команде бота
export const startCommand = {
  command: 'start',
  handler: withAnalytics('start')(async (ctx) => {
    // Ваш код команды
    await ctx.reply('Привет!');
  })
};
```

### Вариант 2: Прямое логирование в обработчике

```javascript
import { logAnalytics } from '../utils/analyticsLogger.js';

export async function handleMessage(ctx) {
  try {
    // Ваш код
    const result = await someOperation();

    // Логируем успех
    await logAnalytics(
      ctx.from.id,
      'message_handler',
      'success',
      null,
      { result: result }
    );
  } catch (error) {
    // Логируем ошибку
    await logAnalytics(
      ctx.from.id,
      'message_handler',
      'error',
      error.message,
      { stack: error.stack }
    );
    throw error;
  }
}
```

### Вариант 3: Асинхронное логирование (без ожидания)

```javascript
import { logAnalyticsAsync } from '../utils/analyticsLogger.js';

export async function quickHandler(ctx) {
  // Логируем без ожидания
  logAnalyticsAsync(ctx.from.id, 'quick_action', 'success');

  // Работаем дальше без задержки
  await ctx.reply('Готово!');
}
```

## 📊 Структура БД

Таблица `command_logs`:

```sql
CREATE TABLE command_logs (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER,  -- внутренний ID пользователя (может быть NULL)
  telegram_user_id  BIGINT,   -- Telegram ID пользователя
  username          TEXT,     -- username пользователя
  command           TEXT,     -- название команды/действия
  status            TEXT,     -- 'success' или 'error'
  error_message     TEXT,     -- сообщение об ошибке (если есть)
  data              JSONB,    -- дополнительные данные в JSON
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

## 🎯 Примеры логирования

### Логирование команды /start
```javascript
await logAnalytics(
  ctx.from.id,
  'start',
  'success',
  null,
  { userId: user.id }
);
```

### Логирование ошибки с доп. информацией
```javascript
await logAnalytics(
  ctx.from.id,
  'publish_post',
  'error',
  'Channel not found',
  {
    channelId: channelId,
    postId: post.id,
    duration: Date.now() - startTime
  }
);
```

## 🔧 Очистка старых логов

Для очистки логов старше 30 дней:

```javascript
import { clearOldLogs } from './db/models/commandLog.js';

// Удаляет логи старше 30 дней
await clearOldLogs(30);
```

Добавьте в scheduler для автоматической очистки:

```javascript
import cron from 'node-cron';
import { clearOldLogs } from '../db/models/commandLog.js';

export function startAnalyticsCleanup() {
  // Каждый день в 03:00 удалять логи старше 30 дней
  cron.schedule('0 3 * * *', async () => {
    const deleted = await clearOldLogs(30);
    console.log(`Cleaned up ${deleted} old analytics logs`);
  });
}
```

## 📈 Дашборд Features

- 📊 Статистика команд (всего, последние 24ч, ошибок)
- 👥 Уникальные пользователи
- 📈 Графики команд и статусов
- 🔍 Фильтрация логов по команде, статусу, пользователю
- 🔄 Автоматическое обновление каждые 30 сек
- 📱 Адаптивный дизайн для мобильных

## 🔒 Безопасность

- API эндпоинты не требуют аутентификации (для локальной разработки)
- В продакшене рекомендуется добавить аутентификацию или ограничить доступ
- Пароли и чувствительные данные НЕ логируются

## 🚨 Важно

- Логирование происходит асинхронно и не блокирует выполнение команды
- При ошибке логирования команда всё равно выполняется
- Логи хранятся в PostgreSQL и могут расти со временем
- Рекомендуется регулярно очищать старые логи

## 📞 Примеры использования

### Пример 1: Логирование в обработчике сообщений

```javascript
import { logAnalyticsAsync } from '../utils/analyticsLogger.js';

export async function handleDraftMessage(ctx) {
  try {
    const result = await createDraft(ctx);
    logAnalyticsAsync(ctx.from.id, 'draft_created', 'success', null, {
      draftId: result.id,
      charCount: result.char_count
    });
  } catch (error) {
    logAnalyticsAsync(ctx.from.id, 'draft_created', 'error', error.message);
    throw error;
  }
}
```

### Пример 2: Логирование callback-команд

```javascript
export async function handlePublishButton(ctx) {
  try {
    const postId = ctx.match[1];
    const result = await publishPost(postId);

    logAnalyticsAsync(
      ctx.from.id,
      'publish_button_click',
      'success',
      null,
      { postId, result }
    );

    await ctx.reply('✅ Пост опубликован!');
  } catch (error) {
    logAnalyticsAsync(
      ctx.from.id,
      'publish_button_click',
      'error',
      error.message
    );
    await ctx.reply('❌ Ошибка: ' + error.message);
  }
}
```
