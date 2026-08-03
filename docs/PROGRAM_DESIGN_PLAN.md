# Program Design Audit & Plan

An audit of how ONE MORE builds training programs, why bodyweight movements were missing, and a
research-grounded plan for better muscle focus and exercise combinations.

Findings below are measured from the codebase, not estimated.

---

## 1. Why you never saw push-ups or sit-ups

Your Month 1 blueprint **does** program them. They were being deleted downstream.

Measured from `backend/src/lib/liftingReference/month1Workouts.ts` (24 workouts, 234 exercise slots):

| Metric | Count |
| --- | --- |
| Unloaded bodyweight slots | 31 (13.2%) |
| Push-up variants | 4 (Push-Up, Close-Grip, Deficit, Diamond) |
| Plank variants | 5 unloaded |
| Sit-up / crunch variants | Decline Sit-Up, Reverse Crunch, Bicycle Crunch, Toe Touch Crunch |

So the programming intent was sound. The loss happened in equipment filtering.

### Root cause

`EQUIPMENT_PRESETS` in `src/constants/equipmentCatalog.ts` did not include the `bodyweight` id for
four of seven presets. Expanding those presets produced a requirement set with no `bodyweight` key:

| Preset | `bodyweight` requirement (before fix) |
| --- | --- |
| `home_minimal`, `home_gym`, `full_gym` | present |
| `garage_gym`, `planet_fitness`, `commercial_gym`, `powerlifting_gym` | **absent** |

Push-Up, Plank and Sit-Up carry `metadata.requires: ['bodyweight']`, so `exerciseMeetsEquipment()`
rejected them and they never entered the candidate pool. Because "Commercial Gym" is the most common
onboarding answer, most users lost every floor-based movement.

The failure was silent. When a blueprint block cannot be resolved, `resolveBlockExercise()` falls
through to a weighted substitute, or the block is skipped entirely:

```409:411:backend/src/lib/liftingReference/referenceProgramLoader.ts
    if (!catalogExercise) {
      continue;
    }
```

The bodyweight safety net only triggered when the pool fell below ten exercises, which never happens
at a commercial gym:

```459:462:backend/src/lib/workoutPlanner.ts
  if (filtered.length < WORKOUT_TARGET_EXERCISES) {
    const expanded = expandAvailableEquipment([...equipment, 'bodyweight']);
```

### Fix applied

`expandEquipmentRequirements()` now always includes `bodyweight`, in both the backend and client
copies. Bodyweight requires no equipment, so it is available at every training location.

`pull_up_bar` remains a separate requirement key, so pull-ups and hanging leg raises stay correctly
gated behind actually owning a bar. All 101 backend tests pass.

---

## 2. Research basis

Two findings drive the recommendations.

**Volume follows a dose-response curve with diminishing returns.** A 2025 meta-regression
(Pelland et al., 67 studies, 2,058 participants) found hypertrophy increases with weekly sets per
muscle with no clear plateau, best fit by a square-root model. Critically, the strongest-evidence
counting method was *fractional*: indirect sets count as half. Your current `SPLIT_VOLUME_TARGETS`
count every set as whole, which overstates real volume.

**Bodyweight builds muscle when effort is matched.** Kikuchi & Nakazato (2017) found push-ups at
matched relative load produced chest and triceps growth statistically equivalent to bench press over
eight weeks. Calatayud et al. (2015) found band push-ups and 6RM bench press produced similar
strength gains at comparable EMG. Hypertrophy is load-independent when sets approach failure.

The practical implication: bodyweight movements are not a downgrade or a fallback for people without
equipment. They are legitimate primary work, and excluding them removes tools that are often
*better* for core, conditioning, and joint-friendly volume.

---

## 3. What the audit found beyond the bodyweight bug

### Two parallel program architectures

| | Reference path | Adaptive path |
| --- | --- | --- |
| Used when | `body_part_split`, 3–7 days, Mon–Sat | everything else |
| Exercise source | fixed Month 1 blueprint | scored selection from pool |
| Volume control | hardcoded sets in JSON | 3 sets × ~10 exercises |
| Tempo | prescribed | not assigned |

Most users hit the reference path, because `inferProgramType()` returns `body_part_split` for nearly
every input combination.

### Weekly per-muscle volume is never actually computed

`SPLIT_VOLUME_TARGETS` in `liftingProgrammingRules.ts` defines targets (~12 sets/muscle), but they
are only used as an AI prompt hint and in tests. The adaptive path has no weekly set accumulator. It
balances by exercise *count* quotas, not sets:

