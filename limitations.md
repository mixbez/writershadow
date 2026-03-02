# WriterShadow — Limitations & Hosting Constraints

## Overview

WriterShadow and Comparity are two separate Telegram bots hosted on the same server. This document outlines critical constraints to prevent conflicts and ensure both bots can coexist.

## Hosting Environment

**Shared Infrastructure:**
- Domain: `v2202504269079335176.supersrv.de`
- Reverse Proxy: Caddy (ports 80/443)
- Host: Single VPS with Docker Compose

---

## Critical Constraints

### 1. **Telegram Bot Token & Webhook**

**Comparity:**
- Bot Token: `${BOT_TOKEN}` (Comparity bot)
- Webhook URL: `${BOT_WEBHOOK_URL}`
- Webhook Path: `/webhook`

**WriterShadow Requirements:**
- ❌ **MUST use a different bot token** — Cannot share the same Telegram bot token
- ❌ **MUST use a different webhook path** — e.g., `/webhook/writershadow` or `/ws-webhook`
- ❌ **MUST NOT intercept** requests meant for Comparity

**Implementation:**
```javascript
// WriterShadow backend/src/index.js
if (process.env.NODE_ENV === 'production') {
  server.post('/ws-webhook', (req, reply) => {
    writerBot.handleUpdate(req.body);
    reply.send({ ok: true });
  });
  await writerBot.telegram.setWebhook(`${process.env.BOT_WEBHOOK_URL}/ws-webhook`);
}
```

---

### 2. **Database Isolation**

**Comparity:**
- PostgreSQL Database: `comparity`
- User: `comparity`
- Password: `comparity_pass`

**WriterShadow Requirements:**
- ❌ **MUST use a separate PostgreSQL database** — Do NOT use the `comparity` database
- ✅ Suggested database name: `writershadow`
- ✅ Suggested user: `writershadow`

**Implementation in docker-compose.yml:**
```yaml
postgres:
  environment:
    POSTGRES_INITDB_ARGS: -c shared_buffers=256MB
    # Create writershadow database if needed
    POSTGRES_MULTIPLE_DATABASES: comparity,writershadow
```

**Or create it manually:**
```sql
CREATE DATABASE writershadow;
CREATE USER writershadow WITH PASSWORD 'writershadow_pass';
GRANT ALL PRIVILEGES ON DATABASE writershadow TO writershadow;
```

---

### 3. **Redis Key Namespace Conflict**

**Comparity:**
- Uses Redis at `redis://redis:6379`
- Key pattern: `session:*`, `player:*`, `game:*` (no explicit prefix)

**WriterShadow Requirements:**
- ✅ **CAN share the same Redis instance** (recommended)
- ❌ **MUST NOT reuse key patterns** — Use a distinct prefix

**Implementation in redis/client.js:**
```javascript
const KEY_PREFIX = 'writershadow:';

async function setSession(sessionId, data) {
  await redis.setex(`${KEY_PREFIX}session:${sessionId}`, 3600, JSON.stringify(data));
}

async function getSession(sessionId) {
  return redis.get(`${KEY_PREFIX}session:${sessionId}`);
}
```

---

### 4. **Port Allocation**

**Comparity:**
- Backend: port 3000 (internal, routed via Caddy)
- Frontend: port 80 (internal)
- Caddy: ports 80/443 (external)

**WriterShadow Requirements:**
- ❌ **MUST NOT use port 3000** — Comparity backend already bound
- ✅ If deploying separately: use different port (e.g., 3001)
- ✅ If deploying in same Compose file: use service name as hostname (e.g., `writershadow-backend:3000`)

**Caddy Routing:**
```caddyfile
v2202504269079335176.supersrv.de {
  # Comparity routes
  reverse_proxy /api/* backend:3000
  reverse_proxy /webhook backend:3000

  # WriterShadow routes (if separate service)
  reverse_proxy /ws-api/* writershadow-backend:3000
  reverse_proxy /ws-webhook writershadow-backend:3000

  # Frontend
  reverse_proxy * frontend:80
}
```

---

### 5. **API Routes & Frontend**

**Comparity Routes:**
- `/api/sessions` — Comparity game sessions
- `/api/moves` — Game moves
- `/api/leaderboard` — Leaderboard

