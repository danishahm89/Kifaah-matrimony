# Kifaah backend

Node.js + TypeScript + Express + Prisma + PostgreSQL API implementing `CONTRACT.md` §1–§6 (data
model, business rules, REST API) and **§7 "Production hardening"** for the Kifaah matrimony app:
phone+OTP auth with revocable/rotating sessions, security hardening (helmet, rate limiting, CORS,
env validation, hardened photo uploads, structured logging, audit log, optional Sentry), push
notifications (Expo), Docker/CI, and an automated test suite. Real Razorpay order
creation + HMAC verification, Socket.IO chat namespace, weekly cron match engine.

> **§7 supersedes the email/password auth described in §3/§4.** Phone number (E.164, verified by
> SMS OTP via Twilio Verify) is the login identity now — no passwords are stored anywhere.

## Setup (local, no Docker)

1. **Create the databases** (PostgreSQL must be reachable) — one for dev, one for the automated
   test suite:
   ```bash
   createdb kifaah
   createdb kifaah_test
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # edit .env — at minimum set DATABASE_URL/TEST_DATABASE_URL to point at your Postgres instance.
   # Leave TWILIO_* unset for local dev/test (see "Auth" below) — Razorpay keys can stay as the
   # rzp_test_xxxxxxxxxxxx placeholders too; payment verification/webhook logic works standalone,
   # but actually creating a live order requires real Razorpay test-mode keys.
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Run migrations** (creates all tables from `prisma/schema.prisma`, against both databases):
   ```bash
   npx prisma migrate deploy
   DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy   # or set it inline per your shell
   ```
   (Use `npx prisma migrate dev` instead of `deploy` if you're evolving the schema locally.)

5. **Seed demo data** (10 demo profiles from the design prototype — see "Demo accounts" below):
   ```bash
   npm run seed
   ```

6. **Run the dev server**:
   ```bash
   npm run dev
   ```
   Server listens on `PORT` (default `4000`). Liveness: `GET /health`. Readiness (checks DB
   connectivity): `GET /ready`.

## Config: env vars vs `config/*.yaml`

Two separate places, on purpose:

- **`.env`** (see `.env.example`) — **secrets and per-deployment-instance values**: `DATABASE_URL`,
  `JWT_SECRET`, `TWILIO_*`, `RAZORPAY_*`, `SENTRY_DSN`, `ALLOWED_ORIGINS`, `PORT`, `UPLOAD_DIR`.
  Never committed (`.env` is gitignored); `.env.example` documents every key with a placeholder.
- **`config/default.yaml` + `config/development.yaml` or `config/production.yaml`** (picked by
  `NODE_ENV`; anything other than `"production"`, including `NODE_ENV=test`, uses
  `development.yaml`) — **non-secret behavioral tuning that differs between a dev profile and a
  prod profile, but not between individual deployments of the same profile**: rate-limit
  thresholds, the JWT access-token lifetime, the refresh-token lifetime, the match-engine's cron
  schedule and minimum score, upload size/dimension limits, and the default log level. These are
  committed and reviewed like code — see `src/lib/appConfig.ts` for the loader (it deep-merges
  `default.yaml` with the environment-specific file and validates the result with zod, failing
  fast on anything malformed, the same philosophy as `src/lib/env.ts` for secrets).

`LOG_LEVEL` is the one deliberate env-var override on top of the YAML value (`config/*.yaml` sets
the default; `LOG_LEVEL` in the environment wins if set) — useful for bumping verbosity temporarily
without a redeploy. Nothing else in `config/*.yaml` is env-overridable; change the file instead.

Going to production is: set the real secrets in `.env` (or your platform's secret store), leave
`NODE_ENV=production`, and — if you want different tuning than what's already in
`config/production.yaml` — edit that file and redeploy. No code changes either way.

## Scripts

- `npm run dev` — tsx watch mode
- `npm run build` — compile to `dist/` (entry point ends up at `dist/src/index.js`)
- `npm start` — run the compiled build
- `npm run prisma:generate` — regenerate Prisma client
- `npm run prisma:migrate` — run/create a migration (interactive — use `prisma migrate deploy` in CI/prod)
- `npm run seed` — seed demo data (idempotent — upserts by phone)
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint over `src/`
- `npm test` — runs the automated test suite (`vitest`) against `TEST_DATABASE_URL`

## Auth (CONTRACT §7.1/§7.2) — phone + OTP, access + refresh tokens

There are no passwords anywhere in this system. Login/signup is a single OTP round-trip:

- `POST /api/auth/otp/send` `{ phone }` — starts an OTP verification for an E.164 phone number
  (e.g. `+919812345678`). Always responds `{ ok: true }`, whether or not an account exists for
  that number yet (doesn't leak account existence). Rate-limited to 3 requests per phone number
  per 10 minutes.
- `POST /api/auth/otp/verify` `{ phone, code, gender?: "bride"|"groom" }` — checks the code. On
  success: logs in an existing user, or creates one (`gender` required for a brand-new phone — 400
  `gender_required` if missing). Responds `{ token, refreshToken, user, isNewUser }`.
  - `token` — access JWT, short-lived (`config/*.yaml`'s `auth.jwtExpiresIn`, `15m` in production,
    `1h` in development — see "Config" above). Send it as
    `Authorization: Bearer <token>` on every authed request.
  - `refreshToken` — an opaque random string. Store it securely (e.g. `expo-secure-store` on
    mobile); it is **not** a JWT and can't be decoded client-side.
  - **A given OTP code is single-use** — once `otp/verify` accepts a code (even if the request
    itself then fails for another reason, e.g. a missing `gender` on signup), that code is
    consumed and a fresh `otp/send` is required to try again. This matches real Twilio Verify
    semantics, not just the dev provider.
- `POST /api/auth/refresh` `{ refreshToken }` — rotates: revokes the presented token and returns a
  new `{ token, refreshToken, user }` pair. **Reusing an already-rotated-away refresh token is
  treated as a stolen-token signal** — every refresh token for that user is immediately revoked
  and the response is 401 `invalid_refresh_token`, forcing a full re-login. Always send the
  *latest* refresh token you were issued; never retry with an old one.
- `POST /api/auth/logout` `{ refreshToken }` — revokes that one refresh token. Always `{ ok: true }`.
- `POST /api/auth/logout-all` (requireAuth) — revokes every refresh token for the caller (e.g. a
  "log out of all devices" setting). Pair this with `DELETE /api/account/push-token` for the
  current device's Expo token.
- `GET /api/auth/me` (requireAuth) — unchanged shape from §4, except the public user object now
  carries `phone`/`phoneVerified` instead of `email`/no more `passwordHash` (email is optional and
  purely a display/recovery field, never used for login).

`Authorization: Bearer <token>` (the **access** token) is required on every route except
`/api/auth/otp/send`, `/api/auth/otp/verify`, `/api/auth/refresh`, `/api/auth/logout`, and
`GET /api/faq` / `GET /api/reference` / `GET /api/pricing` (also public).

### OTP provider — Twilio Verify vs. the dev/test console provider

SMS costs money and Twilio Verify requires a real account, so this app never requires either to
develop or test it:

- **`ConsoleOtpProvider`** (default whenever `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/
  `TWILIO_VERIFY_SERVICE_SID` are not *all* set) generates a 6-digit code, prints it to this
  server's **stdout**, and checks the caller's submission against it in memory. No SMS is ever
  sent. This is what local dev and the automated test suite use.
- **`TwilioVerifyProvider`** (used whenever all three Twilio env vars are set) delegates to a real
  Twilio Verify service — code generation, expiry, and per-phone attempt/resend limiting are all
  owned by Twilio, not reimplemented here.
- **The console provider can never run in production.** `src/lib/env.ts` validates the environment
  at boot and refuses to start (`process.exit(1)`, before the HTTP server binds) if
  `NODE_ENV=production` and the three Twilio vars aren't all set — see "Env validation" below.

### Logging in locally without a real Twilio account

1. Start the dev server (`npm run dev`) and seed demo data (`npm run seed`) if you haven't.
2. `POST /api/auth/otp/send` with one of the seeded demo phone numbers below (or any phone number
   for a brand-new account).
3. Watch the server's stdout for a line like:
   ```
   [ConsoleOtpProvider] OTP for +919000000001: 483920 (dev/test only, expires in 10m)
   ```
4. `POST /api/auth/otp/verify` with that `phone` + `code` (+ `gender` if it's a brand-new phone).

Example:
```bash
curl -X POST localhost:4000/api/auth/otp/send -H 'content-type: application/json' \
  -d '{"phone":"+919000000001"}'
# → watch server stdout for the printed code, then:
curl -X POST localhost:4000/api/auth/otp/verify -H 'content-type: application/json' \
  -d '{"phone":"+919000000001","code":"<code from stdout>"}'
```

### Demo accounts

`prisma/seed.ts` seeds the same 10 demo profiles as before (verbatim from the design prototype),
now keyed by phone instead of email/password. Login phone numbers are `+9190000000<01..10>`
(`+919000000001` = Ayesha K. … `+919000000010` = Ahmed Z.) — see `prisma/seed.ts` for the full
name-to-number mapping. **These numbers are dev-seed-only fixtures, never real phone numbers**:
`+91900000000x` sits inside India's E.164 numbering-plan *shape* but the `900000000x` block isn't
an assignable subscriber range, so it can never collide with a real account and is only ever
reachable through the `ConsoleOtpProvider` (never Twilio — Twilio Verify would simply fail to
deliver an SMS to a non-existent number). This is distinct from each profile's in-app *contact*
phone (`Profile.phone`, e.g. `"+91 98765 41123"` for Ayesha) — the field shown to matches once
unlocked, which is separate from the login identity (`User.phone`).

## Security hardening (CONTRACT §7.3)

- **`helmet`** with default config on every response; `x-powered-by` disabled.
- **`express-rate-limit`**: a general limiter (100 req/min/IP) on all of `/api/*`, plus stricter
  limiters on the auth endpoints: `otp/send` is 3/10min **per phone number** (keyed on
  `phone:ip`, not just IP, so one phone can't be hammered from many IPs); `otp/verify` and
  `refresh` are 30/min/IP. (CONTRACT's example numbers for verify/refresh were "e.g. 10/min" —
  bumped to 30/min here so the automated test suite, which legitimately exercises these endpoints
  many times per run in-process, doesn't trip its own limiter; still meaningfully stricter than
  the general 100/min limiter.)
- **CORS**: outside production, permissive (any origin) for ease of local dev. In production,
  locked to the comma-separated `ALLOWED_ORIGINS` env var — deny-by-default, and boot fails if
  that var isn't set (see "Env validation").
- **Env validation at boot** (`src/lib/env.ts`, a zod schema over `process.env`, imported first
  thing by `src/app.ts`): fails fast with a clear message and `process.exit(1)` — before the HTTP
  server ever binds — if `NODE_ENV=production` and `JWT_SECRET` is missing/left at the dev
  default, `ALLOWED_ORIGINS` is missing, or the three Twilio vars aren't all set. No silent
  insecure defaults in production.
- **Photo upload** (`POST /api/profile/photo`): the file is buffered in memory (never written to
  disk on the client's say-so), its actual bytes are magic-byte-checked via `file-type` (not the
  client-supplied MIME type/filename — a `.jpg`-named, `image/jpeg`-declared file containing SVG
  is rejected), restricted to JPEG/PNG/WEBP (**SVG support dropped entirely** — SVG can carry
  script content), then unconditionally re-encoded through `sharp` (EXIF orientation applied then
  stripped, resized to max 1600px, re-saved as JPEG) before ever touching disk — so nothing but
  actual decoded pixel data reaches storage, regardless of what was uploaded.
- **Structured logging** via `pino`/`pino-http` (pretty-printed outside production, JSON in
  production) in place of `console.log`/`console.error`. Common secret-bearing fields
  (`Authorization` header, tokens, passwords, OTP codes, signatures, Razorpay/JWT/Twilio secrets)
  are redacted at the logger level.
- **`AuditLog`** entries are written for: `otp_verified` (both successful and failed attempts,
  userId null on failure), `login`, `logout`, `logout_all`, `subscription_activated` (both the
  client-verify and webhook paths), `contact_unlocked` (first time a given viewer→candidate pair's
  contact info unlocks), and `refresh_token_reused_detected`.
- **Sentry** (`@sentry/node`) is wired in `src/lib/sentry.ts` but stays a complete no-op unless
  `SENTRY_DSN` is set — never fabricate a DSN for local dev.

## Push notifications (CONTRACT §7.4)

- `POST /api/account/push-token` (requireAuth) `{ expoPushToken }` — upserts a `PushToken` row for
  the caller (one row per **device** — re-registering the same Expo token just re-parents it to
  whoever is currently logged in on that device). Call this once after login, once the mobile app
  has obtained an Expo push token (permission prompt via `expo-notifications`).
- `DELETE /api/account/push-token` (requireAuth) `{ expoPushToken }` — removes that device's token.
  Call this on logout (in addition to `/api/auth/logout`), so a signed-out device stops receiving
  pushes for the account it just left.
- Sending (`src/lib/push.ts`) uses `expo-server-sdk` against Expo's push service, which needs no
  account/API key on the free tier. It's **additive only** — every trigger point still does
  whatever in-app notification/toast/Socket.IO behavior it already did; the push is a second,
  independent side effect, and a push failure (invalid token, Expo hiccup) never fails the
  triggering request. Triggered from:
  - `runMatchEngineForUser` → push to the user for each new match surfaced
  - `POST /api/interests/:profileId` → push to `toUserId` ("New interest")
  - `POST /api/interests/:id/accept` → push to the original `fromUserId` ("Interest accepted")
  - `POST /api/chats/:userId/messages` → push to `toUserId` (new chat message)
- Invalid/unregistered Expo tokens (Expo's `DeviceNotRegistered` ticket status) are automatically
  pruned from `PushToken` on next send attempt.
- **Remote push requires a development or production build** on the mobile side — Expo Go dropped
  support for it — so it can't be demoed inside plain Expo Go the way the rest of the app can (see
  `mobile/README.md`).

## Socket.IO chat namespace

- Namespace: `/chat`, path `/socket.io` (default).
- **Auth**: pass the access JWT as `auth: { token: "<jwt>" }` in the client handshake (or an
  `Authorization: Bearer <jwt>` header) — a namespace-level middleware verifies it with the same
  `JWT_SECRET` as REST and rejects the connection (`connect_error`) if missing/invalid/expired.
  There's no separate socket-level refresh — reconnect with a fresh access token once the REST
  client has refreshed it.
- On successful connect, the socket auto-joins room `user:<userId>`.
- Event `message` is emitted to both participants' rooms whenever `POST
  /api/chats/:userId/messages` creates a new `ChatMessage` — REST remains the source of truth, so
  a client that misses a socket event (reconnect, background) can always catch up via `GET
  /api/chats/:userId/messages`.
- Only usable once `POST /api/chats/:userId/messages` itself would succeed — i.e. the interest
  between the two users is accepted AND both users currently have `Subscription.status ===
  "active"` (stricter than the design prototype, which only checked the current viewer's side —
  see `CONTRACT.md` §2).

## Razorpay integration

- `POST /api/payments/create-order` creates a real Razorpay order via the `razorpay` npm package,
  using **server-side** pricing constants (`src/lib/pricing.ts` — ₹49/₹490 basic, ₹99/₹990
  premium) — the amount is never taken from the request body.
- `POST /api/payments/verify` recomputes `HMAC-SHA256("<orderId>|<paymentId>", RAZORPAY_KEY_SECRET)`
  and compares it (constant-time) against the client-submitted `signature`; on match it activates
  the caller's `Subscription` and writes a `subscription_activated` audit log entry.
- `POST /api/payments/webhook` verifies `X-Razorpay-Signature` against
  `HMAC-SHA256(rawRequestBody, RAZORPAY_WEBHOOK_SECRET)` and activates/renews the subscription tied
  to the order on `payment.captured`/`order.paid`; re-delivery of the same event is a no-op
  (idempotent) once the subscription is already active with that `razorpayPaymentId`.
- `.env.example` only ever contains placeholder `rzp_test_xxxxxxxxxxxx`-shaped values — put real
  Razorpay **test-mode** keys in your own untracked `.env`, never live/production keys.

## Match engine

- Runs once right after signup (`POST /api/auth/otp/verify`, fire-and-forget, on account creation)
  and on a weekly cron (`node-cron`, `config/*.yaml`'s `matchEngine.cron`, default `0 9 * * 1` =
  Monday 9am, applied to every user — see "Config" above).
- `POST /api/match-engine/run-now` (authed) reruns it for the calling user only — mirrors the
  prototype's "Run this week's refresh now" button.
- Scoring formula and top-3 / minimum-score (`config/*.yaml`'s `matchEngine.minScore`, default 40,
  clamped 10-80) / notification-per-match behavior implemented exactly per `CONTRACT.md` §2 in
  `src/services/matchEngine.ts`. Each surfaced match also triggers a push notification (see above).

## Automated tests (CONTRACT §7.6)

`vitest` + `supertest` against a real Postgres database (`TEST_DATABASE_URL`, kept entirely
separate from your dev `DATABASE_URL` — the suite truncates its tables before each run). The
`ConsoleOtpProvider` is used automatically (Twilio env vars are explicitly cleared in
`tests/setup.ts`), so **no real Twilio calls happen in tests or CI**.

```bash
createdb kifaah_test              # once
npx prisma migrate deploy         # against TEST_DATABASE_URL — see package.json / CI for how
npm test
```

Coverage (`backend/tests/`):
- `auth.test.ts` — OTP send/verify → account creation vs. login, single-use codes, refresh
  rotation + reuse-detection (and that reuse revokes *every* session for that user), `logout` /
  `logout-all`, and `requireAuth` rejecting missing/garbage/expired tokens.
- `interests.test.ts` — interest accept/decline authorization (only the recipient may act; a
  sender or an unrelated third party gets 403), and that sending an interest without an active
  subscription is rejected (402).
- `visibility.test.ts` — `isUnlocked` truth table and `canChat`'s both-sides-subscribed
  requirement (not just the initiating side).
- `matchEngine.test.ts` — the exact scoring formula (base 10, +30 city, +30 sect, +20 prayer, +10
  profField-prefix, capped at 99) plus the running engine's exclusion (already
  interested-with-in-either-direction), minimum-score filter, and top-3 cap.
- `razorpay.test.ts` — signature verification accepting a correctly-HMAC'd payment/webhook
  signature and rejecting a tampered one or one signed with the wrong secret.
- `rateLimit.test.ts` — the `otp/send` limiter actually returning 429 past 3 requests for one
  phone number within the window, and not bleeding over onto a different phone number.

## Deployment

### Docker Compose (local parity / self-hosting)

```bash
cp backend/.env.example backend/.env
# edit backend/.env — DATABASE_URL there gets overridden by docker-compose.yml to point at the
# `postgres` service; everything else (JWT_SECRET, Twilio, Razorpay, ALLOWED_ORIGINS, ...) is
# read from it as-is.
docker compose up --build
```
See `docker-compose.yml` at the repo root. The `backend` service builds from `backend/Dockerfile`
(multi-stage: compiles TypeScript, then ships a slim `node:20-alpine` runtime image running as a
non-root user with only production dependencies), waits on Postgres's healthcheck, and its
container `CMD` runs `prisma migrate deploy` before starting the server — so `prisma` (the CLI) is
a real production dependency, not just `@prisma/client`, specifically so that works without a
network call at container start.

> This sandbox's Docker daemon could not pull `node:20-alpine` from Docker Hub (an org egress
> policy blocks `production.cloudfront.docker.com` here — confirmed via the proxy status
> endpoint, not a Dockerfile problem), so `docker build` itself could not be exercised end-to-end
> in this environment. `docker compose config` was used instead to validate the compose file
> syntactically and confirm the merged environment (service networking, `DATABASE_URL` override)
> is correct; the equivalent runtime steps (`npm ci --omit=dev`, `prisma generate`, `prisma
> migrate deploy`, `node dist/src/index.js`) were run directly, with real production env vars, and
> verified working outside the container — see the PR/handoff notes for the exact commands.

### CI

`.github/workflows/ci.yml` (repo root) runs on every push/PR: a `backend` job (install → `prisma
generate` → typecheck → lint → apply migrations to a service-container Postgres → test) and a
`mobile` job (install → typecheck).

### Connection pooling

For serverless or high-concurrency deployments, put a connection pooler (e.g.
[PgBouncer](https://www.pgbouncer.org/), or your managed Postgres provider's built-in pooler — RDS
Proxy, Supabase's pooler, Neon's pooler, etc.) in front of Postgres, and add
`connection_limit=<n>` to `DATABASE_URL`'s query string (e.g.
`postgresql://...?schema=public&connection_limit=5`) so Prisma doesn't open more connections per
instance than the pooler/database can handle. This repo doesn't stand up a pooler itself — it's an
infra-layer concern for wherever you deploy — but `DATABASE_URL` is the one place you'd wire it in.

## Known deviations from CONTRACT.md (flagged, not oversights)

- **Dropped the prototype's "Demo — simulate their acceptance" shortcut.** The contract explicitly
  calls this out as a single-player demo affordance with no real second user; a real
  `InterestRequest` can only move from `pending` to `accepted`/`declined` via the actual recipient
  calling `POST /api/interests/:id/accept` or `/decline`.
- **`Profile.name` / `Profile.age`** were added to the Prisma schema even though CONTRACT §3's
  field list doesn't list them explicitly — §4's `GET /api/discover` requires exposing
  `name`/`age` "from the candidate's account" and no other model in §3 carries an identity name,
  so they live on `Profile` rather than inventing a separate identity model.
- **OTP-verify/refresh rate limits bumped from the contract's "e.g. 10/min" example to 30/min** —
  see "Security hardening" above.
- **`docker build` could not actually be executed** in this sandbox (blocked base-image pull, not
  a Dockerfile defect) — see "Docker Compose" above for exactly what was verified instead.
