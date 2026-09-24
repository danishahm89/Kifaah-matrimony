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

## Connection lifecycle v2 (CONTRACT.md §8)

A second feature pass, additive on top of everything above:

- **Blocking** (§8.3) — a "Block" action on `ProfileDetailScreen`, `ChatThreadScreen`'s "⋯" menu,
  and accepted rows in `MatchesScreen`, each behind a confirmation dialog. `AccountScreen` gains a
  **Blocked users** section (list, block date, "Unblock" with its own confirmation).
- **Conversation state** (§8.2/§8.8) — `ChatThreadScreen` reflects `conversationStatus` from
  `GET /api/chats`: a normal composer when `active`; a disabled input + "Conversation Closed" +
  "Request Reopen" when `closed`; "Reopen request sent" for the requester vs. an Accept/Reject
  banner for the recipient when `reopen_requested`; a "blocked" notice when `blocked`. "Close
  Conversation" lives in the same "⋯" menu, with the brief's exact confirmation copy. The pure
  state → UI mapping is `src/screens/chatThreadState.ts` (unit-tested).
- **Explicit photo consent** (§8.4) — `ProfileDetailScreen` never auto-reveals a photo once the
  existing subscribe+accepted gate passes; it shows "Request Photo" instead, reflects
  `photoAccessStatus` (none/pending/accepted/rejected), and surfaces an incoming request (via its
  notification landing here, and an inline Accept/Reject box) for the photo's owner.
- **Wali sharing** (§8.5) — bride-side conversations get a "Share Conversation with Wali" action
  in `ChatThreadScreen`'s menu, handing the returned link to the OS share sheet (`Share` from
  `react-native`) so the user sends it themselves via SMS/WhatsApp/etc.; the same menu shows
  current share status and offers "Revoke". No in-app Wali login/view — the Wali's own read-only
  page is server-rendered and reached only via the shared link, entirely outside this app.
- **Generalized notifications** (§8.6) — `TabHeader`'s panel reads the new `type`/`title`/
  `message`/`referenceId` shape and resolves where a tap should go centrally via
  `src/navigation/notificationTarget.ts` (unit-tested), rather than every screen repeating the
  same `onOpenNotification` callback.
- **`profileComplete` onboarding gate** (§8.7) — `RootNavigator` switches on the backend-computed
  `profileComplete` (falling back to the same formula client-side if a backend snapshot hasn't
  landed the field yet — see `RootNavigator.tsx`). The wali notice on `ShariahQAScreen` is
  gender-conditional: fixed/required copy for a bride, genuinely skippable for a groom.
- **Keyboard-aware forms** (§8.11) — `WelcomeScreen`, `ShariahQAScreen` and `ProfileSetupScreen`
  all use `react-native-keyboard-aware-scroll-view`'s `KeyboardAwareScrollView` (one consistent
  approach app-wide, replacing hand-rolled `KeyboardAvoidingView` offsets) so the keyboard never
  covers the focused field.
- **Chat input** (§8.11) — `ChatThreadScreen`'s composer is a multiline, auto-growing `TextInput`
  (grows up to ~5 lines, then scrolls internally, capped at 720px wide on tablet/desktop widths),
  with Enter/return inserting a newline and a dedicated send button submitting — the common
  messaging-app convention — instead of the old single-line field.
- **Screenshot protection** (§8.10) — `usePreventScreenCapture()` (via
  `src/hooks/useScreenshotReporting.ts`) is active on `ProfileDetailScreen` and
  `ChatThreadScreen`, and a detected screenshot is reported to
  `POST /api/security/screenshot-event`. **This only sets Android's `FLAG_SECURE` — on iOS and
  web a screenshot can never be prevented, only detected after the fact, and neither platform can
  detect screen recording or a second device photographing the screen.** Android also needs
  `READ_MEDIA_IMAGES`/`READ_EXTERNAL_STORAGE` (requested on mount, best-effort) for the listener to
  fire at all pre/at API 33.

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
- `src/screens/__tests__/chatThreadState.test.ts` — the conversation-lifecycle → UI state
  derivation (§8.2/§8.8): every `conversationStatus`, the requester/recipient split on a pending
  reopen, and the `canMessage: false`-while-`active` "limited" case.
- `src/navigation/__tests__/notificationTarget.test.ts` — the generalized-notification →
  navigation-target mapping (§8.6) for every `type`, including the `screenshot_alert` /
  `conversationId` special case and missing-`referenceId` fallbacks.

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