```95:125:backend/src/lib/workoutPlanner.ts
export const BODY_PART_DAY_PLANS: Record<string, DayFocusPlan> = {
  back_biceps_core: {
    quotas: [
      { muscles: ['back'], min: 4 },
      { muscles: ['biceps'], min: 3 },
      { muscles: ['core'], min: 3 },
    ],
```

Four back exercises could mean 8 sets or 20. Nothing verifies the result.

### Selection scoring quietly prefers dumbbells

```604:614:backend/src/lib/workoutPlanner.ts
    if (fieldReq && available.has(fieldReq)) {
      score += 15;
    }
    if (exercise.equipment === 'dumbbell' && available.has('dumbbells')) {
      score += 8;
    }
    if (exercise.equipment === 'bodyweight' && available.has('bodyweight')) {
      score += 6;
    }
```

Dumbbells total +23, bodyweight +21. Combined with a catalog that is roughly 79% weighted, bodyweight
rarely wins a slot even now that it is eligible.

### Catalog data quality

The canonical catalog is 500 system exercises (105 bodyweight, 59 core-related). Migration 024 bulk
import used `ON CONFLICT (slug) DO UPDATE` and overwrote curated rows from migrations 022/023:

| Slug | Correct | After 024 |
| --- | --- | --- |
| `glute-bridge` | bodyweight | **bands** |
| `russian-twist` | bodyweight | **rower** |
| `bicycle-crunch` | bodyweight | **rower** |
| `walking-lunge` | bodyweight | **machine** |
| `reverse-lunge` | bodyweight | **machine** |
| `nordic-curl` | bodyweight | **barbell** |
| `plank` | core category | **push** category |

These mis-tags mean the fix above does not fully surface them: a lunge tagged `machine` still needs a
machine. Only 15 of 59 core exercises carry `category = 'core'`.

Separately, 84 slugs referenced by `month1ExerciseSlugMap.ts` do not exist in the catalog at all,
including `inverted-row`, `hanging-knee-raise`, and `ab-wheel-rollout`. Every one is a silently
skipped block.

### Missing staples

Absent from the catalog entirely: pike push-up, inverted row, superman, bird dog, floor leg raise,
bodyweight hip thrust, ab wheel rollout, bodyweight squat variants beyond the base entry.

---

## 4. The plan

Ordered by impact per unit of risk. Phase 1 is done.

### Phase 1 — Unblock bodyweight (complete)

Bodyweight available at every location. Push-ups, planks, sit-ups, dips and bodyweight squats can now
be selected. Low risk, no schema change.

### Phase 2 — Repair catalog data integrity

A data migration correcting the rows migration 024 overwrote: equipment back to `bodyweight` for
glute bridge, russian twist, bicycle crunch, the lunge family, nordic curl; `category = 'core'` for
the 44 mis-categorised core movements.

Then seed the missing staples: pike push-up, inverted row, superman, bird dog, floor leg raise,
bodyweight hip thrust, ab wheel rollout, hanging knee raise, and the 84 slugs the Month 1 map already
expects.

This is where most of the remaining "why is it always weights" behaviour actually lives. Without it,
Phase 1 only half-works.

### Phase 3 — Real weekly volume accounting

Introduce a per-muscle weekly set ledger using **fractional counting** (direct sets = 1.0, indirect =
0.5), matching the strongest-evidence method from the 2025 meta-regression.

Targets per muscle per week, by goal:

| Goal | Sets/muscle/week | Primary rep range |
| --- | --- | --- |
| Hypertrophy | 12–20 | 6–12 |
| Strength | 10–16 | 3–6 |
| Fat loss / recomp | 10–16 | 8–15 |
| General fitness | 8–14 | 8–15 |

The generator validates each planned week against the ledger and fills deficits before persisting,
instead of trusting exercise-count quotas. Convert `SPLIT_VOLUME_TARGETS` from documentation into an
enforced constraint.

### Phase 4 — Movement-pattern balance, not just muscle balance

Guarantee weekly coverage across patterns rather than body parts:

- horizontal press / horizontal pull (balanced, pull ≥ press to protect shoulder health)
- vertical press / vertical pull
- squat (knee-dominant) / hinge (hip-dominant)
- single-leg
- core: anti-extension, anti-rotation, flexion
- carry / bracing

This is what produces "excellent exercise combinations" — the antagonist balance is structural, not
incidental. Your `movementPatternExclusion.ts` already has the vocabulary; it currently only prevents
duplicates rather than guaranteeing coverage.

