# WriterShadow → WriterShadowLink: LinkedIn Adaptation Analysis

## Part 1: How WriterShadow Works (Principles)

### Core Architecture
WriterShadow is a **Telegram bot** that helps blog authors write consistently. It runs as a Node.js service with Fastify HTTP server, PostgreSQL database, Redis cache, and Telegraf bot framework.

### The 7 Core Functions

| # | Function | How It Works |
|---|----------|-------------|
| 1 | **Daily reminders** | Cron job checks every 5 min, compares user's local time (via timezone) to their reminder_time, uses Redis locks to prevent duplicates |
| 2 | **Draft tracking** | Bot monitors a Telegram draft group — every message is saved as a draft with char count, daily_stats UPSERT'd |
| 3 | **Draft combining** | User selects drafts by number, texts joined with `\n\n`, saved as a "draft post" in posts table |
| 4 | **Publishing** | Bot sends combined text to the user's Telegram channel via `sendMessage`, updates post status to "published" |
| 5 | **Statistics** | Aggregated daily_stats: chars_written, drafts_count, posts_published — shown for today/week/month with % dynamics |
| 6 | **AI suggestions** | Last 15 published posts sent to Claude Haiku or Groq Llama, AI suggests a new topic in author's style |
| 7 | **Evening nudge** | If user wrote 0 chars by evening, sends motivational message |

### Key Design Principles
1. **Telegram is both input AND output** — drafts come in via Telegram, posts go out via Telegram
2. **Minimal friction** — write anywhere (phone/desktop), bot captures it
3. **Timezone-aware scheduling** — each user has their own timezone
4. **Redis for idempotency** — locks prevent duplicate reminders/nudges
5. **AI is optional** — works without AI, AI enhances with suggestions
6. **Shared infrastructure** — same PostgreSQL/Redis/VPS as Comparity
7. **Stateless webhook** — session in Redis, no in-memory state

---

## Part 2: Adapting for LinkedIn Authors

### The Challenge
LinkedIn is fundamentally different from Telegram channels:
- **No bot API for LinkedIn** — can't monitor a "draft group" on LinkedIn
- **LinkedIn API requires OAuth** — user must authorize the app
- **Publishing to LinkedIn** uses the Share/Posts API (requires app review)
- **Reading user's own posts** requires the Posts API with specific permissions
- **LinkedIn has no real-time webhooks** for new posts

### What LinkedIn Authors Need (Same Problems, Different Platform)
1. Reminder to write/post on LinkedIn regularly
2. A place to capture draft ideas quickly
3. Analysis of their past LinkedIn posts (style, topics, frequency)
4. AI-powered suggestions for new LinkedIn posts
5. Statistics on their LinkedIn posting consistency
6. Ability to publish drafts to LinkedIn
7. Engagement tracking (likes, comments, reposts)

---

## Part 3: Delivery Options Evaluated

### Option A: Telegram Bot + LinkedIn API (RECOMMENDED)

**How it works**: Same Telegram bot concept as WriterShadow, but publishes to LinkedIn instead of a Telegram channel.

| Pros | Cons |
|------|------|
| Same familiar interface (Telegram for drafting) | Requires LinkedIn OAuth setup (one-time) |
| Instant draft capture from phone/desktop | LinkedIn API app review needed |
| Push notifications for reminders (Telegram) | Token refresh needed (60-day LinkedIn tokens) |
| Can share 90% of writershadow codebase | Two platforms to manage |
| Same VPS, same DB, same Redis | |
| Users can use both tools simultaneously | |

**LinkedIn API Requirements**:
- `w_member_social` — Post on behalf of user
- `r_liteprofile` / `openid` — Read profile
- `r_organization_social` (optional) — Read engagement stats

### Option B: Browser Extension

**How it works**: Chrome/Firefox extension that adds features to LinkedIn's web UI.

| Pros | Cons |
|------|------|
| Directly integrated into LinkedIn UI | Complex to build and maintain |
| Can scrape user's own posts easily | Chrome Web Store review process |
| Can show stats overlay | No mobile support |
| No API permissions needed for reading | Breaks when LinkedIn changes DOM |
| | Can't send push reminders |
| | Can't work when browser is closed |

### Option C: Web App + Email Notifications

**How it works**: Standalone web dashboard where user writes drafts, with email reminders.

