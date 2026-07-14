# Exercise Database QA Report

Generated: 2026-06-24T15:24:08.052Z

## Summary

| Metric | Count |
|--------|------:|
| Exercises audited | 1000 |
| Incorrect muscle mappings (DB vs name) | 692 |
| Incorrect equipment mappings | 72 |
| Incorrect classification (category/type) | 972 |
| Exercises with generic-only education | 312 |
| Exercises missing media assets | 1000 |
| Critical spotlight failures | 7 |

> Runtime education uses name-based inference to correct catalog errors in the app.
> DB fixes should be applied via a future metadata migration.

## Incorrect muscle mappings

_Showing up to 40 of 692_

- **Wide Pull-Up** (`wide-pull-up`): stored `back` → expected `lats, mid back`
- **Goblet Squat** (`goblet-squat`): stored `lats` → expected `quads, glutes`
- **Face Pull** (`face-pull`): stored `shoulders` → expected `full body`
- **Zercher Carry** (`zercher-carry`): stored `biceps` → expected `full body`
- **Glute Kickback** (`glute-kickback`): stored `glutes` → expected `full body`
- **Band Calf Raise** (`band-calf-raise`): stored `calves` → expected `full body`
- **Smith Oblique Crunch** (`smith-oblique-crunch`): stored `core` → expected `cardiovascular`
- **Battle Rope Grip Wave** (`battle-rope-grip-wave`): stored `forearms` → expected `full body`
- **Burpee** (`burpee`): stored `full_body` → expected `cardiovascular`
- **Pallof Press** (`pallof-press`): stored `chest` → expected `full body`
- **Reverse Lunge with Row** (`reverse-lunge-with-row`): stored `back` → expected `lats, mid back`
- **Lateral Raise** (`lateral-raise`): stored `shoulders` → expected `full body`
- **Leg Extension** (`leg-extension`): stored `quads` → expected `full body`
- **Nordic Curl** (`nordic-curl`): stored `hamstrings` → expected `biceps`
- **Farmer Walk on Toes** (`farmer-walk-on-toes`): stored `calves` → expected `full body`
- **Russian Twist** (`russian-twist`): stored `core` → expected `full body`
- **Wrist Roller Walk** (`wrist-roller-walk`): stored `forearms` → expected `full body`
- **Burpee** (`burpee-fu0030`): stored `full_body` → expected `cardiovascular`
- **Kettlebell Row** (`kettlebell-row`): stored `back` → expected `lats, mid back`
- **Front Squat** (`front-squat`): stored `lats` → expected `quads, glutes`
- **Face Pull** (`face-pull-sh0034`): stored `shoulders` → expected `full body`
- **Yoke Walk** (`yoke-walk`): stored `biceps` → expected `full body`
- **Glute Kickback** (`glute-kickback-gl0039`): stored `glutes` → expected `full body`
- **Jump Rope Cardio** (`jump-rope-cardio`): stored `calves` → expected `cardiovascular`
- **TRX Plank** (`trx-plank`): stored `core` → expected `full body`
- **Hammer Wrist Curl** (`hammer-wrist-curl`): stored `forearms` → expected `biceps`
- **Sprint** (`sprint`): stored `cardiovascular` → expected `full body`
- **DB Thruster** (`db-thruster`): stored `full_body` → expected `quads, glutes, shoulders`
- **Pallof Press** (`pallof-press-ch0046`): stored `chest` → expected `full body`
- **Barbell Row** (`barbell-row`): stored `back` → expected `lats, mid back`
- **Lateral Raise** (`lateral-raise-sh0049`): stored `shoulders` → expected `full body`
- **Trap Bar Close Grip Press** (`trap-bar-close-grip-press`): stored `triceps` → expected `full body`
- **Leg Extension** (`leg-extension-qd0052`): stored `quads` → expected `full body`
- **Nordic Curl** (`nordic-curl-hm0053`): stored `hamstrings` → expected `biceps`
- **Farmer Walk on Toes** (`farmer-walk-on-toes-cv0055`): stored `calves` → expected `full body`
- **Russian Twist** (`russian-twist-co0056`): stored `core` → expected `full body`
- **Wrist Roller Walk** (`wrist-roller-walk-fa0057`): stored `forearms` → expected `full body`
- **Burpee** (`burpee-fu0060`): stored `full_body` → expected `cardiovascular`
- **Seated Cable Row** (`seated-cable-row`): stored `back` → expected `lats, mid back`
- **Goblet Squat** (`goblet-squat-la0063`): stored `lats` → expected `quads, glutes`