### Phase 5 — Deliberate bodyweight role assignment

Rather than letting bodyweight compete on score and lose, give it defined jobs:

| Role | Movements | Rationale |
| --- | --- | --- |
| Core block (every session) | plank, dead bug, pallof, hollow hold, reverse crunch | no equipment contention, high transfer |
| Primary when effort-matched | push-up variants, dip, pull-up, inverted row | evidence-equivalent to loaded |
| Metabolic finisher | burpee, mountain climber, jump squat | conditioning without extra load |
| Deload / high-fatigue days | bodyweight squat, lunge, push-up | recovery-appropriate volume |
| Joint-friendly substitute | for flagged limitations | already partly wired |

Concretely: reserve one to two slots per session for the pattern rather than the implement, so a
full-gym user still gets a push-up or plank where it is the better tool. Add an explicit bodyweight
score bonus for the core and finisher roles instead of relying on the +6 tiebreak.

### Phase 5b — Experience-scaled volume (complete)

The blueprint prescribed **4 sets on 94.9% of its 234 slots**, averaging 38.5 working sets across 9.8
exercises per session. `training_experience` was stored as an enum, loaded into the profile, and read
only by the AI prompt — it never changed a single set.

`backend/src/lib/experienceVolume.ts` now caps sets and exercise count by experience, with a
four-week ramp for beginners:

| Level | Sets/exercise | Exercises | Session working sets |
| --- | --- | --- | --- |
| Beginner, weeks 1–4 | 2 | 7 | 14 (~39 min) |
| Beginner, week 5+ | 3 | 8 | 24 (~61 min) |
| Intermediate | 3 | 9 | 26 (~66 min) |
| Advanced | 4 | 10 | 31 (~77 min) |
| Elite | 5 | 12 | — |

The cap never inflates a deliberately light prescription, and the session-length estimate floor
dropped from a hardcoded 50 minutes to 20 so a shorter beginner session is described honestly. The
reason is surfaced in the plan rationale rather than silently changing the numbers.

**On the evidence:** the justification is *not* that beginners grow better on less. Krieger's
meta-regressions found 2–3 sets beat 1 set for both strength (+46%) and hypertrophy (+40%), with
explicitly **no interaction with training status**. The case for starting lower is tolerance and
adherence: the ACSM position stand recommends 1–3 sets for novices (evidence category A); volume is
the primary driver of early-phase soreness, which falls sharply after 2–3 sessions via the repeated
bout effect; and in a cohort of 522,994 app users only 18.1% of beginners were still training at six
months, with **consistency in the first 28 days the strongest predictor of adherence**. In the
STRRIDE trials, 67% of dropouts quit before or during ramp-up. Starting at a dose people can finish
is a retention strategy, not a compromise on results.

### Phase 6 — Use the variables you already collect but ignore

Three inputs are captured and discarded:

- `minutesPerWorkout` is stored by `coachActivation.ts` and never read. Session length should drive
  exercise count and superset density — a 30-minute session should pair antagonists, not truncate.
- `ageAdjustments.ts` exists with joint-friendly multipliers and is imported by nothing.
- `training_experience` is passed to the AI prompt but never branches rep schemes in the heuristic
  path.

Wiring these is what makes the program feel personalised rather than templated.

### Phase 7 — Progression depth

Add RPE / reps-in-reserve targets alongside the existing e1RM notes, and make bodyweight progression
explicit: reps → tempo → leverage → added load. Currently `suggestWeightLbs()` correctly returns
`undefined` for bodyweight, but nothing then tells the user *how* to progress, so those movements feel
like filler.

---

## 5. Sequencing

Phases 1–2 are correctness work and should land before any TestFlight that showcases programming;
Phase 1 alone will visibly change what users see. Phase 3 is the largest behavioural change and
deserves its own validation script comparing generated weeks against volume targets. Phases 4–7 are
incremental quality and can ship independently.

Suggested guardrails, matching the existing `scripts/validate-*` pattern:

- `validate:weekly-volume` — every generated week meets per-muscle fractional targets
- `validate:movement-balance` — pattern coverage and pull/press ratio
- `validate:bodyweight-presence` — every location, including full gym, receives bodyweight work
- `validate:catalog-integrity` — no blueprint slug missing from the catalog, no mis-tagged staples

The last one would have caught this bug before it reached a build.

---

## Appendix — the longevity dose

Worth separating from the hypertrophy question, because the answer is strikingly different.