| Pros | Cons |
|------|------|
| No dependency on Telegram | Higher friction (open browser, navigate to app) |
| Rich web editor for drafts | Email notifications often ignored |
| Full control over UI/UX | Need to build full frontend |
| Works on any device | More complex deployment |

### Option D: Email-Only Bot

**How it works**: User emails drafts, bot processes and publishes.

| Pros | Cons |
|------|------|
| Universal (everyone has email) | Very high friction for drafting |
| No app installation needed | Email parsing is unreliable |
| | No real-time interaction |
| | Poor UX for draft management |

---

## Part 4: Recommendation — Hybrid Approach

### Primary: Telegram Bot + LinkedIn API
### Secondary (Phase 2): Lightweight Browser Extension

The **Telegram bot** handles:
- Draft capture and management (same as writershadow)
- Reminders and nudges
- AI suggestions
- Publishing to LinkedIn
- Statistics

The **browser extension** (later) adds:
- One-click import of past LinkedIn posts
- "Save idea" button while browsing LinkedIn
- Engagement stats overlay on your posts

---

## Part 5: WriterShadowLink — Detailed Architecture

### Name: **WriterShadowLink** (WSL)

### Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | Node.js 20 LTS | Same as WriterShadow |
| Telegram | Telegraf v4 | Same as WriterShadow |
| HTTP server | Fastify v4 | Serves OAuth callback + analytics + webhook |
| Database | PostgreSQL 15 | Same instance, separate DB `writershadowlink` |
| Cache/sessions | Redis 7 | Same instance, prefix `wsl:` |
| Scheduler | node-cron | Same as WriterShadow |
| AI | Anthropic Claude Haiku 4.5 | Same as WriterShadow |
| LinkedIn | LinkedIn Marketing API v2 | OAuth 2.0 + Posts API |
| Container | Docker + Docker Compose | Same stack as WriterShadow |

### File Structure

```
writershadowlink/
├── Dockerfile
├── .env.example
├── package.json
├── public/
│   ├── oauth-success.html      # LinkedIn OAuth callback success page
│   └── analytics.html          # Admin analytics dashboard
├── src/
│   ├── index.js                # Entry point: Fastify + webhook
│   ├── bot/
│   │   ├── index.js            # Telegraf bot instance
│   │   ├── commands/
│   │   │   ├── start.js        # /start — registration and LinkedIn connect
│   │   │   ├── connect.js      # /connect — LinkedIn OAuth flow
│   │   │   ├── settings.js     # /settings — reminder settings
│   │   │   ├── setai.js        # /setai — AI provider setup
│   │   │   ├── subscribe.js    # /subscribe — Pro subscription info
│   │   │   ├── stats.js        # /stats — writing + LinkedIn engagement stats
│   │   │   ├── drafts.js       # /drafts — list drafts
│   │   │   ├── new.js          # /new — create draft in private chat
│   │   │   ├── combine.js      # /combine — assemble post from drafts
│   │   │   ├── post.js         # /post — publish to LinkedIn
│   │   │   ├── suggest.js      # /suggest — AI-powered topic idea
│   │   │   ├── import.js       # /import — import past LinkedIn posts
│   │   │   ├── preview.js      # /preview — preview post with LinkedIn formatting
│   │   │   ├── delete.js       # /delete — delete a draft
│   │   │   └── admin.js        # /admin — owner commands
│   │   ├── handlers/
│   │   │   ├── draftMessage.js # Track messages in private chat as drafts
│   │   │   └── callbackQuery.js# Inline button handler
│   │   └── middleware/
│   │       ├── redisSession.js # Redis session middleware
│   │       ├── commandLogger.js# Command logging
│   │       ├── requireSetup.js # Ensure user completed setup
│   │       └── requireAdmin.js # Admin-only commands
│   ├── db/
│   │   ├── index.js            # Connection pool (pg)
│   │   ├── migrations/
│   │   │   └── 001_initial.sql # All tables
│   │   └── models/
│   │       ├── user.js
│   │       ├── draft.js
│   │       ├── post.js
│   │       ├── dailyStats.js
│   │       └── commandLog.js
│   ├── redis/
│   │   └── client.js           # Redis with wsl: prefix
│   ├── scheduler/
│   │   └── reminders.js        # Daily reminders + weekly summary + token refresh
│   ├── linkedin/
│   │   ├── oauth.js            # OAuth 2.0 flow (authorize, token exchange, refresh)
│   │   ├── posts.js            # Create/read LinkedIn posts
│   │   ├── profile.js          # Read user profile
│   │   └── analytics.js        # Read post engagement (likes, comments, shares)
│   ├── ai/
│   │   ├── provider.js         # AI provider router
│   │   ├── anthropic.js        # Anthropic API
│   │   ├── groq.js             # Groq API
│   │   ├── prompt.js           # Prompt builder (adapted for LinkedIn context)
│   │   └── sanitize.js         # Prompt injection protection
│   ├── crypto/
│   │   └── keys.js             # AES-256-GCM encryption for API keys + tokens
│   └── utils/
│       └── timezone.js         # Timezone resolution
```

