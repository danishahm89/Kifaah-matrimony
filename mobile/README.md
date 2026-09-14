# Kifaah — mobile

Expo (React Native + TypeScript) client for Kifaah, built against `../CONTRACT.md`.

## Setup

```bash
cd mobile
cp .env.example .env
npm install
npx expo start
```

Open in Expo Go, an iOS simulator, or an Android emulator from the CLI that `expo start` prints.

## Environment

- `EXPO_PUBLIC_API_URL` — base URL of the backend API (see `.env.example`). Defaults to
  `http://localhost:4000` if unset, matching `../backend`'s default `PORT`.

## Auth: phone + OTP (CONTRACT.md §7)

There are no passwords anywhere in this app. `WelcomeScreen` collects a phone number and a
6-digit SMS code instead:

1. Pick "Brother, looking for a sister" / "Sister, looking for a brother" (new account — records
   `gender`) or "Already have an account? Log in" (existing account — no gender collected).
2. Enter a phone number in E.164 format (e.g. `+919812345678`) and tap **Send code** —
   `POST /api/auth/otp/send { phone }`. In dev, the backend's console OTP provider logs the code
   to its own terminal instead of sending a real SMS (see `../backend/README.md`) — no Twilio
   account is needed to develop against this locally.
3. Enter the 6-digit code and tap **Verify** — `POST /api/auth/otp/verify { phone, code, gender? }`
   (`gender` is sent only on the signup path; the backend requires it for a brand-new account and
   ignores it for an existing one). On success the response is
   `{ token, refreshToken, user, isNewUser }`; both tokens are stored via `authStore` (persisted
   through `expo-secure-store`), and `RootNavigator` routes to onboarding or straight into the app
   based on whether the returned profile already has a `wali` set.

**Session refresh**: `src/api/client.ts`'s `request()` wrapper catches a `401`, calls
`POST /api/auth/refresh` exactly once with the stored `refreshToken`, stores the rotated token
pair, and retries the original request once. Concurrent requests that 401 at the same time share
one in-flight refresh call instead of each triggering their own (no refresh storm). If the refresh
itself fails, the local session is cleared and `RootNavigator` falls back to `WelcomeScreen`.
**Logout** (`useLogout` in `src/api/hooks/useAuth.ts`) best-effort deletes the device's push token
and calls `POST /api/auth/logout` before clearing the session locally either way.

## Push notifications (CONTRACT.md §7.4)

After login, `usePushNotifications` (`src/hooks/usePushNotifications.ts`, wired up from `App.tsx`)
requests notification permission and registers the device via
`expo-notifications`' `getExpoPushTokenAsync()`, sending the result to
`POST /api/account/push-token`. A received notification shows the existing in-app `Toast` banner
while the app is foregrounded; tapping a notification while backgrounded relies on the OS bringing
the app to the foreground (no deep-link into a specific screen yet — kept deliberately minimal per
the spec).

**This feature cannot be demoed in plain Expo Go** — Expo Go dropped support for remote push
notifications, so `getExpoPushTokenAsync()` will fail there (handled as a silent no-op, it won't
crash the app). To see push notifications working you need a development build or a production
build:

```bash
npx expo prebuild
npx expo run:ios     # or: npx expo run:android
# or, for a shareable build: eas build --profile development
```

Everything else in the app (Discover, Matches, Chat, Account, Pricing, Payment, FAQ, and the new
phone+OTP auth flow) still runs fine in plain Expo Go.

## Razorpay checkout

`PaymentScreen` opens Razorpay's **Standard Checkout** inside a `react-native-webview` page that
loads `checkout.js` from Razorpay's CDN and calls `POST /api/payments/verify` on success — no
native Razorpay SDK / custom dev client required, so it runs in plain Expo Go. For checkout to
actually open you need the backend running with real Razorpay **test-mode** keys configured — see
`../backend/.env.example` (`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`).
Without those set server-side, `POST /api/payments/create-order` will fail before the WebView ever
opens.

## Scripts

- `npm run start` / `ios` / `android` / `web` — `expo start` variants.
- `npm run typecheck` — `tsc --noEmit` across the whole app.
- `npm test` — runs the Jest unit test suite (`jest-expo` preset).

## Tests

Unit tests only (`jest` + `jest-expo` + `@testing-library/react-native`) — no simulator/device is
available in this sandbox, so there's no end-to-end coverage. Run with:

```bash
npm test
```

Covered:
- `src/api/__tests__/client.test.ts` — the API client's 401 refresh-and-retry logic: mocks
  `fetch`, asserts a `401` triggers exactly one `POST /api/auth/refresh` and one retry of the
  original request, that a failed refresh clears the session, that the retry itself isn't retried
  again, and that concurrent `401`s share a single in-flight refresh call instead of each starting
  their own.
- `src/store/__tests__/authStore.test.ts` — `authStore`'s session get/set/clear behavior
  (`setSession`, `setTokens`, `updateUser`, `logout`, `hydrate`), against a manual in-memory mock
  of `expo-secure-store` (`__mocks__/expo-secure-store.js`).

## Structure

- `src/theme/tokens.ts` — design tokens (colors, type, spacing) shared 1:1 with CONTRACT.md §1.
- `src/api/client.ts` + `src/api/hooks/*` — typed REST client and React Query hooks, one per
  CONTRACT.md §4/§7 resource, including the 401 refresh-and-retry logic described above.
  `src/api/socket.ts` is the Socket.IO `/chat` client used by chat's live updates (falls back to
  polling if the socket doesn't connect).
- `src/store/authStore.ts` — access + refresh JWTs and the current user, persisted via
  `expo-secure-store`.
- `src/store/pushStore.ts` — the device's current Expo push token, kept in memory only, so
  logout can unregister it.
- `src/store/onboardingStore.ts` — in-progress profile draft collected across ShariahQA +
  ProfileSetup, submitted as one `PUT /api/profile/me` on "Enter Kifaah".
- `src/hooks/usePushNotifications.ts` — registers for push after login and handles
  foreground/tap receipt (see "Push notifications" above).
- `src/navigation/` — root stack that swaps between an auth tree (Welcome → ShariahQA →
  ProfileSetup) and the main tree (bottom tabs + pushed screens), matching CONTRACT.md §5.
- `src/screens/` — one file per screen listed in CONTRACT.md.
- `src/components/`, `src/icons/` — shared flat-design primitives and hand-recreated SVG icons.

## Known limitations in this sandbox

No simulator/device is available here, so this was verified with `tsc --noEmit` (passes with zero
errors), `npm test` (Jest unit suite, all passing), and `expo export` for both iOS and Android
(bundles cleanly), per the task's verification steps. Push notifications specifically also can't
be exercised here even with a device, since remote push requires Apple/Google's push services —
see "Push notifications" above for why plain Expo Go can't demo it either. `npx expo-doctor` mostly
passes; its two network-dependent checks (Expo config schema lookup, React Native Directory
package metadata) fail here only because this sandbox's egress policy blocks `api.expo.dev` /
`reactnative.directory` — not a project issue.
