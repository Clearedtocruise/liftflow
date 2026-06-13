# Sprint 9 — Private Beta Program (ONE MORE)

**Objective:** Validate ONE MORE with real users before public launch.  
**Status:** Infrastructure ready (Sprints 8.5–8.7) · **Execution not started** (0/10 testers as of last daily report)  
**Build:** Wait for founder approval — no TestFlight build in this sprint until sign-off.

---

## Verdict: Does it exist?

| Layer | Exists? | Notes |
|-------|---------|-------|
| TestFlight RC pipeline | ✓ | `npm run build:testflight-rc` |
| Beta invite codes | ✓ | `LIFTFLOW-INTERNAL` (10), `LIFTFLOW-BETA25` (25), `LIFTFLOW-BETA50` (50) |
| In-app feedback | ✓ | Settings → Report bug / Confusion / Feature |
| Crash tracking | ✓ | Sentry mobile + backend |
| Soak analytics | ✓ | `app_events`, `/api/beta/soak-status` |
| Daily ops automation | ✓ | `npm run beta:daily-report` |
| Persona-based recruitment | **Sprint 9** | [SPRINT9_TESTER_ROSTER.md](./SPRINT9_TESTER_ROSTER.md) |
| Issue categorization | **Sprint 9** | `issue_category` + [SPRINT9_FEEDBACK_TRIAGE.md](./SPRINT9_FEEDBACK_TRIAGE.md) |
| Fix roadmap | **Sprint 9** | [SPRINT9_FIX_ROADMAP.md](./SPRINT9_FIX_ROADMAP.md) |
| 10+ active testers | ✗ | Blocked on recruitment + TestFlight distribution |

**Bottom line:** ~85% of the beta *platform* was built in Sprints 8.5–8.7. Sprint 9 adds persona framing, feedback taxonomy, triage workflow, and execution docs — then runs the program.

---

## Recruitment personas (target: 12 testers)

Recruit **at least 2 testers per persona** (10 minimum, 12 target with overflow).

| Persona | Who | Gym context | What to stress |
|---------|-----|-------------|----------------|
| **P1 — Beginner** | &lt;6 months lifting, needs guidance | Any | Onboarding, coach prescriptions, simple logging |
| **P2 — Intermediate** | 1–3 years, follows a program | Commercial | Weekly plan, progression, recovery scores |
| **P3 — Advanced** | 3+ years, tracks volume/intensity | Commercial | Smart progression, deload logic, exercise detail |
| **P4 — Home gym** | Limited equipment | Home | Equipment prefs, substitutions, bodyweight flows |
| **P5 — Commercial gym** | Full rack of machines | Commercial | Voice logging, supersets, peak music, watch |

Map each recruit in [SPRINT9_TESTER_ROSTER.md](./SPRINT9_TESTER_ROSTER.md).

### Invite waves

| Wave | Code | When | Count |
|------|------|------|-------|
| Internal soak | `LIFTFLOW-INTERNAL` | Week 1 | 10–12 |
| Closed beta | `LIFTFLOW-BETA25` | After Wave 1 authorized | +15 |
| Expand | `LIFTFLOW-BETA50` | After 2 weeks zero P0 | +25 |

Wave 1 gate: [SPRINT87_WAVE1_AUTHORIZATION.md](./SPRINT87_WAVE1_AUTHORIZATION.md)

---

## What we track

| Signal | Source | Owner |
|---------|--------|-------|
| **Crashes** | Sentry + `issue_category: crash` | Founder daily |
| **Confusion** | In-app “Something confused me” + area tag | Triage doc |
| **Missing features** | Feature request + “should already exist” toggle | Triage doc |
| **Feature requests** | In-app feature request | Triage doc |
| **Engagement** | `npm run beta:daily-report` soak events | Automated |

---

## Acceptance criteria

| Criterion | Target | How to verify |
|-----------|--------|---------------|
| 10+ testers | ≥10 redeemed invites + TestFlight install | Roster + soak-status API |
| Feedback collected | ≥1 submission per active tester | `/api/feedback/summary` `byCategory` |
| Issues categorized | All open items have category + severity | [SPRINT9_FEEDBACK_TRIAGE.md](./SPRINT9_FEEDBACK_TRIAGE.md) |
| Fix roadmap generated | P0/P1 assigned to build targets | [SPRINT9_FIX_ROADMAP.md](./SPRINT9_FIX_ROADMAP.md) |

---

## Week-by-week execution

### Week 0 — Preflight (founder)

```bash
npm run migrate:015          # if not applied
npm run migrate:019          # Sprint 9 feedback taxonomy
npm run seed:beta-invites
npm run validate:sprint9-private-beta
# After approval:
npm run build:testflight-rc
```

### Week 1 — Internal soak (10–12 testers)

1. Send TestFlight link + `LIFTFLOW-INTERNAL` code
2. Each tester completes [SPRINT9_BETA_TESTING_CHECKLIST.md](./SPRINT9_BETA_TESTING_CHECKLIST.md) (persona section)
3. Daily: `npm run beta:daily-report`
4. Triage: update [SPRINT9_FEEDBACK_TRIAGE.md](./SPRINT9_FEEDBACK_TRIAGE.md)
5. Weekly: update [SPRINT9_FIX_ROADMAP.md](./SPRINT9_FIX_ROADMAP.md)

### Weeks 2–3 — Closed beta (+15)

- Issue `LIFTFLOW-BETA25` only when daily report shows **Wave 1: AUTHORIZED**
- Continue daily report + triage loop

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [SPRINT9_BETA_TESTING_CHECKLIST.md](./SPRINT9_BETA_TESTING_CHECKLIST.md) | Per-persona test scripts |
| [SPRINT9_FEEDBACK_TRIAGE.md](./SPRINT9_FEEDBACK_TRIAGE.md) | Living issue board |
| [SPRINT9_FIX_ROADMAP.md](./SPRINT9_FIX_ROADMAP.md) | Prioritized fixes |
| [SPRINT9_TESTER_ROSTER.md](./SPRINT9_TESTER_ROSTER.md) | Recruit tracker |
| [BETA_SUPPORT_PLAYBOOK.md](./BETA_SUPPORT_PLAYBOOK.md) | SLA + escalation |
| [CLOSED_BETA_INTERNAL_TESTING_PLAN.md](./CLOSED_BETA_INTERNAL_TESTING_PLAN.md) | Original 8.6 plan |

---

## Founder API quick reference

```bash
# List feedback (founder key required)
curl -H "x-founder-admin-key: $FOUNDER_ADMIN_KEY" \
  "$API/api/feedback/list?limit=50"

# Triage status update
curl -X PATCH -H "x-founder-admin-key: $FOUNDER_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"triaged"}' \
  "$API/api/feedback/{id}/status"
```
