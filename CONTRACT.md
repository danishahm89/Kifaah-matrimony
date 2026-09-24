# Kifaah — implementation contract

Source of truth translating `project/Kifaah.dc.html` (a Claude Design prototype) into a real
app: **Expo/React Native mobile client** + **Node/Express/Prisma/PostgreSQL backend**, with real
Razorpay integration. This doc is the shared contract between the backend and mobile
implementations — both must match it exactly so they integrate without further negotiation.

Repo layout:
- `backend/` — Node.js + TypeScript + Express + Prisma + PostgreSQL API
- `mobile/` — Expo (React Native + TypeScript) app
- `project/`, `chats/`, `README.md` — original design handoff bundle, left as reference, not touched

## 1. Design tokens (must match exactly, both apps read from one place)

Colors:
- `ink` `#201e1d` — primary text
- `muted` `#605d5d` — secondary text / labels
- `mutedLight` `#7d7979` — inactive tab icon/label
- `bg` `#f3f2f2` — screen background
- `surface` `#eae9e9` — card / input background
- `red` `#ec3013` — primary brand / CTA buttons / active tab / accent rule
- `redDark` `#ae1800` — links, icons, low-match chip text, guardian icon
- `border` — ink at 10–30% opacity (`rgba(32,30,29,0.10/0.12/0.15/0.30)`), used for hairlines
- `greenBg` `#eaf5ea` / `greenText` `#1f6b30` — match ≥ 65%
- `lowBg` `#fff2ef` / `lowText` `#ae1800` — match < 65%, chat bubble "you", chaperone banner bg
- `bubbleThem` `#eae9e9`
- `toastBg` `#201e1d` / `toastText` `#f3f2f2`

Type: font family **Archivo** (weights 400/600/800). Scale used in the prototype: 32/800 (brand
wordmark), 22/800 (tab header), 20/800, 16/800, 15/800 (buttons/body-strong), 14/600 (body),
13/600, 12/600 (field labels), 11/700 uppercase (section labels/eyebrows), 10/700 uppercase
(chips/tab labels).

Shape: **flat** — no border-radius anywhere except the small notification unread dot (circle).
2px rules under header/tab bar, 1px hairlines elsewhere. This is a deliberate "Modernist" system:
squared inputs/buttons/cards, no shadows except the toast.

Photos: always rendered as a diagonal placeholder stripe pattern (no real photo asset in the
prototype) with `grayscale(1) contrast(1.08)`, blurred (`blur(9px)` thumbnail / `blur(22px)`
detail) while locked, a small locked-avatar/lock SVG overlay, clear when unlocked.

## 2. Core business rules (from the prototype's `Component` class)

- A user picks their own gender at onboarding: **Brother** (`groom`) or **Sister** (`bride`).
  They are shown candidates of the opposite gender.
- Every profile blurs its photo and hides contact details until: the viewer has an **active
  subscription** AND the interest between the two users has been **mutually accepted**.
- Sending interest requires an active subscription; if not subscribed, the app routes the user to
  Pricing → Payment first, then auto-sends the pending interest on successful payment.
- A **wali (guardian)** name is a required field on every profile and is always shown on profile
  detail; it is not optional and there is no way to skip it.
