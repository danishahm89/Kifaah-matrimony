# KIFAAH Matrimony — Session Context

## Project
Islamic matrimony app (Expo React Native Web) at `/opt/kifaah-matrimony/`
Live URL: https://kifaah.alzakwaantours.com
VPS: 82.112.227.246 (Hostinger) — access via hPanel → Manage VPS → Web Console (auto-logged in)

## Stack
- **Frontend**: Expo React Native (single codebase: web + mobile) at `mobile/`
- **Backend**: Node/Express at `backend/` (port 4000)
- **DB**: PostgreSQL (Docker, port 5432)
- **Hosting**: Docker Compose (`web` = nginx:alpine serving `mobile/dist/` on port 80)

## Build & Deploy
```bash
cd /opt/kifaah-matrimony/mobile
npx expo export --platform web --output-dir dist
cd /opt/kifaah-matrimony
docker compose restart web
```

## Key Architecture
- `mobile/App.tsx` — NavigationContainer + LinkingOptions (deep linking config)
- `mobile/src/navigation/MainTabNavigator.tsx` — Tab navigator + DesktopSidebar
  - `DESKTOP_BREAKPOINT = 768`, `SIDEBAR_WIDTH = 230`
  - `sceneContainerStyle={{ marginLeft: SIDEBAR_WIDTH }}` offsets content on desktop
- `mobile/src/navigation/RootNavigator.tsx` — Stack navigator wrapping Tab
- `mobile/src/components/Screen.tsx` — Layout wrapper (desktop centered max 700px, mobile max 480px)
- `mobile/src/theme/` — colors, fonts, ThemeContext (dark/light mode)
- `mobile/src/screens/` — all app screens

## Issues Fixed (as of this session)
1. **URL routing broken** — linking.prefixes in App.tsx was missing `https://kifaah.alzakwaantours.com`
   → Fixed: added production URL to prefixes
2. **Blank tabs (Matches/Account)** — `sceneContainerStyle` with marginLeft was missing from deployed code
   → Fixed: added to MainTabNavigator.tsx, rebuilt and deployed
3. **Desktop UI stretched** — Screen.tsx had no width constraints
   → Fixed: desktopContent (maxWidth:700, centered) + mobileWebContent (maxWidth:480)
4. **Mobile number input no padding** — WelcomeScreen.tsx phoneInput had no paddingHorizontal
   → Fixed: added paddingHorizontal: 12
5. **Cross-cutting concerns** — Added: ErrorBoundary, OfflineBanner, logger, HealthScreen, AdminScreen
   → Accessible from AccountScreen → "App Health & Logs" / "Admin Panel"

## Security Notes (IMPORTANT)
- **Photo upload**: Do NOT add local disk fallback — user will provide Google Drive credentials when ready
- **.env, google-drive-key.json, keystore/**: Committed to git (testing env, user explicitly allows)

## New Files Added This Session
- `mobile/src/components/ErrorBoundary.tsx`
- `mobile/src/components/OfflineBanner.tsx`
- `mobile/src/screens/HealthScreen.tsx`
- `mobile/src/screens/AdminScreen.tsx`
- `mobile/src/utils/logger.ts`

## Navigation Deep Links (after fix)
```
/welcome          → WelcomeScreen (login/register)
/onboarding/shariah → ShariahQA
/onboarding/profile → ProfileSetup
/discover         → Main > Discover tab
/matches          → Main > Matches tab
/messages         → Main > Chat tab
/account          → Main > Account tab
/profile/:id      → ProfileDetail
/thread/:userId   → ChatThread
/pricing          → Pricing
/payment          → Payment
/faq              → FAQ
/health           → HealthScreen (admin/observability)
/admin            → AdminScreen (admin panel)
```

## Git
Remote: origin (push with `git push origin main`)
Latest commits visible with `git log --oneline -5`

## Pending / Known Remaining Work
- Test after login to verify tabs render without sidebar overlap
- Desktop UI audit across all screens after login (Matches, Chat, Account, ProfileDetail)
- Google Drive photo upload integration (waiting for user's credentials)
- Backend: profile routes at `backend/src/routes/profile.ts` were modified