For **health outcomes rather than maximum muscle**, the effective dose is very low. Momma et al.
(BJSM 2022, 16 cohort studies) found a J-shaped curve with maximum risk reduction of 10–20% for
all-cause mortality, cardiovascular disease and total cancer at roughly **30–60 minutes per week** of
muscle-strengthening activity, with the lowest relative risk at 40 min/week. Shailendra et al. (AJPM
2022) found a 27% maximum reduction at around 60 min/week, with benefits diminishing above that. A
2025 analysis of 147,374 participants followed up to 30 years found benefits plateauing near 120
min/week, and the largest reductions when resistance training was combined with aerobic work.

The implication for a longevity-focused product: the beginner prescription above (~39 minutes,
2–3 sessions per week) already sits in the range associated with the largest mortality benefit. More
volume serves physique and performance goals, not healthspan. That is a genuinely motivating message
for the users most likely to quit — the floor for health benefit is far lower than most people think,
and the app should say so rather than implying that only long sessions count.

A useful framing for the UI: separate a **health floor** (hit this and you have earned the mortality
benefit) from **goal volume** (what physique or strength progress requires). Beginners hitting the
floor consistently should be told they are succeeding, not shown a completion percentage against an
advanced lifter's workload.

## Suggested reading

Programming and volume:

- Haff & Triplett, *Essentials of Strength Training and Conditioning* (NSCA, 4th ed.) — the field
  textbook; volume/intensity prescription by training status.
- Zatsiorsky, Kraemer & Fry, *Science and Practice of Strength Training* (3rd ed.) — the theory
  behind why novices and advanced lifters need different doses.
- Helms, Morgan & Valdez, *The Muscle and Strength Pyramid: Training* — the most practical
  evidence-to-application bridge; prioritises adherence explicitly.
- Israetel et al., *Scientific Principles of Hypertrophy Training* — the MEV/MAV/MRV framework, which
  is essentially the formal version of the volume ramp implemented above.
- Rippetoe & Baker, *Practical Programming for Strength Training* — the clearest treatment of why
  novice progression differs structurally from intermediate.
- Bompa & Buzzichelli, *Periodization: Theory and Methodology of Training* — long-horizon planning.

Longevity and health outcomes:

- Attia, *Outlive* — muscle mass and strength as healthspan determinants.
- Lieberman, *Exercised* — why adherence fails, from an evolutionary angle. Useful product thinking.
- ACSM, *Guidelines for Exercise Testing and Prescription* (11th ed.) — the reference standard for
  minimum effective dose.

## References

- Krieger JW. *Single versus multiple sets of resistance exercise: a meta-regression.* J Strength
  Cond Res, 2009. 2–3 sets = 46% greater strength gains than 1 set; no training-status interaction.
- Krieger JW. *Single vs. multiple sets of resistance exercise for muscle hypertrophy: a
  meta-analysis.* J Strength Cond Res, 2010. Multiple sets = 40% greater hypertrophy effect sizes.
- ACSM. *Progression Models in Resistance Training for Healthy Adults* (position stand), 2009.
  1–3 sets for novices, evidence category A; 2–3 days/week novice frequency.
- Momma H et al. *Muscle-strengthening activities are associated with lower risk and mortality in
  major non-communicable diseases.* BJSM, 2022. J-shaped curve, peak benefit 30–60 min/week.
- Shailendra P et al. *Resistance Training and Mortality Risk: A Systematic Review and
  Meta-Analysis.* AJPM, 2022. 27% maximum risk reduction at ~60 min/week.
- Doma K et al. *The Repeated Bout Effect of Multiarticular Exercises on Muscle Damage Markers.*
  J Strength Cond Res, 2023.
- *Predictors of long-term resistance exercise adherence among beginners.* SportRxiv, 2024.
  522,994 app users; 18.1% beginner adherence at 6 months; first-28-day consistency dominant.
- Pelland JC et al. *The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of
  Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains.* Sports Medicine, 2025.
  67 studies, 2,058 participants.
- Kikuchi N, Nakazato K. *Low-load bench press and push-up induce similar muscle hypertrophy and
  strength gain.* J Exercise Science & Fitness, 2017.
- Calatayud J et al. *Bench press and push-up at comparable levels of muscle activity results in
  similar strength gains.* J Strength Cond Res, 2015.
- Schoenfeld BJ et al. *Dose-response relationship between weekly resistance training volume and
  increases in muscle mass.* J Sports Sciences, 2017.
