# WriterShadow — Что нужно сделать руками

Этот файл — чеклист действий, которые нельзя автоматизировать.
Выполняй по порядку. Каждый пункт отмечай галочкой по мере выполнения.

---

## Часть 1. До разработки (один раз)

### 1.1 Создать бота в Telegram

1. Открой чат с [@BotFather](https://t.me/BotFather)
2. Отправь `/newbot`
3. Придумай имя: например, `WriterShadow`
4. Придумай username: например, `writershadow_bot` (должен заканчиваться на `bot`)
5. Скопируй полученный **токен** — понадобится как `BOT_TOKEN`

### 1.2 Настроить бота через BotFather

Все эти команды отправляй в чат с [@BotFather](https://t.me/BotFather):

**Отключить privacy mode** (бот должен видеть сообщения в группах):
```
/setprivacy
→ выбери своего бота
→ Disable
```

**Установить описание:**
```
/setdescription
→ выбери своего бота
→ Помогает авторам блогов писать регулярно. Трекает черновики, собирает посты, напоминает каждый день.
```

**Установить команды** (копируй блок целиком):
```
/setcommands
→ выбери своего бота
→ вставь:
start - Начало работы и настройка канала
settings - Настройки напоминаний
setai - Настройка AI-ассистента
subscribe - Подписка WriterShadow Pro
stats - Статистика за день, неделю, месяц
drafts - Список черновиков
combine - Собрать пост из черновиков
post - Опубликовать в канал
suggest - Идея для следующего поста (AI)
```

> Команду `/admin` **не добавляй** в список — она скрытая, только для тебя.

**Установить картинку бота** (опционально):
```
/setuserpic
→ выбери своего бота
→ загрузи изображение
```

### 1.3 Узнать свой Telegram ID

Открой чат с [@userinfobot](https://t.me/userinfobot) и отправь любое сообщение.
Бот ответит твоим `Id`. Это и есть `ADMIN_USER_ID`.

---

## Часть 2. Получить API ключи

### 2.1 Anthropic (для платного уровня)

> Нужен, только если ты планируешь предлагать подписку WriterShadow Pro за 9€/мес.
> Если нет — можно пропустить, пользователи будут использовать свои ключи.

1. Зарегистрируйся на [console.anthropic.com](https://console.anthropic.com)
2. Перейди в **API Keys** → **Create Key**
3. Скопируй ключ (начинается с `sk-ant-`) — понадобится как `ANTHROPIC_API_KEY`
4. Пополни баланс — для `claude-haiku-4-5-20251001` это очень дёшево (~$0.25 за 1M токенов)

> Расчёт расходов на одного Pro-пользователя:
> 15 постов × 500 символов ≈ 7500 символов ≈ ~2000 токенов на запрос.
> При 30 запросах `/suggest` в месяц = ~60 000 токенов ≈ $0.015/мес.
> 9€ за пользователя в месяц — запас очень большой.

### 2.2 Groq (опционально, для своих тестов)

> Пользователи будут регистрировать свои ключи Groq сами.
> Тебе Groq-ключ нужен только для тестирования.

1. Зарегистрируйся на [console.groq.com](https://console.groq.com)
2. Перейди в **API Keys** → **Create API Key**
3. Скопируй ключ (начинается с `gsk_`)

---

## Часть 3. Настройка сервера (один раз)

Все команды выполняй через SSH на сервере `v2202504269079335176.supersrv.de`.

### 3.1 Создать базу данных

Подключись к PostgreSQL:
```bash
docker exec -it <имя postgres-контейнера> psql -U postgres
```

> Имя контейнера узнай через: `docker ps | grep postgres`

Выполни SQL:
```sql
CREATE DATABASE writershadow;
CREATE USER writershadow WITH PASSWORD 'ПРИДУМАЙ_НАДЁЖНЫЙ_ПАРОЛЬ';
GRANT ALL PRIVILEGES ON DATABASE writershadow TO writershadow;
\q
```

Запиши пароль — понадобится как `WRITERSHADOW_DB_PASS`.

### 3.2 Сгенерировать ENCRYPTION_KEY

На сервере (или локально с Node.js):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Скопируй вывод — 64 hex символа. Это `ENCRYPTION_KEY`.

> **Храни этот ключ в безопасном месте.** Если потеряешь — все ключи пользователей станут нечитаемы.

### 3.3 Обновить `.env` в Comparity-репозитории

Открой файл `.env` в директории Comparity на сервере и добавь в конец:

```
# WriterShadow
WRITERSHADOW_BOT_TOKEN=<токен из шага 1.1>
WRITERSHADOW_DB_PASS=<пароль из шага 3.1>
ANTHROPIC_API_KEY=<ключ из шага 2.1 или оставь пустым>
ENCRYPTION_KEY=<ключ из шага 3.2>
ADMIN_USER_ID=<твой ID из шага 1.3>
OWNER_CONTACT=@твой_username
```

### 3.4 Обновить Caddyfile

Открой Caddyfile в директории Comparity:
```bash
nano /path/to/comparity/Caddyfile
```

Найди блок для домена `v2202504269079335176.supersrv.de` и добавь строку **до** других `reverse_proxy`:
```caddyfile
reverse_proxy /ws-webhook backend-writershadow:3001
```

Итоговый блок должен выглядеть примерно так:
```caddyfile
v2202504269079335176.supersrv.de {
  reverse_proxy /ws-webhook backend-writershadow:3001
  reverse_proxy /webhook backend:3000
  reverse_proxy /api/* backend:3000
  reverse_proxy * frontend:80
}
```

### 3.5 Обновить docker-compose.yml

Открой `docker-compose.yml` в директории Comparity и добавь сервис в конец блока `services:`:

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
      REDIS_KEY_PREFIX: "writershadow:"
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      ADMIN_USER_ID: ${ADMIN_USER_ID}
      OWNER_CONTACT: ${OWNER_CONTACT}
    depends_on:
      - postgres
      - redis
```

---

## Часть 4. Деплой

### 4.1 Первый запуск

```bash
# В директории Comparity
docker-compose build backend-writershadow
docker-compose up -d backend-writershadow
docker-compose reload caddy   # или: docker-compose restart caddy
```

### 4.2 Проверить логи

```bash
docker-compose logs -f backend-writershadow
```

Должны быть строки:
```
Migrations applied
Webhook set: https://v2202504269079335176.supersrv.de/ws-webhook
```

Ошибки «connection refused» к Redis или PostgreSQL — значит, сервисы ещё не готовы. Подожди 10 секунд и перезапусти:
```bash
docker-compose restart backend-writershadow
```

### 4.3 Проверить webhook вручную

```bash
curl https://v2202504269079335176.supersrv.de/ws-webhook \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"update_id": 1}'
```

Ответ должен быть `{"ok":true}`.

### 4.4 Проверить бота

1. Открой чат с ботом в Telegram
2. Отправь `/start`
3. Пройди все шаги настройки
4. Напиши что-нибудь в группу черновиков
5. Выполни `/stats` — должны появиться данные
6. Выполни `/combine` → выбери черновики → `/post` → опубликуй

---

## Часть 5. После деплоя (при обновлениях)

```bash
cd /path/to/writershadow
git pull

cd /path/to/comparity
docker-compose build backend-writershadow
docker-compose up -d backend-writershadow
docker-compose logs -f backend-writershadow
```

---

## Часть 6. Управление подписками

### Активировать Pro-подписку пользователю

Когда пользователь оплатил и написал тебе:

1. Открой чат с ботом
2. Отправь: `/admin grant @username` (или `/admin grant @username 30` для 30 дней)

Бот автоматически уведомит пользователя об активации.

### Проверить активных подписчиков

```
/admin list
```

### Отозвать подписку

```
/admin revoke @username
```

---

## Часть 7. Мониторинг

### Проверить логи

```bash
docker-compose logs backend-writershadow --tail 100
```

### Посмотреть нагрузку

```bash
docker stats backend-writershadow
```

### Проверить БД вручную

```bash
docker exec -it <postgres-контейнер> psql -U writershadow -d writershadow
```

Полезные запросы:
```sql
-- Все пользователи
SELECT id, username, ai_provider, subscription_status FROM users;

-- Статистика за неделю
SELECT user_id, SUM(chars_written), SUM(drafts_count)
FROM daily_stats
WHERE date >= NOW() - INTERVAL '7 days'
GROUP BY user_id;
```

---

## Часть 8. Что делать пользователю (инструкция для первого запуска)

Дай пользователю эти шаги:

1. Добавь [@writershadow_bot](https://t.me/writershadow_bot) в свой канал как **администратора** с правом "Публикация сообщений"
2. Добавь бота в свою **группу черновиков** как участника
3. Открой личный чат с ботом и напиши `/start`
4. Следуй инструкциям: укажи канал, затем группу
5. Настрой AI-ассистента: `/setai` (можно начать с бесплатного Groq)
6. Начни писать в группе черновиков — бот будет молча всё считать

---

## Быстрый справочник переменных окружения

| Переменная | Где взять | Обязательная |
|---|---|---|
| `WRITERSHADOW_BOT_TOKEN` | BotFather → `/newbot` | Да |
| `WRITERSHADOW_DB_PASS` | Придумать при создании БД | Да |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | Нет (нужен для Pro-подписки) |
| `ENCRYPTION_KEY` | `node -e "..."` (шаг 3.2) | Да |
| `ADMIN_USER_ID` | @userinfobot | Да |
| `OWNER_CONTACT` | Твой @username | Да |