## Incorrect equipment mappings

_Showing up to 40 of 72_

- **Plate Curl** (`plate-curl`): stored `machine` → expected `dumbbell`
- **Plate Lat Pulldown** (`plate-lat-pulldown`): stored `machine` → expected `dumbbell`
- **Plate Row** (`plate-row`): stored `machine` → expected `dumbbell`
- **Cable Lat Pulldown** (`cable-lat-pulldown`): stored `rower` → expected `cable`
- **Plate Wrist Curl** (`plate-wrist-curl`): stored `machine` → expected `dumbbell`
- **Plate Calf Raise** (`plate-calf-raise`): stored `machine` → expected `dumbbell`
- **Cable Kickback** (`cable-kickback`): stored `barbell` → expected `cable`
- **Cable Wood Chop** (`cable-wood-chop`): stored `bodyweight` → expected `cable`
- **Cable Kickback** (`cable-kickback-gl0249`): stored `machine` → expected `cable`
- **Cable Wood Chop** (`cable-wood-chop-ch0256`): stored `kettlebell` → expected `cable`
- **Plate Hammer Curl** (`plate-hammer-curl`): stored `machine` → expected `dumbbell`
- **Cable Kickback** (`cable-kickback-gl0279`): stored `bodyweight` → expected `cable`
- **Plate Straight Arm Pulldown** (`plate-straight-arm-pulldown`): stored `machine` → expected `dumbbell`
- **Cable Kickback** (`cable-kickback-gl0309`): stored `bodyweight` → expected `cable`
- **Cable Wood Chop** (`cable-wood-chop-ch0316`): stored `machine` → expected `cable`
- **Cable Speed Curl** (`cable-speed-curl`): stored `rower` → expected `cable`
- **Cable Kickback** (`cable-kickback-gl0339`): stored `dumbbell` → expected `cable`
- **Cable Wood Chop** (`cable-wood-chop-ch0346`): stored `bands` → expected `cable`
- **Cable Straight Arm Pulldown** (`cable-straight-arm-pulldown`): stored `rower` → expected `cable`
- **Cable Kickback** (`cable-kickback-gl0369`): stored `barbell` → expected `cable`
- **Plate Reverse Wrist Curl** (`plate-reverse-wrist-curl`): stored `machine` → expected `dumbbell`
- **Cable Wood Chop** (`cable-wood-chop-ch0376`): stored `rower` → expected `cable`
- **Cable Kickback** (`cable-kickback-gl0399`): stored `machine` → expected `cable`
- **Plate Single Leg Calf Raise** (`plate-single-leg-calf-raise`): stored `machine` → expected `dumbbell`
- **Cable Wood Chop** (`cable-wood-chop-ch0406`): stored `dumbbell` → expected `cable`
- **Cable Wood Chop** (`cable-wood-chop-co0446`): stored `rower` → expected `cable`
- **Plate Pinch Walk** (`plate-pinch-walk`): stored `bodyweight` → expected `dumbbell`
- **Plate Preacher Curl** (`plate-preacher-curl`): stored `machine` → expected `dumbbell`
- **Cable Wood Chop** (`cable-wood-chop-co0476`): stored `dumbbell` → expected `cable`
- **Plate Pinch Walk** (`plate-pinch-walk-fa0477`): stored `bodyweight` → expected `dumbbell`
- **Plate Wide Pulldown** (`plate-wide-pulldown`): stored `machine` → expected `dumbbell`
- **Cable Wood Chop** (`cable-wood-chop-co0506`): stored `bodyweight` → expected `cable`
- **Chest Supported Plate Row** (`chest-supported-plate-row`): stored `machine` → expected `dumbbell`
- **Cable Wood Chop** (`cable-wood-chop-co0536`): stored `kettlebell` → expected `cable`
- **Plate Pinch Walk** (`plate-pinch-walk-fa0537`): stored `barbell` → expected `dumbbell`
- **Cable Wide Pulldown** (`cable-wide-pulldown`): stored `rower` → expected `cable`
- **Plate Pinch Walk** (`plate-pinch-walk-fa0567`): stored `machine` → expected `dumbbell`
- **Plate Grip Hold** (`plate-grip-hold`): stored `machine` → expected `dumbbell`
- **Cable Wood Chop** (`cable-wood-chop-co0596`): stored `machine` → expected `cable`
- **Plate Pinch Walk** (`plate-pinch-walk-fa0597`): stored `barbell` → expected `dumbbell`

