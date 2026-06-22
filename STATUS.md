# Devlog Project Status — Phase 1, 2 & 3 Completed

This file outlines the current completed work and the running configuration.

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

### 6. GitHub OAuth Login & Route Security (Phase 3)
- **API Redirection**: `/api/auth/github` backend redirect route to GitHub's authorization gateway.
- **Token Exchange & Encryption**: Callback route trades code for access token, encrypts the access token using `aes-256-gcm`, and upserts users in the database.
- **Session Management**: Cookie-based session tracking using signed cookies with `cookie-session` middleware.
- **Route Security Gating**: Gated REST APIs (`/api/entries`, `/api/commits`, etc.) with `requireAuth` middleware scoping queries to the session user.
- **CORS Locks**: Configured specific origin limits with credentials enabled.
- **Frontend Auth Gating**: Gated page routing with initial `/api/auth/me` checks, rendering a premium GitHub authentication login gate screen, and a "Sign Out" option in the Sidebar.

---

## ❌ What is Left
- None! All planned phases (Phases 1, 2, and 3) are fully completed, verified, and operational.