- Chat is only reachable once both sides' interest is accepted and the current user is
  subscribed. Each conversation shows a **chaperone banner** ("Visible to both families'
  guardians (wali), in line with Islamic etiquette") when chaperoned mode is on for that
  conversation.
- **Match score** (0–99), computed per viewer against a candidate:
  ```
  score = 10
  score += 30 if candidate.city === viewer.city
  score += 30 if candidate.sect === viewer.sect
  score += 20 if candidate.prayer === viewer.prayer
  score += 10 if viewer.profField && candidate.profField &&
                 viewer.profField.toLowerCase().includes(candidate.profField.toLowerCase().slice(0,4))
  score = min(score, 99)
  ```
  Discover feed sorts by (score ≥ 65 first, then) score descending. Chips are green (`greenBg`/
  `greenText`) at ≥ 65%, otherwise red-tinted (`lowBg`/`lowText`).
- **Match engine**: on signup, and on a recurring weekly schedule, score all not-yet-handled
  opposite-gender candidates for a user, take the top 3, keep only those ≥ a configurable minimum
  score (default **40**, admin-tunable 10–80), and create one notification per surfaced match. A
  candidate already sent-to, received-from, accepted, or declined is excluded from future runs.
- Pricing (server is the source of truth, never trust client-submitted amounts):
  - Basic: ₹49/mo or ₹490/yr
  - Premium: ₹99/mo or ₹990/yr (annual ≈ 2 months free on both tiers)
- Payment goes through **Razorpay** (order created server-side, checkout opens client-side,
  payment verified server-side via HMAC signature against the Razorpay webhook/key secret before
  a subscription is activated). Use env-configured Razorpay **test-mode** keys — never fabricate
  or hardcode real keys/secrets.
- i18n: only the four tab labels and the toggle button text switch between English and a
  Urdu/Arabic label set (`اردو` / `EN`); rest of copy stays English, matching the prototype's
  scope. Keep the toggle and a small string table so it's easy to extend later.
- The prototype's "Demo — jump ahead: simulate their acceptance" button was a single-player
  shortcut with no second real user. **Drop it** in the real app — acceptance must come from the
  real counterpart user accepting the request. (Flag this to the user in the final summary.)

## 3. Data model (Prisma)

```
User
  id            String  @id @default(cuid())
  email         String  @unique
  passwordHash  String
  gender        Gender          // BRIDE | GROOM — the user's own gender
  language      String  @default("en")   // "en" | "ur"
  chaperoneChat Boolean @default(true)
  createdAt     DateTime @default(now())
  profile       Profile?
  subscription  Subscription?

Profile   (1:1 User)
  userId       String @id
  photoUrl     String?
  sect         String?
  prayer       String?
  modesty      String?          // hijab/beard question, gender-dependent options
  wali         String           // required
  eduProf      String?
  profField    String?          // derived from eduProf selection, used for scoring
  family       String?
  height       String?
  city         String?
  marital      String?
  about        String?
  fasting      String?
  quran        String?
  hajj         String?
  polygamy     String?
  diet         String?
  dietCustom   String?
  smoking      String?
  habits       String?
  habitsCustom String?
  likes        String?
  likesCustom  String?
  dislikes     String?
  dislikesCustom String?
  phone        String?          // real contact, masked in API responses until unlocked
  contactEmail String?          // real contact, masked in API responses until unlocked

Subscription  (1:1 User)
  userId         String @id
  tier           Tier?            // BASIC | PREMIUM
  billing        Billing?         // MONTHLY | ANNUAL
  status         String @default("inactive")  // inactive | active | cancelled
  startedAt      DateTime?
  renewsAt       DateTime?
  razorpayOrderId   String?
  razorpayPaymentId String?

InterestRequest
  id          String @id @default(cuid())
  fromUserId  String
  toUserId    String
  status      String @default("pending")  // pending | accepted | declined
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([fromUserId, toUserId])

ChatMessage
  id          String @id @default(cuid())
  fromUserId  String
  toUserId    String
  text        String
  createdAt   DateTime @default(now())

Notification
  id          String @id @default(cuid())
  userId      String
  candidateId String
  score       Int
  label       String   // e.g. "New signup match" / "Week 3 refresh"
  text        String
  read        Boolean @default(false)
  createdAt   DateTime @default(now())
```

FAQ content is static (matches `FAQS` in the prototype) — serve from a constants file, no table
needed.

## 4. REST API (JSON, `Authorization: Bearer <jwt>` except `/auth/*`)

Auth
- `POST /api/auth/signup` `{ email, password, gender: "bride"|"groom" }` → `{ token, user }`
- `POST /api/auth/login` `{ email, password }` → `{ token, user }`
- `GET /api/auth/me` → `{ user, profile, subscription }`

Reference data (static option lists so both apps read one source)
- `GET /api/reference` → `{ heights[], cities[], sects[], eduProfOptions[], dietOptions[], habitsOptions[], likesOptions[], dislikesOptions[], maritalOptions[], prayerOptions[], modestyOptions: {bride[], groom[]}, fastingOptions[], quranOptions[], hajjOptions[], polygamyOptions: {bride[], groom[]}, smokingOptions[] }`

Profile
- `GET /api/profile/me`
- `PUT /api/profile/me` (partial update, any subset of Profile fields above)
- `POST /api/profile/photo` (multipart `file`) → `{ photoUrl }`
- `PUT /api/account/language` `{ language: "en"|"ur" }`
- `PUT /api/account/chaperone` `{ chaperoneChat: boolean }`

Discover / candidates
- `GET /api/discover` → list of opposite-gender candidates not yet handled (sent/received/
  accepted/declined), each `{ id, name, age, city, sect, eduProf, score, photoLocked: true }`,
  sorted per §2. (Prototype uses static demo names; real app should still expose `name`/`age`
  from the candidate's account — see §6 seed data note.)
- `GET /api/profiles/:id` → full detail: bio fields, `score`, `interestStatus`
  (`none|sent|received|accepted|declined`), `wali`, and `contact` (`{ phone, email }` only when
  unlocked per §2, otherwise `null` with `locked: true` + `lockMessage`), `photoUrl` (only when
  unlocked, otherwise `null`).

Interests
- `POST /api/interests/:profileId` → send interest (409 if already exists; 402 style error
  `{ error: "subscription_required" }` if not subscribed — mobile app routes to Pricing)
- `GET /api/interests/sent`
- `GET /api/interests/received`
- `POST /api/interests/:id/accept`
- `POST /api/interests/:id/decline`

Chat
- `GET /api/chats` → conversations with an accepted, subscribed-both-sides interest
- `GET /api/chats/:userId/messages`
- `POST /api/chats/:userId/messages` `{ text }`
- Socket.IO namespace `/chat`, event `message` (join room `user:<id>` on connect, auth via JWT in
  handshake) for live delivery; REST remains the source of truth / fallback.

Notifications
- `GET /api/notifications`
- `POST /api/notifications/read-all`

Match engine
- Runs automatically: once right after a user finishes profile setup, and on a weekly cron
  (`node-cron`, configurable via `MATCH_ENGINE_CRON`, default `0 9 * * 1` — Monday 9am).
- `POST /api/match-engine/run-now` (auth'd user, dev/demo convenience — mirrors the prototype's
  "Run this week's refresh now" button in Account) → runs the engine for the calling user only.

Pricing & payments
- `GET /api/pricing` → `{ basic: {monthly, annual}, premium: {monthly, annual} }`
- `POST /api/payments/create-order` `{ tier: "basic"|"premium", billing: "monthly"|"annual" }` →
  `{ orderId, amount, currency: "INR", keyId }` (Razorpay order, amount in paise)
- `POST /api/payments/verify` `{ orderId, paymentId, signature }` → verifies HMAC-SHA256 of
  `orderId|paymentId` with `RAZORPAY_KEY_SECRET`; on success activates/renews Subscription and
  returns `{ subscription }`
- `POST /api/payments/webhook` (raw body, `X-Razorpay-Signature` header) → Razorpay webhook for
  `payment.captured`/`order.paid`, verified against `RAZORPAY_WEBHOOK_SECRET`, idempotent

FAQ
- `GET /api/faq` → static list `{ question, answer }[]`

## 5. Mobile navigation shape

Root stack:
- **Onboarding stack** (no tab bar, no header chrome except the prototype's own back buttons):
  `Welcome → ShariahQA → ProfileSetup` → replaces root with Main on completion.
- **Main**: bottom tab navigator — `Discover`, `Matches` (internal Sent/Received segmented
  control), `Chat` (list), `Account` — each screen's own header shows title + notification bell
  (unread dot) + EN/اردو toggle, matching the prototype's `showTabBar` header.
- Screens pushed on top of Main (own back button, no tab bar, matches prototype's non-tab
  screens): `ProfileDetail`, `Pricing`, `Payment`, `ChatThread`, `FAQ`.

State/data: React Query (server cache) + a small auth/session store (Zustand) for the JWT and
current user; no need to duplicate server state in Zustand beyond the token.

## 7. Production hardening (v2 — supersedes email/password auth in §3/§4)

This section is the spec for taking the app from "working prototype" to production-ready:
phone+OTP auth with revocable sessions, rate limiting and other security hardening, real push
notifications, Docker/CI, and an automated test suite. It **replaces** the email/password auth
described in §3/§4 — phone number is now the primary identity, verified by SMS OTP via **Twilio
Verify**, no passwords are stored anywhere. Everything else in §1–§6 (design tokens, business
rules, profile/discover/interests/chat/pricing/payments/match-engine endpoints) is unchanged.

### 7.1 Auth model changes

`User` model changes:
- `phone String @unique` — E.164 format (e.g. `+919812345678`), replaces email as the login identifier
- `phoneVerified Boolean @default(false)`
- `email String? @unique` — now optional, kept only as an account-recovery/display field, never used for login
- **Remove `passwordHash` entirely** — no passwords are stored anywhere in this system

New models:
```
RefreshToken
  id                    String @id @default(cuid())
  userId                String
  tokenHash             String @unique   // SHA-256 of the opaque refresh token — never store it plaintext
  createdAt             DateTime @default(now())
  expiresAt             DateTime
  revokedAt             DateTime?
  replacedByTokenHash   String?          // set on rotation, for reuse-detection

PushToken
  id               String @id @default(cuid())
  userId           String
  expoPushToken    String @unique
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

AuditLog
  id          String @id @default(cuid())
  userId      String?           // null for pre-auth events (e.g. failed OTP verify)
  event       String            // e.g. "otp_verified", "login", "logout", "subscription_activated", "contact_unlocked", "refresh_token_reused_detected"
  metadata    Json?
  ip          String?
  createdAt   DateTime @default(now())
```

### 7.2 Auth endpoints (replace §4's signup/login)

- `POST /api/auth/otp/send` `{ phone }` — rate-limited (see §7.3), starts a Twilio Verify
  verification for `phone`. Always responds `{ ok: true }` regardless of whether the phone has an
  account yet (don't leak account existence). Twilio Verify itself owns OTP generation, expiry,
  and per-phone attempt/resend limiting — don't reimplement that.
- `POST /api/auth/otp/verify` `{ phone, code, gender?: "bride"|"groom" }` — checks the code against
  Twilio Verify. On success: if a `User` with this phone exists, log them in; otherwise create one
  (`gender` is required in this case — 400 if missing) with `phoneVerified: true`. Either way issue
  a token pair and respond `{ token, refreshToken, user, isNewUser }`. `token` (access) is short-lived
  (`JWT_EXPIRES_IN`, default `15m`); `refreshToken` is an opaque random string (`crypto.randomBytes(40).toString('hex')`),
  stored server-side only as its SHA-256 hash, default lifetime `REFRESH_TOKEN_DAYS` (default 30).
- `POST /api/auth/refresh` `{ refreshToken }` — looks up the hash, rejects if missing/expired/revoked
  (401 `invalid_refresh_token`). On success: **rotate** — revoke the presented token, issue a new
  access+refresh pair, link via `replacedByTokenHash`. If a token that's already `revokedAt`-set is
  presented again (reuse of a rotated-away token — a signal of a stolen token), revoke **all**
  refresh tokens for that user, write an `AuditLog` entry (`refresh_token_reused_detected`), and
  respond 401 so the client is forced to fully re-authenticate.
- `POST /api/auth/logout` `{ refreshToken }` — revokes that one token.
- `POST /api/auth/logout-all` (requireAuth) — revokes every refresh token for the caller.
- `GET /api/auth/me` — unchanged shape from §4, `user.phone`/`user.phoneVerified` replace email in
  the public user object.

**Dev/test OTP provider**: SMS costs money per message, so don't require live Twilio credentials
to develop or test this. Implement an `OtpProvider` interface with two implementations, selected at
boot: `TwilioVerifyProvider` (used whenever `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_VERIFY_SERVICE_SID`
are all set) and a `ConsoleOtpProvider` (logs the code to the server console instead of sending an
SMS, and only that — never fabricate a bypass that skips verification). **Fail fast at boot**: if
`NODE_ENV=production` and Twilio env vars are not fully set, throw and refuse to start — the console
provider must be unreachable in production. Seed demo accounts get a fixed dev-only phone range
(document it) and rely on the console provider in dev.

### 7.3 Security hardening

- `helmet` on the Express app (default config is fine; disable `x-powered-by`).
- `express-rate-limit`: a general limiter (~100 req/min per IP) on `/api/*`, plus a strict limiter
  on `/api/auth/otp/send` (e.g. 3 per phone number per 10 minutes — key by phone, not just IP) and
  on `/api/auth/otp/verify` and `/api/auth/refresh` (e.g. 10/min per IP) to blunt brute-forcing on
  top of Twilio's own limits.
- CORS: restrict to `ALLOWED_ORIGINS` (comma-separated env var); default to permissive only when
  `NODE_ENV !== 'production'`, otherwise deny-by-default.
- `JWT_SECRET` must not silently fall back to a dev default when `NODE_ENV=production` — validate
  required env vars at boot (a small zod schema over `process.env` is fine) and crash immediately
  with a clear message if anything required for prod is missing, rather than starting insecurely.
- Photo upload (`POST /api/profile/photo`): validate actual file content (magic bytes via the
  `file-type` package), not just the client-supplied MIME type; restrict to JPEG/PNG/WEBP (drop SVG
  support entirely — SVG can carry script content); re-encode every upload through `sharp` (resize
  to a sane max dimension, strip EXIF/metadata, re-save as JPEG) before storing, so nothing but
  actual pixel data ever reaches disk regardless of what was uploaded.
- Structured logging via `pino`/`pino-http` in place of `console.log`/`console.error`, with secrets
  (tokens, OTP codes, Razorpay keys) never logged.
- `AuditLog` entries written for: OTP verified (login/signup), logout, subscription activated,
  contact unlocked (first time `isUnlocked` flips true for a pair), refresh-token-reuse-detected.
- Sentry (`@sentry/node` backend, `sentry-expo`/`@sentry/react-native` mobile) wired but
  conditional on a `SENTRY_DSN` env var being present — a no-op otherwise. Never fabricate a DSN.

### 7.4 Push notifications

New: `POST /api/account/push-token` (requireAuth) `{ expoPushToken }` — upserts a `PushToken` row
for the caller. `DELETE /api/account/push-token` `{ expoPushToken }` — removes one (call on logout).

Sending: a small service using `expo-server-sdk` (no account/API key needed for Expo's push
service on the free tier — don't invent credentials for this one) that looks up all `PushToken`
rows for a `userId` and sends a push. Trigger it from the existing flows, additively (don't
replace the in-app toast/notification-panel behavior, just also push when the app isn't
foregrounded):
- Match engine surfacing a new match (`runMatchEngineForUser`) → push to that user
- New interest received (`POST /api/interests/:profileId`) → push to `toUserId`
- Interest accepted (`POST /api/interests/:id/accept`) → push to the original `fromUserId`
- New chat message (`POST /api/chats/:userId/messages`) → push to `toUserId`

Mobile: register for a push token via `expo-notifications` after login (permission prompt), send
it to `POST /api/account/push-token`, handle foreground/background receipt. Note in the mobile
README that remote push requires a development or production build — Expo Go dropped support for
it — so it can't be demoed inside plain Expo Go the way the rest of the app can.

### 7.5 Deployment & CI

- `backend/Dockerfile` — multi-stage (build TS → `dist`, slim `node:20-alpine` runtime, non-root
  user, only production deps in the final image).
- `docker-compose.yml` at repo root — `postgres` + `backend` services, `.env` driven, for local
  parity/self-hosting; not tied to any specific cloud provider.
- `.github/workflows/ci.yml` — on push/PR: install + typecheck + lint + test for `backend/`,
  install + typecheck for `mobile/` (assume `npm run typecheck` exists in both `package.json`s —
  add it if missing).
- `/health` (already exists, liveness) + add `/ready` (readiness — checks DB connectivity with
  `SELECT 1`, returns 503 if unreachable).
- Document (README) the PgBouncer/connection-pooling recommendation for serverless/high-concurrency
  deployments — no need to stand up a pooler in this repo, just document the `DATABASE_URL`
  parameter (`connection_limit`) and the recommendation.

### 7.6 Automated tests

Backend: `vitest` (or `jest`) + `supertest` against a real Postgres test database (separate
`DATABASE_URL` for tests, e.g. `kifaah_test`), with the `ConsoleOtpProvider` so no real Twilio
calls happen in CI. Cover, at minimum: OTP send/verify → account creation and login; refresh
rotation + reuse-detection; `requireAuth` rejecting missing/invalid/expired tokens; the visibility
rules (`isUnlocked`, `canChat`) including the both-sides-subscribed requirement; interest
accept/decline authorization (rejecting a non-recipient); the match-engine scoring formula and
exclusion/min-score/top-3 behavior; Razorpay signature verification accepting a valid signature
and rejecting a tampered one; rate limiting actually kicking in on the OTP endpoints.

Mobile: unit tests (`jest` + `@testing-library/react-native`) for the API client's token-refresh
retry logic and the auth store — a real device/simulator run isn't possible in this environment,
so keep mobile testing at the unit level, not end-to-end.

## 6. Seed data

Backend seed script ports the prototype's 10 demo `PROFILES`, `PROFILE_EXTRA`, and `FAQS`
constants verbatim (with placeholder emails/passwords for the demo accounts) so the app has
realistic browsing content out of the box in dev. Real signups still work independently.

## 8. Connection lifecycle v2 — blocking, photo/wali consent, close/reopen, notifications, mobile UX

A second feature/hardening pass, additive to everything already built (§1–§7). **Preserve what
exists** — the auth model, Prisma schema, route structure, React Query/Zustand patterns, design
tokens, business rules already implemented — and extend it. Do not rewrite working code to make it
"cleaner"; add the minimum needed to satisfy the rules below. Every new state transition must be
enforced **server-side** — the client hiding a button is never sufficient on its own.

### 8.1 New Prisma models (additive — nothing existing is removed)

```
enum ConversationStatus { ACTIVE CLOSED REOPEN_REQUESTED BLOCKED }

Conversation
  id                      String @id @default(cuid())
  interestId              String @unique          // 1:1 with the InterestRequest it came from
  interest                InterestRequest @relation(fields: [interestId], references: [id])
  status                  ConversationStatus @default(ACTIVE)
  closedAt                DateTime?
  closedByUserId          String?
  reopenRequestedByUserId String?
  reopenRequestedAt       DateTime?
  archivedAt              DateTime?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  @@index([status, closedAt])   // for the archive-sweep query

BlockedUser
  id          String @id @default(cuid())
  blockerId   String
  blockedId   String
  createdAt   DateTime @default(now())
  @@unique([blockerId, blockedId])
  @@index([blockedId])   // "who has blocked me" lookups

PhotoAccessRequest
  id             String @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  requesterId    String     // wants to see the photo
  ownerId        String     // whose photo it is
  status         String @default("pending")   // pending | accepted | rejected
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@unique([conversationId, requesterId])

WaliShare
  id             String @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  sharedByUserId String        // must be the BRIDE-side participant (see §8.5)
  accessToken    String @unique
  revoked        Boolean @default(false)
  createdAt      DateTime @default(now())
  revokedAt      DateTime?
  lastViewedAt   DateTime?

SecurityEvent
  id                 String @id @default(cuid())
  userId             String     // the affected user (whose content was captured)
  triggeredByUserId  String?    // who triggered it, when known
  type               String     // "screenshot_detected" for now
  conversationId     String?
  platform           String?    // "ios" | "android" | "web"
  createdAt          DateTime @default(now())
```

**`Notification` is generalized** (existing rows/consumers migrate, this is a breaking shape
change to that one model — everything else is additive):
```
Notification
  id          String @id @default(cuid())
  userId      String
  type        String    // match_suggestion | new_request | request_accepted | new_message |
                         // photo_requested | photo_request_accepted | photo_request_rejected |
                         // conversation_closed | reopen_requested | reopen_accepted |
                         // reopen_rejected | screenshot_alert
  title       String
  message     String
  referenceId String?   // candidateId / interestId / conversationId / the other user's id,
                         // meaning depends on `type` — see §8.6
  read        Boolean @default(false)
  createdAt   DateTime @default(now())
```
Port the existing match-engine notification creation to this shape (`type: "match_suggestion"`,
`title: "New match"`, `message` unchanged, `referenceId: candidateId`).

**`Profile.wali`**: no schema change (already `String`, defaults to `""`) — only its *validation*
becomes gender-conditional (§8.7).

### 8.2 Conversation state machine — allowed transitions only

```
(created on interest accept) → ACTIVE
ACTIVE           → CLOSED             (either participant closes it)
ACTIVE           → BLOCKED            (either participant blocks the other)
CLOSED           → REOPEN_REQUESTED   (either participant requests reopen)
REOPEN_REQUESTED → ACTIVE             (the OTHER participant accepts)
REOPEN_REQUESTED → CLOSED             (the other participant rejects, or the requester cancels)
BLOCKED          → REOPEN_REQUESTED   (once unblocked — see §8.3 — same reopen flow as CLOSED;
                                        blocking does NOT auto-restore ACTIVE)
```
Any other transition (e.g. `CLOSED → ACTIVE` directly, sending a message while `CLOSED`/`BLOCKED`,
accepting a reopen the requester didn't initiate, a second `REOPEN_REQUESTED` while one is already
pending) is rejected with `409 invalid_transition`. Wrap every transition in a
`prisma.$transaction` that re-reads and checks the current status inside the transaction before
writing, so two concurrent requests (e.g. both users closing at once, or an accept racing a
decline) can't corrupt state — the loser of the race gets a clean `409`, not a silent double-apply.

On close (any → CLOSED): reset the "approval cycle" — set every `PhotoAccessRequest` for that
conversation back to a state where the requester must ask again (either delete the rows or add a
`resetAt`/supersede them; either is fine, but a fresh `POST .../photo-request` after reopen must
start from "none", not silently reuse an old acceptance) and revoke any active `WaliShare`
(`revoked: true`). **Never delete `ChatMessage` history** — messages stay, only future sending and
photo/wali access are gated by conversation status.

### 8.3 Blocking

- `POST /api/blocks/:userId` — block. `DELETE /api/blocks/:userId` — unblock. `GET /api/blocks` —
  list blocked-by-me users (id, minimal display name/city, `createdAt`).
- Blocking is symmetric in effect, asymmetric in record: only the blocker's row exists, but both
  directions are excluded everywhere below (check `blockerId=me OR blockedId=me` against the other
  party, i.e. "is there a BlockedUser row in either direction between us").
- **Enforce at the query/middleware level, not by filtering results in the client**, in every one
  of: `GET /api/discover` and the match-engine candidate pool (exclude both directions — this is
  the most important one, cover it with an index-friendly query, not an in-memory filter over all
  users), `POST /api/interests/:profileId` (403 `blocked` if either direction), `GET
  /api/interests/sent|received` (drop rows where either direction is blocked), chat send/read
  (403 `blocked`), notification creation (skip if either direction is blocked at the moment of
  creation).
- If a `Conversation` exists between the two, blocking transitions it to `BLOCKED` (§8.2) as part
  of the same transaction as creating the `BlockedUser` row.
- Unblocking removes the `BlockedUser` row but does **not** revive the conversation — it stays
  `BLOCKED` until the normal reopen flow (§8.2) is used, and does not restore any prior
  request/match eligibility beyond "the match engine may consider them again under its normal
  rules" (i.e. no special-casing needed there — once unblocked, ordinary exclusion rules just no
  longer apply to that pair).

### 8.4 Explicit photo consent (in addition to, not instead of, the existing subscription gate)

The existing rule (§2: photo/contact unlock at `subscribed && interestAccepted`) still gates
**whether "Request Photo" is even offered** — it does not by itself reveal the photo anymore. Full
rule for `photoUrl` appearing in a `GET /api/profiles/:id` response: `subscribed &&
interestAccepted && PhotoAccessRequest{conversation, requester=viewer}.status === "accepted"`.
Contact-detail (`phone`/`email`) reveal rules are **unchanged** — this section only affects the
photo.

- `POST /api/profiles/:id/photo-request` — 403 unless the existing unlock prerequisite is met, 409
  if a request already exists for this conversation+requester (front-end should show its current
  status instead of re-requesting); creates/reuses a `PhotoAccessRequest`, notifies the owner
  (`photo_requested`, `"[Name] has requested to view your profile photo."`).
- `POST /api/photo-requests/:id/accept` / `.../reject` — owner-only (403 otherwise), notifies the
  requester (`photo_request_accepted` / `photo_request_rejected`).
- `GET /api/profiles/:id` response gains `photoAccessStatus: "none"|"pending"|"accepted"|"rejected"`
  next to `photoUrl` (which stays `null` unless truly unlocked, same "never leak it in the JSON"
  discipline as the rest of the locking logic).

### 8.5 Wali sharing — explicit, revocable, read-only

Scope: initiator must be the **BRIDE**-side participant of the conversation (mirrors "girl's Wali"
in the brief; the groom side has no wali-share affordance). This is a deliberate simplification
versus building a full second authentication system for Wali accounts — the Wali does not get an
app login; a long random bearer token in a link is the credential, and access is strictly
read-only. Document this choice; don't build Wali accounts/participation, that's out of scope here.

- `POST /api/chats/:userId/wali-share` (bride-side participant only) → creates a `WaliShare`,
  returns `{ token, url }` (the mobile "Share Conversation with Wali" action surfaces this URL to
  copy/send however the user likes — SMS, WhatsApp, etc., outside the app).
- `DELETE /api/chats/:userId/wali-share` — revoke (idempotent).
- `GET /api/chats/:userId/wali-share` — current status (`none`/`active`/`revoked`, `createdAt`) for
  the sharer to see in-app.
- `GET /api/wali/:token` — **unauthenticated** (no JWT — the token itself is the credential),
  read-only: returns the conversation's messages and minimal participant names, 404 if the token
  doesn't exist or is revoked. Update `lastViewedAt` on each successful read. Never expose this
  conversation's data through any other unauthenticated route.

### 8.6 Notifications — event → row mapping

| Event | `type` | `title` example | `referenceId` | Also push? |
|---|---|---|---|---|
| New interest received | `new_request` | "New connection request" | sender's userId | yes |
| Interest accepted | `request_accepted` | "Request accepted" | accepter's userId | yes |
| Match engine surfaces a candidate | `match_suggestion` | "New match" | candidateId | yes (existing) |
| New chat message | `new_message` | "New message" | sender's userId | yes (existing) |
| Photo requested | `photo_requested` | "Photo request" | requester's userId | yes |
| Photo request accepted/rejected | `photo_request_accepted`/`_rejected` | … | owner's userId | yes |
| Conversation closed | `conversation_closed` | "Conversation closed" | other user's id | no (in-app only) |
| Reopen requested | `reopen_requested` | "Reopen request" | requester's userId | yes |
| Reopen accepted/rejected | `reopen_accepted`/`_rejected` | … | other user's id | yes |
| Screenshot detected | `screenshot_alert` | "Security alert" | conversationId | yes |

`message` text follows the brief's exact copy where given (e.g. `"You have received a new
connection request."`, `"[Name] has requested to reopen your previous conversation."`). **Never
put profile bio content in a notification body** — names are fine (already the existing pattern
for matches), but not e.g. someone's "about me" text. Never create any notification between a
blocked pair (§8.3).

### 8.7 Wali optional for boys — real backend enforcement

Today `wali` is only rejected if explicitly blanked (`wali_required` on an explicit empty string);
there's no actual gate requiring it to ever be set, and the mobile app infers "onboarding done" by
checking `!!profile.wali` client-side — which is exactly the kind of frontend-only gate the brief
calls out as insufficient. Fix properly:

- `GET /api/auth/me` gains a computed `profileComplete: boolean` field:
  `!!profile?.name && profile?.age != null && (user.gender !== "BRIDE" || !!profile?.wali)`.
  (Girls need a wali to be considered complete; boys don't.) Mobile's `RootNavigator` switches on
  `profileComplete` instead of raw `wali` presence.
- The `ShariahQAScreen`/`ProfileSetupScreen` wali notice copy ("required, not optional") must
  become gender-conditional to match — still fixed/required for the bride side, genuinely optional
  (skippable) for the groom side.

### 8.8 Close / reopen — API surface

Reusing the existing `userId`-keyed convention from `chats.ts` rather than introducing a parallel
`conversationId`-keyed resource (preserve existing API shape/conventions per the brief):
- `GET /api/chats` — extend the existing response with `conversationStatus`
  (`active|closed|reopen_requested|blocked`) and `canMessage: boolean` per row. **Also stop
  excluding accepted-but-not-both-subscribed pairs entirely** — currently an accepted interest
  where one side isn't subscribed never appears here at all; that's requirement 9's "stale UI" bug
  (accepted connections should be visible to both sides even before both are subscribed, they just
  can't message yet). Include them with `canMessage: false` and a reason, instead of omitting them.
- `POST /api/chats/:userId/close` — either participant, `ACTIVE|BLOCKED → CLOSED`, resets
  photo/wali access per §8.2, notifies the other participant.
- `POST /api/chats/:userId/reopen-request` — `CLOSED|BLOCKED → REOPEN_REQUESTED`, 409 if one is
  already pending, notifies the other participant.
- `POST /api/chats/:userId/reopen-request/accept` / `.../reject` — must be the **other**
  participant (not the requester — 403 if the requester tries to accept their own request),
  `REOPEN_REQUESTED → ACTIVE` or `→ CLOSED`, notifies the requester.
- `GET /api/chats/:userId/messages` and `POST .../messages` — add the `CLOSED`/`BLOCKED` gate
  (403 `conversation_not_active`) on top of the existing `canChat` check.

### 8.9 Six-month archive job

Extend the existing `node-cron` setup in `src/index.ts` with a second scheduled job (once daily is
plenty — this doesn't need to run every minute): `UPDATE Conversation SET archivedAt = now() WHERE
status = 'CLOSED' AND closedAt < now() - interval '6 months' AND archivedAt IS NULL`, using the
`@@index([status, closedAt])` from §8.1 so it's a fast indexed scan, not a full table scan.
Archived conversations: excluded from the default `GET /api/chats` list; reachable via `GET
/api/chats?archived=true` (or a separate `GET /api/chats/archived` — either is fine, pick one and
document it); messages remain queryable through it; never deleted.

### 8.10 Screenshot protection — Android FLAG_SECURE, cross-platform detection

Use `expo-screen-capture`. Call its `usePreventScreenCapture()` hook (sets `FLAG_SECURE` on
Android automatically; this is the *only* platform where prevention is actually possible) on the
sensitive screens listed in the brief (ProfileDetail, ChatThread, any Wali-share view, anywhere a
private photo renders). Use `addScreenshotListener` (fires on both iOS and Android when a
screenshot is taken — Apple does not allow blocking the screenshot itself, only notifying after
the fact) to `POST /api/security/screenshot-event { conversationId?, platform }`, which creates a
`SecurityEvent` and notifies the *other* participant per the brief's exact copy ("Security Alert: A
screenshot was detected while viewing your private conversation/profile."). **Document plainly, in
the mobile README and the final report, that this cannot detect screen recording, a second device
photographing the screen, or (on iOS) be prevented at all — only detected after the fact.** Web is
out of scope for this pass (the app is the RN client; there is no web client to protect).

### 8.11 Mobile UX fixes

- **Keyboard-aware forms everywhere**, not just Welcome/ChatThread: `ShariahQAScreen` and
  `ProfileSetupScreen` (the two long forms) need the same `KeyboardAvoidingView` +
  scroll-to-focused-field treatment already used elsewhere. Use a library already good at this
  (`react-native-keyboard-aware-scroll-view` or Keyboard-controller equivalents already common in
  Expo SDK 57) rather than hand-rolling scroll-offset math — pick one, apply it consistently, don't
  introduce a second different approach per screen.
- **Chat input redesign**: replace the single-line `TextField` in `ChatThreadScreen` with a
  multiline, auto-growing input (grows with content up to a sane max height, e.g. ~5 lines, then
  scrolls internally), Enter/newline behavior appropriate for a chat app (submitting on a dedicated
  send button/action, not swallowing every Enter as newline-only or send-only in a confusing way —
  match common messaging-app convention), staying pinned above the keyboard, without ballooning to
  an awkward size on a desktop/tablet width. Keep the existing flat design tokens (colors, square
  corners, Archivo) — this is a behavior fix, not a redesign of the visual language.
- **Bottom tab bar must never overlap the keyboard** — verify the existing tab bar + keyboard
  interaction on the three tab screens that have text inputs reachable from them (Discover has
  none directly, but Account/Matches lead to forms) — mainly confirm nothing regresses once the
  keyboard-aware library is added.

### 8.12 Authorization checklist (verify, don't just implement)

Every one of these must 403/404 correctly, and every new test file should include a case for it:
viewing another user's private photo without an accepted `PhotoAccessRequest`; reading a
conversation you're not a participant in; accepting/rejecting a `PhotoAccessRequest` you don't own;
accepting your own `reopen-request` (must be the other participant); unblocking a block someone
else placed (there's no such route — you can only ever act on your own `BlockedUser` rows, enforce
`blockerId = req.userId` on delete); reading a `WaliShare` conversation without a valid,
non-revoked token; reopening a conversation without a pending `REOPEN_REQUESTED` state to act on.

### 8.13 Testing

Automated only — this sandbox has no simulator/device/browser, so no manual/on-device testing
claims. Extend `backend/tests/` with coverage for: the full `Conversation` state machine (every
listed transition in §8.2, and rejection of every transition not listed, including the two
concurrent-accept/close race scenarios via overlapping requests against the same row); blocking
excluded from discover/match-engine/interests/chat/notifications in both directions; the photo
consent flow (request → accept → visible, request → reject → still hidden, re-request after a
reject); wali-share token access and revocation; the 6-month archive query (seed a `closedAt` far
in the past, run the sweep function directly, assert `archivedAt` set and excluded from the
default list); `profileComplete` computed correctly for both genders. Extend `mobile/`'s existing
unit tests only where there's real client-side logic worth unit-testing (e.g. any new client-side
state-derivation helpers) — don't invent RN-render tests for every screen just to pad coverage.

### 8.14 Explicitly out of scope for this pass

**Deployment.** No VPS/cloud access has been arranged yet (see the conversation for the pending
SSH/AWS discussion) — this section is implementation only. Ship the code, tests, and an updated
migration; deploying it is a separate step once infrastructure access exists.
