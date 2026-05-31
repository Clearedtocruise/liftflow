# Device Testing Matrix — TestFlight RC (Sprint 8.6)

LiftFlow is **iPhone-first** (portrait). iPad runs in compatibility mode — not a primary target.

## Required devices

Complete **Sessions 1–3** from [TESTFLIGHT_INTERNAL_TESTING_CHECKLIST.md](./TESTFLIGHT_INTERNAL_TESTING_CHECKLIST.md) on each row before closed beta.

| Device | iOS | Priority | Login | Workout | Voice | Subscription | Feedback | Crash (Sentry) |
|--------|-----|----------|-------|---------|-------|--------------|----------|----------------|
| iPhone SE (2nd/3rd gen) | 17+ | P0 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| iPhone 13 | 17+ | P0 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| iPhone 15 | 17+ | P0 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| iPhone 16 Pro | 18+ | P1 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| iPad (optional) | 17+ | P2 | ☐ | ☐ | ☐ | N/A | ☐ | ☐ |

---

## Flow definitions

| Flow | Steps |
|------|-------|
| **Login** | Sign up or login → reach dashboard |
| **Workout** | Start session → log 2+ sets → finish → history |
| **Voice** | Tap mic → “Log 135 for 8” → confirm → set logged |
| **Subscription** | Upgrade → sandbox trial → Pro gate opens → restore |
| **Feedback** | Settings → Send Feedback → bug + screenshot → success toast |
| **Crash** | Internal build only: trigger handled test error → Sentry dashboard event within 5 min |

---

## Environment matrix

| Environment | IAP | HealthKit | Watch | MusicKit | Use for RC |
|-------------|-----|-----------|-------|----------|------------|
| Expo Go | ✗ | ✗ | ✗ | ✗ | **No** |
| Dev client | Sandbox | ✓ | Partial | Partial | Internal dev |
| TestFlight | Sandbox | ✓ | ✓ | ✓ | **Yes — beta** |

---

## Known device-specific issues

See [SPRINT86_KNOWN_ISSUES.md](./SPRINT86_KNOWN_ISSUES.md).

| Device | Issue | Severity |
|--------|-------|----------|
| iPhone SE | Smaller mic button — verify voice UX | P2 |
| iPad | Layout not optimized — functional only | P2 |
| All | Render cold start 30–60s on first API call | P2 |

---

## Sign-off criteria

- **TestFlight RC:** All P0 devices pass Sessions 1–3
- **Closed beta:** Add iPhone 16 Pro + feedback/crash verified
- **Block release:** Any P0 on iPhone 13 or iPhone 15
