# Build 195 — Rollback Plan

**Shipped from:** working tree on `build-155-voice-disabled` (includes Sprints 8–11, uncommitted at ship time)  
**Last known-good TestFlight (Build 194):** `1ebf06b` — Sprint 7 equipment & nutrition adaptation

---

## If Build 195 fails or testers report blockers

### Option A — Rebuild previous commit on TestFlight (~25 min)

```bash
git stash push -u -m "build-195-wip"   # save current work
git checkout 1ebf06b
npm run build:testflight-rc
npm run submit:ios
git checkout build-155-voice-disabled
git stash pop                          # restore WIP
```

### Option B — Keep code, disable broken feature only

Revert specific files from `1ebf06b` without full rollback:

```bash
git checkout 1ebf06b -- src/app/(tabs)/progress.tsx   # example: Progress only
```

Then rebuild TestFlight.

---

## What Build 195 adds vs 194

| Sprint | Risk area |
|--------|-----------|
| 8 | ExerciseCoachCard, coaching API routes |
| 9 | Feedback confusion type (needs migration 019) |
| 10 | Docs only (no code fixes shipped) |
| 11 | Progress tab transformation redesign |

**Backend:** Deploy Render + run `migrate:019` for full Sprint 8–9 server features.

---

## Verification after rollback build

```bash
npm run build:testflight-rc -- --dry-run   # expect 7/7
```

TestFlight build number should increment; testers install the new build from App Store Connect.