## Incorrect classification

_Showing up to 40 of 972_

- **Push-Up** (`push-up`): `exercise_type` stored `strength` → expected `bodyweight`
- **Wide Pull-Up** (`wide-pull-up`): `exercise_type` stored `strength` → expected `bodyweight`
- **Face Pull** (`face-pull`): `category` stored `hinge` → expected `pull`
- **Zercher Carry** (`zercher-carry`): `category` stored `carry` → expected `other`
- **Zercher Carry** (`zercher-carry`): `exercise_type` stored `strength` → expected `timed`
- **Overhead Tricep Extension** (`overhead-tricep-extension`): `category` stored `core` → expected `other`
- **Walking Lunge** (`walking-lunge`): `exercise_type` stored `strength` → expected `timed`
- **Good Morning** (`good-morning`): `category` stored `push` → expected `hinge`
- **Glute Kickback** (`glute-kickback`): `category` stored `push` → expected `other`
- **Band Calf Raise** (`band-calf-raise`): `category` stored `pull` → expected `other`
- **Smith Oblique Crunch** (`smith-oblique-crunch`): `category` stored `push` → expected `cardio`
- **Smith Oblique Crunch** (`smith-oblique-crunch`): `exercise_type` stored `strength` → expected `cardio`
- **Battle Rope Grip Wave** (`battle-rope-grip-wave`): `category` stored `pull` → expected `other`
- **Neck Isometric Hold** (`neck-isometric-hold`): `category` stored `squat` → expected `other`
- **Neck Isometric Hold** (`neck-isometric-hold`): `exercise_type` stored `strength` → expected `timed`
- **Running** (`running`): `category` stored `hinge` → expected `cardio`
- **Burpee** (`burpee`): `category` stored `carry` → expected `cardio`
- **Burpee** (`burpee`): `exercise_type` stored `strength` → expected `cardio`
- **Pallof Press** (`pallof-press`): `category` stored `core` → expected `push`
- **Lat Pulldown** (`lat-pulldown`): `category` stored `push` → expected `pull`
- **Lateral Raise** (`lateral-raise`): `category` stored `push` → expected `other`
- **Cable Curl** (`cable-curl`): `category` stored `pull` → expected `other`
- **Machine Dip** (`machine-dip`): `exercise_type` stored `strength` → expected `bodyweight`
- **Leg Extension** (`leg-extension`): `category` stored `pull` → expected `other`
- **Nordic Curl** (`nordic-curl`): `category` stored `squat` → expected `other`
- **Farmer Walk on Toes** (`farmer-walk-on-toes`): `category` stored `carry` → expected `other`
- **Farmer Walk on Toes** (`farmer-walk-on-toes`): `exercise_type` stored `strength` → expected `timed`
- **Russian Twist** (`russian-twist`): `category` stored `core` → expected `other`
- **Wrist Roller Walk** (`wrist-roller-walk`): `category` stored `squat` → expected `other`
- **Wrist Roller Walk** (`wrist-roller-walk`): `exercise_type` stored `strength` → expected `timed`
- **Neck Isometric Hold Press** (`neck-isometric-hold-press`): `exercise_type` stored `strength` → expected `timed`
- **Burpee Intervals** (`burpee-intervals`): `category` stored `push` → expected `cardio`
- **Burpee** (`burpee-fu0030`): `category` stored `pull` → expected `cardio`
- **Burpee** (`burpee-fu0030`): `exercise_type` stored `strength` → expected `cardio`
- **Face Pull** (`face-pull-sh0034`): `category` stored `hinge` → expected `pull`
- **Yoke Walk** (`yoke-walk`): `category` stored `carry` → expected `other`
- **Yoke Walk** (`yoke-walk`): `exercise_type` stored `strength` → expected `timed`
- **Overhead Tricep Extension** (`overhead-tricep-extension-tr0036`): `category` stored `core` → expected `other`
- **Walking Lunge** (`walking-lunge-qd0037`): `exercise_type` stored `strength` → expected `timed`
- **Good Morning** (`good-morning-hm0038`): `category` stored `push` → expected `hinge`