### Database Schema

```sql
-- Users
CREATE TABLE IF NOT EXISTS users (
  id                      SERIAL PRIMARY KEY,
  telegram_user_id        BIGINT UNIQUE NOT NULL,
  username                TEXT,

  -- LinkedIn connection
  linkedin_user_id        TEXT,           -- LinkedIn member URN (e.g., "urn:li:person:abc123")
  linkedin_access_token   TEXT,           -- Encrypted OAuth access token
  linkedin_refresh_token  TEXT,           -- Encrypted OAuth refresh token
  linkedin_token_expires  TIMESTAMPTZ,   -- When access token expires
  linkedin_name           TEXT,           -- Display name from LinkedIn
  linkedin_connected      BOOLEAN DEFAULT FALSE,

  -- Reminders
  reminder_time           TIME DEFAULT '09:00',
  timezone                TEXT DEFAULT 'Europe/Moscow',
  reminder_enabled        BOOLEAN DEFAULT TRUE,
  evening_nudge_enabled   BOOLEAN DEFAULT FALSE,
  evening_nudge_time      TIME DEFAULT '21:00',
  weekly_summary_enabled  BOOLEAN DEFAULT TRUE,

  -- AI provider
  ai_provider             TEXT DEFAULT 'none'
                            CHECK (ai_provider IN ('none', 'groq', 'anthropic', 'paid')),
  ai_key_encrypted        TEXT,

  -- Subscription
  subscription_status     TEXT DEFAULT 'inactive'
                            CHECK (subscription_status IN ('inactive', 'active', 'expired')),
  subscription_expires_at TIMESTAMPTZ,

  is_active               BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Posts (LinkedIn publications)
CREATE TABLE IF NOT EXISTS posts (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linkedin_post_id    TEXT,              -- LinkedIn post URN after publishing
  text                TEXT NOT NULL,
  char_count          INTEGER NOT NULL,
  status              TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at        TIMESTAMPTZ,
  -- LinkedIn engagement (updated periodically)
  likes_count         INTEGER DEFAULT 0,
  comments_count      INTEGER DEFAULT 0,
  shares_count        INTEGER DEFAULT 0,
  impressions_count   INTEGER DEFAULT 0,
  engagement_updated  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Drafts
CREATE TABLE IF NOT EXISTS drafts (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id  BIGINT,                   -- Telegram message ID (nullable for web drafts)
  chat_id     BIGINT,                   -- Telegram chat ID
  text        TEXT NOT NULL,
  char_count  INTEGER NOT NULL,
  is_used     BOOLEAN DEFAULT FALSE,
  post_id     INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Daily statistics
CREATE TABLE IF NOT EXISTS daily_stats (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  chars_written   INTEGER DEFAULT 0,
  drafts_count    INTEGER DEFAULT 0,
  posts_published INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

-- Imported LinkedIn posts (for AI analysis)
CREATE TABLE IF NOT EXISTS imported_posts (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linkedin_id TEXT,                      -- LinkedIn post URN
  text        TEXT NOT NULL,
  char_count  INTEGER NOT NULL,
  posted_at   TIMESTAMPTZ,
  likes       INTEGER DEFAULT 0,
  comments    INTEGER DEFAULT 0,
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Command logs
CREATE TABLE IF NOT EXISTS command_logs (
  id                SERIAL PRIMARY KEY,
  telegram_user_id  BIGINT,
  command           TEXT,
  status            TEXT DEFAULT 'success',
  error_message     TEXT,
  data              JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_drafts_user_unused ON drafts(user_id) WHERE is_used = FALSE;
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_user_date ON daily_stats(user_id, date);
CREATE INDEX IF NOT EXISTS idx_imported_posts_user ON imported_posts(user_id);
```

