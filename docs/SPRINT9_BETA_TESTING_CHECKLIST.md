# Sprint 9 — Beta Testing Checklist

Use this during **private beta execution**. Composes existing checklists — do not skip foundational QA.

**Prerequisites:** TestFlight build installed · `LIFTFLOW-INTERNAL` redeemed · Pro beta access active

---

## Universal smoke (all personas, ~20 min)

Complete once per tester before persona-specific flows.

| Step | Action | Pass | Notes |
|------|--------|------|-------|
| 1 | Sign up or log in | ☐ | |
| 2 | Complete / skip onboarding | ☐ | |
| 3 | Redeem beta invite (Settings → Beta) | ☐ | |
| 4 | Open dashboard — no fake recovery numbers | ☐ | |
| 5 | Start a workout from weekly plan | ☐ | |
| 6 | Log 3 sets on one exercise | ☐ | |
| 7 | View coach prescription on active exercise | ☐ | |
| 8 | Finish or exit workout | ☐ | |
| 9 | Submit one feedback item (any category) | ☐ | |
| 10 | Check Release notes screen loads | ☐ | |

Full regression: [TESTFLIGHT_INTERNAL_TESTING_CHECKLIST.md](./TESTFLIGHT_INTERNAL_TESTING_CHECKLIST.md) (Sessions 1–3)

---

## Persona-specific paths (~15 min each)

### P1 — Beginner

| Step | Action | Pass |
|------|--------|------|
| 1 | Read onboarding coach copy — is intent clear? | ☐ |
| 2 | Start first workout without editing plan | ☐ |
| 3 | Use “Use coach target” on a set | ☐ |
| 4 | Submit **confusion** feedback if stuck (Settings) | ☐ |

**Success:** Completes first workout without founder help.

### P2 — Intermediate

| Step | Action | Pass |
|------|--------|------|
| 1 | Review weekly plan + day overview coach notes | ☐ |
| 2 | Log workout with planned rest presets | ☐ |
| 3 | Check recovery intelligence screen | ☐ |
| 4 | Submit feedback on progression accuracy | ☐ |

**Success:** Plan + progression feel coherent with training history.

### P3 — Advanced

| Step | Action | Pass |
|------|--------|------|
| 1 | Expand coach reasoning (`detailedReason`) | ☐ |
| 2 | Test deload / maintain / increase labels | ☐ |
| 3 | Voice log at least one set (if enabled) | ☐ |
| 4 | Report any missing advanced logging (RPE, tempo, etc.) | ☐ |

**Success:** Prescription logic matches expectations for experienced lifter.

### P4 — Home gym

| Step | Action | Pass |
|------|--------|------|
| 1 | Set equipment to home/minimal in profile | ☐ |
| 2 | Verify substitutions on planned workout | ☐ |
| 3 | Complete bodyweight or dumbbell exercise flow | ☐ |
| 4 | Flag missing equipment swaps as **missing_feature** | ☐ |

**Success:** Workout completable with stated home equipment.

### P5 — Commercial gym

| Step | Action | Pass |
|------|--------|------|
| 1 | Full barbell workout (3+ exercises) | ☐ |
| 2 | Test superset if present in plan | ☐ |
| 3 | Peak music or watch (if available) | ☐ |
| 4 | Sandbox subscription flow (optional, 2 testers) | ☐ |

**Success:** Full gym session without blockers.

---

## Device matrix

Minimum coverage across 10 testers ([DEVICE_TESTING_MATRIX.md](./DEVICE_TESTING_MATRIX.md)):

| Device class | Min testers |
|--------------|-------------|
| iPhone SE / small | 2 |
| iPhone 13–14 standard | 4 |
| iPhone 15 Pro / large | 2 |
| iOS version mix (N-1, N) | 2 on each major |

---

## Daily founder ops

```bash
npm run beta:daily-report
npm run validate:sprint9-private-beta   # weekly regression
```

Update:
- [SPRINT9_TESTER_ROSTER.md](./SPRINT9_TESTER_ROSTER.md)
- [SPRINT9_FEEDBACK_TRIAGE.md](./SPRINT9_FEEDBACK_TRIAGE.md)
- [SPRINT9_FIX_ROADMAP.md](./SPRINT9_FIX_ROADMAP.md)

Monitor: Sentry · `/admin/founder` · OpenAI usage · Render health

---

## Exit criteria (Sprint 9 complete)

- [ ] ≥10 testers on roster with TF install checked
- [ ] ≥10 feedback submissions with categories populated
- [ ] All items triaged in feedback board
- [ ] Fix roadmap has P0/P1 assigned to builds
- [ ] Wave 1 authorization evaluated ([SPRINT87_WAVE1_AUTHORIZATION.md](./SPRINT87_WAVE1_AUTHORIZATION.md))
- [ ] Zero recurring P1 (same bug ≥2 testers)

**Do not expand to `LIFTFLOW-BETA25` until exit criteria met.**
