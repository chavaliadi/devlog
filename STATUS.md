# Devlog Project Status — Phase 1 & 2 Completed

This file outlines the current completed work, the running configuration, and the tasks remaining for the next phase.

---

## ✅ What is Completed

### 1. Ingestion Pipeline & Database
- **GitHub Webhooks**: Signed webhook receiver in backend (`POST /webhook/github`) verifying payload authenticity using timing-safe HMAC checks.
- **Queue System**: Decoupled async commit processing using `BullMQ` and `Redis` (listening on default port `6379`).
- **Idempotency**: Automatic database duplicate commit prevention handling.
- **Database**: Local `PostgreSQL 17` instance configured on **Port `5435`** to prevent collisions. Schemas successfully migrated and database seeded with default user `chavaliadi`.

### 2. AI daily Summary Engine
- **Groq Integration**: Custom client connecting to Groq completions API (`llama-3.3-70b-versatile` by default) using standard `fetch` with no extra SDK overhead.
- **Timezone date filters**: Dynamic, timezone-aware commit grouping based on user timezone configuration (defaults to `Asia/Kolkata`).
- **Markdown Compiler**: Auto-generates clean, structured technical markdown entries containing Overviews, Key Changes, and Deep Dives.

### 3. Chron scheduler
- **Nightly triggers**: Check running hourly via `node-cron`. Triggers automatic AI summary generation when it hits 11:00 PM (23:00) in each user's configured timezone.

### 4. REST API & Endpoints
- **Endpoints mapping**:
  - `GET /api/entries` — List daily logs sorted by date.
  - `GET /api/entries/:id` — Detail view of a single log.
  - `PATCH /api/entries/:id` — Save modifications or publish a draft.
  - `DELETE /api/entries/:id` — Remove daily log.
  - `GET /api/commits` — Ingested commits list.
  - `POST /api/entries/trigger-summary` — Manually trigger AI compilation for tests or custom dates.

### 5. Frontend Dashboard UI
- **Port config**: Frontend is running on dedicated port **`5170`** (at `http://localhost:5170`).
- **Theme**: Premium dark-theme aesthetics with glassmorphic cards, custom typography (Inter font), smooth hover effects, and custom scrollbars.
- **Components**:
  - `Sidebar` navigation.
  - Dashboard `Stats` (Total Commits, Summarized Days, Drafts, Published).
  - Logs `Timeline` list with draft/published badges.
  - Gated split-screen Markdown `Editor` and preview pane.
  - Injected daily commits inspector drawer in the editor.
  - Ingested commits historical viewer feed.
  - Recruiter Portfolio reader view for showcasing published entries.

---

## ❌ What is Left (Next Phase)

### 1. GitHub OAuth Login Flow
- **API Redirection**: Add `/api/auth/github` backend redirect route to GitHub's authorization gateway.
- **Token Exchange**: Add `/api/auth/github/callback` callback route to trade authorization codes for user access tokens, retrieve GitHub details (avatar, username, email), and upsert users.
- **Session Management**: Add signed cookie-based session management using `cookie-session` in the backend.

### 2. Route Security Gating
- Replace the hardcoded `chavaliadi` defaults on the REST APIs.
- Protect all endpoints (`GET /api/entries`, `/api/commits`, etc.) with auth middleware that parses the session user ID, returning `401 Unauthorized` for unauthenticated queries.

### 3. Frontend Gating & Logout
- Intercept page routing to check `/api/auth/me` on startup.
- Redirect to a premium Login page with a "Connect with GitHub" button if unauthenticated.
- Wire up a "Sign Out" button to delete cookies.

### 4. Optional Improvements
- **Credentials Encryption**: Encrypt the GitHub user `accessToken` stored in PostgreSQL using `aes-256-gcm` keys.
- **CORS Lock**: Lock CORS origins to the specific dev port in config.