### Environment Variables

```env
# Telegram
BOT_TOKEN=<writershadowlink_bot_token>
BOT_WEBHOOK_URL=https://v2202504269079335176.supersrv.de/wsl-webhook

# Server
PORT=3002

# Database
DATABASE_URL=postgresql://writershadowlink:wsl_pass@postgres:5432/writershadowlink

# Redis
REDIS_URL=redis://redis:6379
REDIS_KEY_PREFIX=wsl:

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=<linkedin_app_client_id>
LINKEDIN_CLIENT_SECRET=<linkedin_app_client_secret>
LINKEDIN_REDIRECT_URI=https://v2202504269079335176.supersrv.de/wsl/oauth/callback

# AI
ANTHROPIC_API_KEY=<owner_anthropic_key>

# Encryption
ENCRYPTION_KEY=<64_hex_chars>

# Admin
ADMIN_USER_ID=<your_telegram_user_id>
OWNER_CONTACT=@writershadow

# Environment
NODE_ENV=production
```

---

## Part 6: Function-by-Function Mapping

### 1. Registration & LinkedIn Connect

**WriterShadow**: `/start` → set channel → set draft group → done
**WriterShadowLink**: `/start` → `/connect` → OAuth on web → linked → done

Flow:
1. User sends `/start` in Telegram
2. Bot replies: "I'm WriterShadowLink — I help you post on LinkedIn consistently."
3. Bot sends `/connect` button with OAuth URL
4. User clicks link → LinkedIn OAuth page → authorizes app
5. Callback hits `/wsl/oauth/callback` on server
6. Server exchanges code for tokens, stores encrypted tokens in DB
7. Bot sends confirmation: "LinkedIn connected! Your profile: [name]"

**No draft group needed** — in WriterShadowLink, the user writes drafts directly in private chat with the bot (like `/new` in WriterShadow) or simply sends any text message.

### 2. Draft Tracking

**WriterShadow**: Messages in draft group are auto-captured
**WriterShadowLink**: Messages in private chat with bot are auto-captured