**WriterShadow Requirements:**
- ❌ **MUST NOT conflict with** `/api/*` routes
- ✅ Use `/ws-api/*` or similar prefix
- ✅ Or mount on different domain/subdomain (e.g., `writer.supersrv.de`)

**Example WriterShadow API routes:**
```javascript
// backend/src/api/index.js
app.post('/ws-api/reminders', handleReminder);
app.get('/ws-api/stats/:userId', getStats);
app.post('/ws-api/drafts', saveDraft);
```

---

### 6. **Environment Variables Isolation**

**Comparity .env:**
```
BOT_TOKEN=<comparity_bot_token>
BOT_WEBHOOK_URL=https://v2202504269079335176.supersrv.de/webhook
MINI_APP_URL=https://v2202504269079335176.supersrv.de
MINI_APP_SHORT_NAME=comparity
JWT_SECRET=<comparity_jwt>
DATABASE_URL=postgresql://comparity:comparity_pass@postgres:5432/comparity
REDIS_URL=redis://redis:6379
```

**WriterShadow .env (if separate service):**
```
BOT_TOKEN=<writershadow_bot_token>
BOT_WEBHOOK_URL=https://v2202504269079335176.supersrv.de/ws-webhook
MINI_APP_URL=https://v2202504269079335176.supersrv.de
JWT_SECRET=<writershadow_jwt>
DATABASE_URL=postgresql://writershadow:writershadow_pass@postgres:5432/writershadow
REDIS_URL=redis://redis:6379
REDIS_KEY_PREFIX=writershadow:
```

---

### 7. **Docker Compose Structure**

**Option A: Shared PostgreSQL & Redis (Recommended)**
```yaml
services:
  caddy: # Shared reverse proxy
  postgres: # Shared database (separate DBs)
  redis: # Shared cache (different key prefixes)

  # Comparity services
  backend-comparity:
    environment:
      DATABASE_URL: postgresql://comparity:comparity_pass@postgres:5432/comparity
      REDIS_URL: redis://redis:6379

  # WriterShadow services
  backend-writershadow:
    environment:
      DATABASE_URL: postgresql://writershadow:writershadow_pass@postgres:5432/writershadow
      REDIS_URL: redis://redis:6379
      REDIS_KEY_PREFIX: writershadow:
```

**Option B: Completely Separate Stacks**
- Run on different machines or separate Docker networks
- ⚠️ More resource-intensive
- ✅ Zero conflict risk

---

## Testing Checklist

Before deploying WriterShadow to production:

- [ ] Webhook path is different from Comparity (`/ws-webhook` ≠ `/webhook`)
- [ ] Bot token is unique (not shared with Comparity)
- [ ] PostgreSQL database is isolated (`writershadow` ≠ `comparity`)
- [ ] Redis key prefix is set and consistent (`writershadow:*`)
- [ ] API routes don't overlap (use `/ws-api/*` or subdomain)
- [ ] Caddy configuration routes correctly to both bots
- [ ] Both bots can receive webhook updates independently
- [ ] No port conflicts on the host machine
- [ ] Environment variables are isolated in docker-compose

---

## Deployment Strategy

1. **Create WriterShadow database:**
   ```sql
   CREATE DATABASE writershadow;
   CREATE USER writershadow WITH PASSWORD '<secure_password>';
   GRANT ALL PRIVILEGES ON DATABASE writershadow TO writershadow;
   ```

2. **Update Caddyfile** to route WriterShadow requests

3. **Add WriterShadow service** to docker-compose.yml with proper environment variables

4. **Test webhook delivery:**
   ```bash
   # Send test message to WriterShadow bot
   # Verify it hits /ws-webhook, not /webhook
   ```

5. **Monitor logs:**
   ```bash
   docker-compose logs -f backend-writershadow
   docker-compose logs -f backend-comparity
   ```

---

## Security Notes

- ⚠️ Both bots have access to the same Redis instance — ensure Redis is password-protected in production
- ⚠️ Both bots can access the same PostgreSQL server — use database-level isolation
- ⚠️ Different JWT secrets MUST be used to prevent token cross-validation

---

## References

- **Comparity Architecture:** `/home/user/comparity/docs/ARCHITECTURE.md`
- **Comparity Environment:** `/home/user/comparity/.env.example`
- **Caddy Config:** `/home/user/comparity/Caddyfile`
- **Docker Compose:** `/home/user/comparity/docker-compose.yml`
