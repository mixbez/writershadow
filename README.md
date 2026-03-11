# WriterShadow

Telegram-бот для авторов, которые хотят писать регулярно и публиковать в свой канал.

---

## Что делает бот

- Сохраняет черновики прямо в личке
- Собирает несколько черновиков в один пост с AI-связками между ними
- Генерирует теги для черновиков автоматически
- Публикует посты в Telegram-канал — сразу или по расписанию
- Присылает ежедневные напоминания и вечерний пинок если ничего не написано
- Предлагает идеи для следующего поста на основе твоих публикаций
- Ведёт статистику: знаки, черновики, посты

---

## Команды

| Команда | Что делает |
|---------|-----------|
| `/start` | Настройка канала для публикации |
| `/new` | Создать черновик (с текстом или без — бот спросит) |
| `/drafts` | Список черновиков. `/drafts тег` — фильтр по тегу |
| `/drafts_full` | Полный текст всех черновиков |
| `/delete` | Удалить черновики. `/delete all` — все сразу |
| `/combine` | Собрать выбранные черновики в пост |
| `/post` | Опубликовать или отложить пост |
| `/suggest` | AI-идея для следующего поста |
| `/stats` | Статистика письма |
| `/settings` | Напоминания, AI-теги, связки |
| `/setai` | Выбрать AI-провайдера |
| `/info` | Подробная инструкция |

---

## AI-уровни

| Уровень | Кому | Провайдер |
|---------|------|-----------|
| Бесплатный | Всем | Groq (общий ключ) |
| Pro | Платная подписка | Claude (ключ владельца) |

Пользователи **не вводят свои ключи**. Всё работает через инфраструктуру проекта.

---

## Стек

- **Runtime:** Node.js 20, ES modules
- **Bot:** Telegraf, webhook-режим
- **DB:** PostgreSQL (миграции в `src/db/migrations/`)
- **Cache/Session:** Redis
- **HTTP:** Fastify
- **AI:** Anthropic SDK (Claude), Groq SDK
- **Deploy:** Docker, Caddy reverse proxy

---

## Структура проекта

```
src/
  bot/
    commands/      # /start, /new, /drafts, /post и т.д.
    handlers/      # draftMessage, callbackQuery
    middleware/    # requireAdmin, requireSetup, redisSession
  db/
    models/        # user, draft, post, dailyStats
    migrations/    # SQL-файлы, применяются автоматически при старте
  ai/
    provider.js    # роутинг между Groq и Claude
    prompt.js      # промпты для всех AI-фич
    sanitize.js    # защита от prompt injection
  scheduler/
    reminders.js   # cron-задачи: напоминания, отложенные посты
  utils/
    splitText.js   # разбивка длинных постов на части
    tags.js        # парсинг и стриппинг ## тегов
    timezone.js    # конвертация локального времени в UTC
  crypto/
    keys.js        # AES-256-GCM шифрование (для legacy-ключей)
```

---

## Deploy

Бот деплоится как сервис `backend-writershadow` в comparity docker-compose:

```bash
# 1. Обновить код
cd /opt/writershadow
git pull origin main

# 2. Пересобрать и перезапустить
cd /opt/comparity
docker compose build backend-writershadow --no-cache
docker compose up -d backend-writershadow

# 3. Проверить логи
docker logs comparity-backend-writershadow-1 --tail=30 -f
```

**Переменные окружения** задаются в `/opt/comparity/.env`:

```
WRITERSHADOW_BOT_TOKEN=...
WRITERSHADOW_DB_PASS=...
ANTHROPIC_API_KEY=sk-ant-api03-...   # Claude для Pro-пользователей
GROQ_API_KEY=gsk_...                  # Groq для бесплатных пользователей
ENCRYPTION_KEY=...                    # 32 байта hex, НЕ менять после деплоя
ADMIN_USER_ID=...
OWNER_CONTACT=@username
```

---

## Ветки

```
feature/xxx  →  dev  →  main (production)
```

- Фича → PR в `dev`
- Релиз → merge `dev` в `main` → rebuild на сервере
- Никогда не пушить напрямую в `main`
