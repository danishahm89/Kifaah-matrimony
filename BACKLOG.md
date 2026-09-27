# Kifaah backlog

Source: India market audit, 28 Sep 2026. Keep this list up to date. Tick items when they are deployed.

## Batch 1 — done in code, not yet deployed

- [x] Private photos: no public `/uploads`; photos only via short-lived signed links
- [x] Profile view: block and gender checks; Wali hidden until mutual accept
- [x] Report a profile (reasons, optional block)
- [x] Delete my account (two-step confirm, removes personal data)
- [x] Terms, Privacy, Refund and Grievance pages; "marriage only, not dating" line on login

## Batch 2 — in progress

- [ ] "Why this match" reasons on Discover cards
- [ ] Nightly database backup script (install on VPS when asked)
- [ ] Hide mock Admin and Health screens in production; lock chat socket to our domains
- [ ] Edit profile screen + profile completion meter
- [ ] Discover filters (age, city, sect, marital status) + paging

## Later — in this order

1. Real SMS OTP (Twilio) and `NODE_ENV=production` before public launch. Ignored while in test phase.
2. Error monitoring (Sentry DSN).
3. Test payments with Razorpay test keys; check webhook.
4. Admin review screen for reports (list, mark reviewed, suspend profile).
5. More reference data: states, more cities, mother tongue, education and profession as separate lists.
6. Partner preferences, used in matching.
7. Selfie verification + verified badge.
8. Limited free chat after mutual accept; one payer opens chat.
9. Parent / sibling-created profiles.
10. Wali approval step before contact is shared.
11. Hindi interface; Urdu translation of policy pages.
12. Staging environment + scripted deploy (build web in CI, not on the server).
13. Auto-expire old pending interests.
14. Assisted matchmaking plan.
15. Optional ID verification (e.g. DigiLocker).
16. Lawyer review of Terms, Privacy, Refund; name a real Grievance Officer.
17. **Last step before production:** move all secrets (`.env`, DB password, JWT secret, Google Drive key, Android keystore) out of Git into AWS (Secrets Manager or a private S3 bucket), change them all, and clean them from Git history. Kept in Git until then on purpose: the repo is private and only used for testing with friends.