Any text message sent to the bot in private chat (that isn't a command or part of a setup flow) is saved as a draft. Same logic: save text, char_count, upsert daily_stats.

Additionally: `/new` command prompts user to type a draft.

### 3. Draft Combining → LinkedIn Post

**WriterShadow**: `/combine` → select drafts → `/post` → publish to Telegram channel
**WriterShadowLink**: `/combine` → select drafts → `/preview` → `/post` → publish to LinkedIn

Added step: `/preview` shows the post formatted as it would appear on LinkedIn (with character limit warnings — LinkedIn posts are truncated at ~3000 chars with "...see more" at ~210 chars).

Publishing uses LinkedIn Posts API:
```
POST https://api.linkedin.com/rest/posts
{
  "author": "urn:li:person:{id}",
  "commentary": "{text}",
  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED"
  },
  "lifecycleState": "PUBLISHED"
}
```

### 4. Statistics

**WriterShadow**: chars/drafts/posts per day/week/month
**WriterShadowLink**: Same + LinkedIn engagement metrics

Additional stats:
- Total LinkedIn impressions this week/month
- Average likes per post
- Average comments per post
- Best performing post (most engagement)
- Posting streak (consecutive days with a post)

Engagement data is fetched periodically (every 6 hours) for recent posts via LinkedIn Social Actions API.

### 5. AI Suggestions

**WriterShadow**: Analyzes last 15 Telegram channel posts, suggests a new topic
**WriterShadowLink**: Analyzes last 15 LinkedIn posts (imported or published through bot), suggests a new topic optimized for LinkedIn

The prompt is adapted for LinkedIn context:
- Suggests topics that work well on LinkedIn
- Considers professional audience
- Mentions optimal post structure (hook + story + takeaway)
- Can reference engagement data (what topics got more engagement)

### 6. Reminders & Nudges

**WriterShadow**: Telegram message reminders
**WriterShadowLink**: Same — Telegram message reminders

Identical mechanism. The reminder includes LinkedIn-specific context:
- "You haven't posted on LinkedIn this week"
- "Your last LinkedIn post got X likes — keep the momentum!"

### 7. Import Past Posts

**WriterShadow**: User uploads Telegram JSON export
**WriterShadowLink**: `/import` command fetches user's recent LinkedIn posts via API

```
GET https://api.linkedin.com/rest/posts?author=urn:li:person:{id}&q=author&count=50
```

Stores posts in `imported_posts` table for AI analysis.

### 8. LinkedIn Token Management

New function not in WriterShadow:
- LinkedIn access tokens expire in 60 days
- Refresh tokens expire in 365 days
- Scheduler checks daily for tokens expiring within 7 days
- Sends Telegram reminder: "Your LinkedIn connection expires in X days. /connect to refresh"
- Auto-refreshes if refresh token is valid

---

## Part 7: Docker & Deployment

### Dockerfile
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
COPY public/ ./public/
EXPOSE 3002
CMD ["node", "src/index.js"]
```

### docker-compose.yml addition (in Comparity repo)
```yaml
  backend-writershadowlink:
    build: ../writershadowlink
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3002
      BOT_TOKEN: ${WSL_BOT_TOKEN}
      BOT_WEBHOOK_URL: https://v2202504269079335176.supersrv.de/wsl-webhook
      DATABASE_URL: postgresql://writershadowlink:${WSL_DB_PASS}@postgres:5432/writershadowlink
      REDIS_URL: redis://redis:6379
      REDIS_KEY_PREFIX: wsl:
      LINKEDIN_CLIENT_ID: ${LINKEDIN_CLIENT_ID}
      LINKEDIN_CLIENT_SECRET: ${LINKEDIN_CLIENT_SECRET}
      LINKEDIN_REDIRECT_URI: https://v2202504269079335176.supersrv.de/wsl/oauth/callback
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      ENCRYPTION_KEY: ${WSL_ENCRYPTION_KEY}
      ADMIN_USER_ID: ${ADMIN_USER_ID}
      OWNER_CONTACT: ${OWNER_CONTACT}
    depends_on:
      - postgres
      - redis
    networks:
      - app-network
```

### Caddyfile additions
```caddyfile
# WriterShadowLink
reverse_proxy /wsl-webhook backend-writershadowlink:3002
reverse_proxy /wsl/* backend-writershadowlink:3002
```

---

## Part 8: LinkedIn App Setup Requirements

To use the LinkedIn API, you need to create a LinkedIn App:

1. Go to https://www.linkedin.com/developers/apps
2. Create a new app
3. Request the following products/permissions:
   - **Share on LinkedIn** — enables `w_member_social` (post on behalf of user)
   - **Sign In with LinkedIn using OpenID Connect** — enables `openid`, `profile`, `email`
4. Set OAuth 2.0 redirect URL: `https://v2202504269079335176.supersrv.de/wsl/oauth/callback`
5. Note the Client ID and Client Secret

### Permissions Needed

| Permission | Purpose | Review Required? |
|-----------|---------|-----------------|
| `openid` | Sign in / identify user | No (OpenID Connect) |
| `profile` | Read user's name and photo | No (OpenID Connect) |
| `w_member_social` | Post on behalf of user | No (Share on LinkedIn product) |

### What About Reading Posts?

Reading a user's own posts (`r_member_social`) requires the **Community Management API** product, which needs LinkedIn review. Two approaches:

**Approach A (recommended initially)**: User pastes their LinkedIn post URLs, or exports their data from LinkedIn settings (Settings → Get a copy of your data → Posts). Bot parses the export.

**Approach B (if approved)**: After LinkedIn approves the Community Management API, the bot can directly fetch user's posts via API.

---

## Part 9: Bot Commands (for BotFather)

```
start - Start and connect LinkedIn
connect - Connect/reconnect LinkedIn account
settings - Reminder settings
setai - Set up AI assistant
subscribe - WriterShadowLink Pro subscription
stats - Writing and LinkedIn statistics
drafts - List your drafts
new - Create a new draft
combine - Assemble post from drafts
preview - Preview post for LinkedIn
post - Publish to LinkedIn
suggest - AI-powered post idea
import - Import past LinkedIn posts
delete - Delete a draft
```

---

## Part 10: Implementation Order

### Phase 1: Core Bot (Weeks 1-2)
1. Scaffold: package.json, Dockerfile, .env.example, src/index.js
2. Database: migrations, connection pool, models
3. Redis + crypto: session storage, key encryption
4. Basic bot: /start, session middleware, command logger
5. Draft tracking: private chat message capture, /new, /drafts, /delete
6. Combining: /combine
7. Statistics: /stats (writing stats only)
8. Reminders: daily reminder, evening nudge, weekly summary
9. Settings: /settings with timezone and toggle buttons

### Phase 2: LinkedIn Integration (Weeks 2-3)
10. LinkedIn OAuth: /connect, callback endpoint, token storage
11. LinkedIn publishing: /preview, /post → LinkedIn Posts API
12. LinkedIn import: /import → paste posts or data export
13. Engagement tracking: periodic fetch of likes/comments/shares
14. Enhanced stats: LinkedIn metrics in /stats

### Phase 3: AI (Week 3)
15. AI providers: /setai, /subscribe, Groq + Anthropic integration
16. AI suggestions: /suggest with LinkedIn-optimized prompts
17. AI-enhanced reminders: include suggested topic in daily reminder

### Phase 4: Polish & Deploy (Week 4)
18. Admin commands: /admin grant/revoke/list/stats
19. Analytics web dashboard
20. Docker + docker-compose integration
21. Caddyfile + deployment
22. Token refresh scheduler
23. Error handling and edge cases

---

## Part 11: Key Differences from WriterShadow

| Aspect | WriterShadow | WriterShadowLink |
|--------|-------------|-----------------|
| Target platform | Telegram channel | LinkedIn |
| Draft input | Telegram draft group | Private chat with bot |
| Publishing | `sendMessage` to channel | LinkedIn Posts API |
| Auth | None (Telegram native) | LinkedIn OAuth 2.0 |
| Content analysis source | Telegram channel posts | Imported LinkedIn posts |
| Token management | N/A | 60-day token refresh |
| Engagement stats | N/A | Likes, comments, shares, impressions |
| Post format concerns | Plain text | LinkedIn formatting (3000 char limit, hook optimization) |
| Webhook endpoint | `/ws-webhook` | `/wsl-webhook` |
| Port | 3001 | 3002 |
| DB name | writershadow | writershadowlink |
| Redis prefix | `writershadow:` | `wsl:` |

---

## Part 12: Code Reuse from WriterShadow

These modules can be copied and adapted with minimal changes:
- `src/redis/client.js` — change prefix
- `src/crypto/keys.js` — identical
- `src/db/index.js` — identical
- `src/ai/sanitize.js` — identical
- `src/ai/anthropic.js` — identical
- `src/ai/groq.js` — identical
- `src/ai/provider.js` — identical
- `src/ai/prompt.js` — adapt prompt for LinkedIn context
- `src/bot/middleware/*` — identical
- `src/bot/commands/settings.js` — minor adaptations
- `src/bot/commands/setai.js` — identical
- `src/bot/commands/subscribe.js` — change branding
- `src/bot/commands/stats.js` — add LinkedIn engagement data
- `src/bot/commands/drafts.js` — identical
- `src/bot/commands/combine.js` — identical
- `src/bot/commands/delete.js` — identical
- `src/bot/commands/admin.js` — minor adaptations
- `src/scheduler/reminders.js` — add LinkedIn-specific messages + token refresh
- `src/utils/timezone.js` — identical

New modules to build:
- `src/linkedin/oauth.js` — OAuth 2.0 flow
- `src/linkedin/posts.js` — Create posts on LinkedIn
- `src/linkedin/profile.js` — Read user profile
- `src/linkedin/analytics.js` — Read post engagement
- `src/bot/commands/connect.js` — LinkedIn connection command
- `src/bot/commands/import.js` — Import past posts
- `src/bot/commands/preview.js` — Preview with LinkedIn formatting
- `src/research/scraper.js` — Trend research (ported from linkedin-assistant)
- `src/research/ranker.js` — Post ranking by engagement potential
- `src/bot/commands/trends.js` — /trends command for daily digest

---

## Part 13: Existing linkedin-assistant — Integration Strategy

### What Already Exists

The `linkedin-assistant` repo is a **Python pipeline** that runs daily and:

1. **Scrapes** LinkedIn posts via DuckDuckGo search for configurable topics (AI, product management, game management, live-ops)
2. **Ranks** scraped posts by engagement potential using LLM (Groq `llama-3.3-70b-versatile` or Gemini)
3. **Generates comments** for top 5 posts — ready to paste on LinkedIn
4. **Suggests a topic** for a new post based on trending content
5. **Writes a full draft post** with hook, body, CTA, and hashtags
6. **Generates an image** via Pollinations.ai (free, no API key)
7. **Sends daily digest** to a single Telegram chat (not a bot — a one-way pipeline)

**Tech**: Python, DuckDuckGo search (ddgs library), Groq/Gemini for LLM, python-telegram-bot for sending, httpx for HTTP, Pollinations.ai for images. Runs via Windows Task Scheduler or cron.

### How to Integrate Into WriterShadowLink

The linkedin-assistant is a **content research engine**. WriterShadowLink is a **writing workflow tool**. They complement each other perfectly:

| linkedin-assistant Feature | WriterShadowLink Integration |
|---------------------------|------------------------------|
| DuckDuckGo scraping of trending posts | `/trends` command — on-demand or daily digest |
| LLM-powered post ranking | Shown in trends digest with engagement scores |
| Generated comments for top posts | Shown with "copy" button — user pastes on LinkedIn |
| Topic suggestion from trends | Merged into `/suggest` — combines user's style + trending topics |
| Full draft post generation | Available via `/generate` — creates a draft from trends |
| Image generation via Pollinations | Attached to `/generate` output as a photo in Telegram |
| Daily scheduled digest | Part of the daily reminder — "Here's what's trending in your topics" |

### Porting Strategy: Python → Node.js

The linkedin-assistant pipeline must be rewritten in Node.js to match WriterShadowLink's stack. This is straightforward:

| Python Component | Node.js Equivalent |
|-----------------|-------------------|
| `ddgs` (DuckDuckGo search) | `duck-duck-scrape` npm package or direct DDGS API via `fetch` |
| `httpx` | Built-in `fetch` (Node 20) |
| LLM calls via Groq REST API | Already exists in WriterShadow's `src/ai/groq.js` |
| `python-telegram-bot` | Already using Telegraf in WriterShadowLink |
| Pollinations.ai image gen | Same HTTP call via `fetch` |

### Enhanced Architecture with Research

```
writershadowlink/src/
├── research/
│   ├── scraper.js        # DuckDuckGo scraping for LinkedIn posts
│   ├── ranker.js         # LLM-powered post ranking
│   ├── commentGen.js     # Generate smart comments for posts
│   └── imageGen.js       # Generate images via Pollinations.ai
```

### New Commands from linkedin-assistant Integration

**`/trends`** — Show today's top LinkedIn posts in your topics
- Triggers the scrape → rank → comment pipeline
- Shows top 5 posts with suggested comments
- Caches results in Redis for 12 hours

**`/generate`** — Generate a ready-to-post LinkedIn post from current trends
- Scrapes trends (or uses cached)
- Generates a full post with hook + body + CTA + hashtags
- Generates an accompanying image
- Saves as a draft — user can edit before publishing

**`/topics`** — Manage tracked topics
- Show current topics
- Add/remove topics
- Default topics from linkedin-assistant: AI, product management, game management, live-ops
- Per-user customization stored in DB

### Updated Database Schema Addition

```sql
-- User's tracked topics for trend research
CREATE TABLE IF NOT EXISTS user_topics (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, topic)
);

-- Cached trend research results
CREATE TABLE IF NOT EXISTS trend_posts (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic       TEXT NOT NULL,
  title       TEXT NOT NULL,
  snippet     TEXT NOT NULL,
  url         TEXT NOT NULL,
  rank        INTEGER,
  comment     TEXT,             -- AI-generated suggested comment
  scraped_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trend_posts_user_date ON trend_posts(user_id, scraped_at);
```

### Updated Users Table (add topics config)

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  topics_configured BOOLEAN DEFAULT FALSE;
```

---

## Part 14: Complete Feature Matrix

| # | Feature | WriterShadow | WriterShadowLink | Source |
|---|---------|-------------|-----------------|--------|
| 1 | Daily writing reminders | Yes | Yes | WriterShadow |
| 2 | Evening nudge | Yes | Yes | WriterShadow |
| 3 | Weekly summary | Yes | Yes | WriterShadow |
| 4 | Draft capture (Telegram) | Via draft group | Via private chat | WriterShadow (adapted) |
| 5 | Draft management (/drafts, /delete) | Yes | Yes | WriterShadow |
| 6 | Draft combining (/combine) | Yes | Yes | WriterShadow |
| 7 | Post preview | Basic | LinkedIn-formatted with char limits | New |
| 8 | Publishing | To Telegram channel | To LinkedIn via API | New |
| 9 | Writing statistics | Chars/drafts/posts | + LinkedIn engagement | WriterShadow + new |
| 10 | AI topic suggestions (/suggest) | Based on own posts | + trending topics | WriterShadow + linkedin-assistant |
| 11 | AI provider selection (/setai) | Groq/Anthropic/Pro | Same | WriterShadow |
| 12 | Import past posts | Telegram JSON export | LinkedIn API or paste | New |
| 13 | LinkedIn OAuth connection | N/A | /connect | New |
| 14 | Token refresh management | N/A | Auto + manual | New |
| 15 | Trending posts digest (/trends) | N/A | Yes | linkedin-assistant |
| 16 | Suggested comments for trending posts | N/A | Yes | linkedin-assistant |
| 17 | AI-generated full posts (/generate) | N/A | Yes | linkedin-assistant |
| 18 | AI-generated images for posts | N/A | Yes (Pollinations.ai) | linkedin-assistant |
| 19 | Topic tracking (/topics) | N/A | Yes | linkedin-assistant (adapted) |
| 20 | Admin commands | Yes | Yes | WriterShadow |
| 21 | Subscription management | Yes | Yes | WriterShadow |
| 22 | Prompt injection protection | Yes | Yes | WriterShadow |
| 23 | Engagement tracking | N/A | Likes/comments/shares/impressions | New |
| 24 | Posting streak tracking | N/A | Yes | New |

---

## Part 15: Updated Bot Commands (for BotFather)

```
start - Start and connect LinkedIn
connect - Connect/reconnect LinkedIn account
settings - Reminder and notification settings
setai - Set up AI assistant
subscribe - WriterShadowLink Pro subscription
stats - Writing and LinkedIn statistics
drafts - List your drafts
new - Create a new draft
combine - Assemble post from drafts
preview - Preview post for LinkedIn
post - Publish to LinkedIn
suggest - AI-powered post idea from your style
trends - Today's top LinkedIn posts in your topics
generate - AI-generate a full post from trends
topics - Manage your tracked topics
import - Import past LinkedIn posts
delete - Delete a draft
```

---

## Part 16: Updated Implementation Order

### Phase 1: Core Bot Framework (Steps 1-9)
Same as before — the writing workflow foundation.

### Phase 2: LinkedIn Integration (Steps 10-14)
OAuth, publishing, import, engagement tracking.

### Phase 3: AI + Research Engine (Steps 15-21)
1. AI providers: /setai, /subscribe, Groq + Anthropic
2. AI suggestions from own posts: /suggest
3. DuckDuckGo scraper (port from Python): `src/research/scraper.js`
4. LLM ranker (port from Python): `src/research/ranker.js`
5. Comment generator (port from Python): `src/research/commentGen.js`
6. Image generator (port from Python): `src/research/imageGen.js`
7. Commands: /trends, /generate, /topics

### Phase 4: Polish & Deploy (Steps 22-26)
Admin, analytics, Docker, Caddy, token refresh, edge cases.

---

## Part 17: Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| LinkedIn API app approval delayed | Medium | High (blocks publishing) | Start with draft workflow only; apply for API early |
| LinkedIn changes API/rate limits | Low | Medium | Abstract LinkedIn calls; implement retry + fallback |
| DuckDuckGo blocks scraping | Medium | Low (only affects trends) | Fallback: use Bing/Google search API; cache aggressively |
| LinkedIn OAuth token expiry not handled | Low | High (silent failure) | Proactive reminders 7 days before; auto-refresh |
| User exceeds LinkedIn API rate limits | Low | Medium | Queue posts; max 1 publish per 15 minutes per user |
| Pollinations.ai goes down | Low | Low (cosmetic) | Make image generation optional; skip gracefully |

---

## Part 18: Summary

**WriterShadowLink** = **WriterShadow** (writing discipline) + **linkedin-assistant** (content research) + **LinkedIn API** (publishing)

Three codebases merge into one unified tool:
1. **WriterShadow** provides the core: reminders, drafts, stats, AI, subscription, admin
2. **linkedin-assistant** provides the research: trend scraping, ranking, comments, image generation
3. **New LinkedIn module** provides the bridge: OAuth, publishing, engagement tracking

All running on the same VPS alongside WriterShadow and Comparity, sharing PostgreSQL and Redis infrastructure, containerized with Docker, served through Caddy reverse proxy.