## Generic education only

_Showing up to 40 of 312_

- Face Pull (`face-pull`)
- Overhead Tricep Extension (`overhead-tricep-extension`)
- Good Morning (`good-morning`)
- Glute Kickback (`glute-kickback`)
- Battle Rope Grip Wave (`battle-rope-grip-wave`)
- Leg Extension (`leg-extension`)
- Face Pull (`face-pull-sh0034`)
- Overhead Tricep Extension (`overhead-tricep-extension-tr0036`)
- Good Morning (`good-morning-hm0038`)
- Glute Kickback (`glute-kickback-gl0039`)
- Leg Extension (`leg-extension-qd0052`)
- Face Pull (`face-pull-sh0064`)
- Overhead Tricep Extension (`overhead-tricep-extension-tr0066`)
- Good Morning (`good-morning-hm0068`)
- Glute Kickback (`glute-kickback-gl0069`)
- One Arm Hang (`one-arm-hang`)
- Barbell Complex (`barbell-complex`)
- Leg Extension (`leg-extension-qd0082`)
- Face Pull (`face-pull-sh0094`)
- Overhead Tricep Extension (`overhead-tricep-extension-tr0096`)
- Good Morning (`good-morning-hm0098`)
- Glute Kickback (`glute-kickback-gl0099`)
- Weighted Sit-Up (`weighted-sit-up`)
- Battle Rope Wave (`battle-rope-wave`)
- Leg Extension (`leg-extension-qd0112`)
- Face Pull (`face-pull-sh0124`)
- Overhead Tricep Extension (`overhead-tricep-extension-tr0126`)
- Good Morning (`good-morning-hm0128`)
- Glute Kickback (`glute-kickback-gl0129`)
- Barbell Rollout (`barbell-rollout`)
- Leg Extension (`leg-extension-qd0142`)
- Face Pull (`face-pull-sh0154`)
- Bear Crawl (`bear-crawl`)
- Overhead Tricep Extension (`overhead-tricep-extension-tr0156`)
- Good Morning (`good-morning-hm0158`)
- Glute Kickback (`glute-kickback-gl0159`)
- Overhead DB Extension (`overhead-db-extension`)
- Leg Extension (`leg-extension-qd0172`)
- Face Pull (`face-pull-sh0184`)
- Overhead Tricep Extension (`overhead-tricep-extension-tr0186`)

## Critical spotlight exercises

_Showing up to 40 of 7_

- **Goblet Squat** (`goblet-squat`) — pattern: squat, mismatches: 1
- **Face Pull** (`face-pull`) — pattern: general, mismatches: 2
- **Neck Isometric Hold** (`neck-isometric-hold`) — pattern: neck_isolation, mismatches: 2
- **Running** (`running`) — pattern: cardio, mismatches: 1
- **Lat Pulldown** (`lat-pulldown`) — pattern: pull, mismatches: 1
- **Dumbbell Thruster Intervals** (`dumbbell-thruster-intervals`) — pattern: thruster_or_cardio, mismatches: 1
- **Reverse Fly** (`reverse-fly`) — pattern: rear_delt_fly, mismatches: 1
