# TestFlight — Internal Testing Checklist (Sprint 8.6)

For **internal testers** (founder team + `LIFTFLOW-INTERNAL` invite) before inviting closed beta.

## Tester setup

- [ ] Install from TestFlight (not Expo Go)
- [ ] Redeem internal invite: Settings → Beta Access → `LIFTFLOW-INTERNAL`
- [ ] Sign in with dedicated test account (not production personal email if possible)
- [ ] Enable notifications when prompted

---

## Session 1 — Core (30 min)

| Step | Pass | Notes |
|------|------|-------|
| Sign up / login | ☐ | |
| Legal onboarding accept | ☐ | |
| Profile onboarding (all steps) | ☐ | |
| Dashboard loads | ☐ | |
| Start workout from plan | ☐ | |
| Log 3 sets manually | ☐ | |
| Voice: “Log 225 for 5” | ☐ | |
| Rest timer fires | ☐ | |
| Finish workout → coach summary | ☐ | |
| Workout appears in history | ☐ | |

---

## Session 2 — Intelligence (20 min)

| Step | Pass | Notes |
|------|------|-------|
| Recovery intelligence screen | ☐ | Pro gate if free |
| Nutrition intelligence screen | ☐ | |
| Smart progression card on workout | ☐ | |
| AI Coach chat (typed) | ☐ | |
| Voice: “How recovered am I?” | ☐ | |
| Voice: “What should I train today?” | ☐ | |

---

## Session 3 — Premium (20 min)

Requires sandbox Apple ID + RevenueCat configured.

| Step | Pass | Notes |
|------|------|-------|
| Upgrade screen loads offerings | ☐ | |
| Start free trial | ☐ | |
| Pro features unlock | ☐ | |
| Restore purchases | ☐ | |
| Manage subscription link works | ☐ | |

---

## Session 4 — Advanced (optional hardware)

| Step | Pass | Notes |
|------|------|-------|
| Upload progress photo | ☐ | |
| Transformation projection | ☐ | Pro |
| Peak Music voice command | ☐ | Pro + Apple Music |
| HealthKit sync | ☐ | Physical iPhone |
| Apple Watch companion | ☐ | Paired Watch |

---

## Session 5 — Operations

| Step | Pass | Notes |
|------|------|-------|
| Report a bug (with screenshot) | ☐ | |
| Request a feature | ☐ | |
| Release notes screen | ☐ | |
| Force-quit crash → Sentry event | ☐ | Internal only |

---

## Sign-off

| Role | Name | Date | Pass |
|------|------|------|------|
| Founder | | | ☐ |
| QA lead | | | ☐ |

**Minimum for closed beta:** Sessions 1–3 pass on iPhone 13+ with zero P0 bugs.

See [DEVICE_TESTING_MATRIX.md](./DEVICE_TESTING_MATRIX.md) for device coverage.
