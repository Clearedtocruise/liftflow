#!/usr/bin/env python3
"""Generate supabase migration 024 with real exercise names from the 1000-row SQL source."""
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL_SOURCE = Path.home() / "Downloads/LiftFlow_1000_Exercise_Database.sql"
OUT = ROOT / "supabase/migrations/024_import_1000_exercise_catalog.sql"

MUSCLE = {
    "CH": "chest", "BA": "back", "LA": "lats", "SH": "shoulders", "BI": "biceps", "TR": "triceps",
    "QD": "quads", "HM": "hamstrings", "GL": "glutes", "CV": "calves", "CO": "core", "FA": "forearms",
    "NC": "neck", "CA": "cardiovascular", "FU": "full_body",
}
EQUIP = {
    "BW0": ("bodyweight", ["bodyweight"]),
    "BW1": ("bodyweight", ["bodyweight"]),
    "DB1": ("dumbbell", ["dumbbells"]),
    "KB1": ("kettlebell", ["kettlebells"]),
    "BB1": ("barbell", ["barbell", "rack"]),
    "CB1": ("cable", ["machines"]),
    "MC1": ("machine", ["machines"]),
    "PL1": ("machine", ["machines"]),
    "TR1": ("barbell", ["barbell", "rack"]),
    "RB1": ("bands", ["bands"]),
    "SM1": ("machine", ["machines"]),
    "CR1": ("rower", ["machines"]),
    "FX1": ("bodyweight", ["bodyweight"]),
    "HM1": ("dumbbell", ["dumbbells"]),
}
CAT = {
    "Push": "push", "Pull": "pull", "Squat": "squat", "Hinge": "hinge", "Carry": "carry",
    "Rotation": "core", "Lunge": "squat", "Press": "push", "Fly": "push", "Curl": "pull",
}
FAMILY = {
    "Push": "horizontal_press", "Pull": "horizontal_pull", "Squat": "squat_pattern",
    "Hinge": "hinge_pattern", "Carry": "carry", "Rotation": "core_rotation",
    "Lunge": "lunge_pattern", "Press": "vertical_press", "Fly": "horizontal_press", "Curl": "biceps",
}

# Real exercise pools: muscle -> pattern -> equipment -> names
POOL: dict[str, dict[str, dict[str, list[str]]]] = {}

def add(m, p, e, names):
    POOL.setdefault(m, {}).setdefault(p, {})[e] = names

# --- BACK / LATS ---
for e, names in [
    ("BB1", ["Barbell Row", "Pendlay Row", "Yates Row", "T-Bar Row", "Underhand Barbell Row"]),
    ("DB1", ["Dumbbell Row", "Single Arm Row", "Chest Supported Row", "Kroc Row", "Meadows Row"]),
    ("CB1", ["Seated Cable Row", "Lat Pulldown", "Straight Arm Pulldown", "Face Pull", "Single Arm Cable Row"]),
    ("BW0", ["Pull-Up", "Chin-Up", "Inverted Row", "Australian Pull-Up", "Scapular Pull-Up"]),
    ("BW1", ["Wide Pull-Up", "Commando Pull-Up", "Archer Pull-Up", "L-Sit Pull-Up", "Typewriter Pull-Up"]),
    ("MC1", ["Lat Pulldown Machine", "Hammer High Row", "Machine Row", "Iso-Lateral Row", "Assisted Pull-Up"]),
    ("SM1", ["Smith Bent Over Row", "Smith Seal Row", "Smith Underhand Row", "Smith Yates Row", "Smith Meadows Row"]),
    ("KB1", ["Kettlebell Row", "Gorilla Row", "Renegade Row", "Single Arm KB Row", "KB High Pull"]),
    ("RB1", ["Band Row", "Band Pull-Apart", "Band Face Pull", "Seated Band Row", "Band Lat Pull"]),
    ("PL1", ["Plate Row", "Seal Row", "Chest Supported Plate Row", "Plate Pin Row", "Meadows Plate Row"]),
    ("TR1", ["Trap Bar Row", "Trap Bar Meadows Row", "Trap Bar High Pull", "Trap Bar Seal Row", "Trap Bar Shrug Row"]),
    ("FX1", ["TRX Row", "Ring Row", "Suspension Row", "TRX Single Arm Row", "Ring Archer Row"]),
    ("HM1", ["Hammer Row", "Hammer High Row", "Hammer Low Row", "Hammer Iso Row", "Hammer Meadows Row"]),
    ("CR1", ["Row Erg Sprint", "Battle Rope Pull", "Sled Row Pull", "Rope Climb Pull", "Med Ball Row Throw"]),
]:
    add("BA", "Pull", e, names)
    add("LA", "Pull", e, [n.replace("Row", "Lat Pulldown") if "Row" in n else n for n in names[:5]])

add("LA", "Squat", "DB1", ["Goblet Squat", "DB Front Squat", "Heel Elevated Goblet Squat", "DB Box Squat", "DB Pause Squat"])
add("LA", "Squat", "BB1", ["Front Squat", "Back Squat", "Pause Squat", "Box Squat", "Tempo Squat"])
add("LA", "Press", "CB1", ["Lat Pulldown", "Straight Arm Pulldown", "Single Arm Lat Pressdown", "Wide Lat Pulldown", "Close Grip Pulldown"])
add("BA", "Lunge", "DB1", ["Reverse Lunge with Row", "Walking Lunge Row", "DB Split Squat Row", "Curtsy Lunge Row", "Lateral Lunge Row"])

# --- BICEPS ---
for e, names in [
    ("DB1", ["Dumbbell Curl", "Hammer Curl", "Incline Dumbbell Curl", "Concentration Curl", "Zottman Curl", "Cross Body Curl", "Spider Curl", "Preacher Dumbbell Curl"]),
    ("BB1", ["Barbell Curl", "EZ Bar Curl", "Preacher Curl", "Drag Curl", "Reverse Barbell Curl", "Wide Grip Curl", "Close Grip Curl", "21s Curl"]),
    ("CB1", ["Cable Curl", "Rope Hammer Curl", "Bayesian Curl", "Overhead Cable Curl", "Single Arm Cable Curl", "Low Cable Curl", "High Cable Curl", "Cross Body Cable Curl"]),
    ("BW0", ["Chin-Up", "Towel Curl", "Doorway Curl", "Isometric Chin Hold", "Bodyweight Bicep Curl"]),
    ("MC1", ["Machine Preacher Curl", "Machine Curl", "Spider Curl Machine", "Hammer Curl Machine", "Seated Machine Curl"]),
    ("RB1", ["Band Curl", "Band Hammer Curl", "Band Preacher Curl", "Band Concentration Curl", "Band Reverse Curl"]),
    ("KB1", ["Kettlebell Curl", "KB Crush Curl", "KB Hammer Curl", "KB Preacher Curl", "KB Reverse Curl"]),
    ("SM1", ["Smith Drag Curl", "Smith Preacher Curl", "Smith Curl", "Smith Reverse Curl", "Smith Hammer Curl"]),
    ("PL1", ["Plate Curl", "Plate Hammer Curl", "Plate Preacher Curl", "Plate Reverse Curl", "Plate Drag Curl"]),
    ("TR1", ["Trap Bar Curl", "Trap Bar Hammer Curl", "Trap Bar Preacher Curl", "Trap Bar Reverse Curl", "Trap Bar Drag Curl"]),
    ("FX1", ["TRX Curl", "Ring Chin Curl", "Suspension Curl", "TRX Hammer Curl", "Ring Curl"]),
    ("HM1", ["Hammer Curl", "Hammer Preacher Curl", "Hammer Reverse Curl", "Hammer Drag Curl", "Hammer Concentration Curl"]),
    ("CR1", ["Battle Rope Curl Wave", "Cable Speed Curl", "Med Ball Curl Toss", "Rope Curl Drill", "Plyo Curl Pull"]),
    ("BW1", ["Chin-Up Hold", "Archer Chin-Up", "Explosive Chin-Up", "Wide Chin-Up", "Close Grip Chin-Up"]),
]:
    add("BI", "Curl", e, names)

add("BI", "Carry", "BB1", ["Zercher Carry", "Crossbody Carry", "Front Rack Carry", "Farmer Carry", "Overhead Carry"])
for e, names in [
    ("DB1", ["Farmer Carry", "Suitcase Carry", "Overhead Carry", "Rack Carry", "Waiter Carry"]),
    ("KB1", ["Kettlebell Carry", "KB Suitcase Carry", "KB Overhead Carry", "KB Rack Carry", "KB Cross Carry"]),
    ("BW0", ["Bear Crawl", "Crab Walk", "Overhead Walk", "Plank Walk", "Lateral Shuffle"]),
    ("BW1", ["Duck Walk", "Inchworm Walk", "Hand Walk", "Loaded Crawl", "Lateral Bear Crawl"]),
    ("CB1", ["Cable Suitcase Carry", "Cable Overhead Carry", "Cable Rack Carry", "Cable Cross Carry", "Cable Farmer Carry"]),
    ("MC1", ["Yoke Walk", "Frame Carry", "Farmer Walk Machine", "Sled Carry", "Loaded Carry Machine"]),
    ("SM1", ["Smith Zercher Carry", "Smith Overhead Carry", "Smith Front Rack Carry", "Smith Farmer Carry", "Smith Cross Carry"]),
    ("RB1", ["Band Overhead Carry", "Band Suitcase Carry", "Band Rack Carry", "Band Cross Carry", "Band Farmer Carry"]),
    ("PL1", ["Plate Overhead Carry", "Plate Suitcase Carry", "Plate Rack Carry", "Plate Cross Carry", "Plate Farmer Carry"]),
    ("TR1", ["Trap Bar Farmer Carry", "Trap Bar Overhead Carry", "Trap Bar Rack Carry", "Trap Bar Cross Carry", "Trap Bar Zercher Carry"]),
    ("FX1", ["TRX Overhead Carry", "TRX Suitcase Carry", "TRX Rack Carry", "TRX Cross Carry", "TRX Farmer Carry"]),
    ("HM1", ["Hammer Farmer Carry", "Hammer Overhead Carry", "Hammer Rack Carry", "Hammer Cross Carry", "Hammer Suitcase Carry"]),
    ("CR1", ["Sled Push Carry", "Prowler Carry", "Battle Rope Carry", "Med Ball Carry", "Sandbag Carry"]),
]:
    add("BI", "Carry", e, names)

# --- TRICEPS ---
for e, names in [
    ("CB1", ["Tricep Pushdown", "Rope Pushdown", "Overhead Cable Extension", "Single Arm Pushdown", "Reverse Grip Pushdown"]),
    ("BB1", ["Skull Crusher", "Close Grip Bench Press", "JM Press", "Overhead Tricep Extension", "Floor Press Tricep"]),
    ("DB1", ["Overhead DB Extension", "DB Skull Crusher", "Single Arm Extension", "DB Kickback", "DB Close Grip Press"]),
    ("BW0", ["Dip", "Bench Dip", "Diamond Push-Up", "Close Grip Push-Up", "Tricep Push-Up"]),
    ("MC1", ["Machine Dip", "Tricep Extension Machine", "Assisted Dip", "Overhead Machine Extension", "Seated Tricep Machine"]),
    ("RB1", ["Band Pushdown", "Band Overhead Extension", "Band Kickback", "Band Close Grip Press", "Band Skull Crusher"]),
    ("KB1", ["KB Overhead Extension", "KB Skull Crusher", "KB Close Grip Press", "KB Kickback", "KB Pushdown"]),
    ("SM1", ["Smith Close Grip Press", "Smith Skull Crusher", "Smith JM Press", "Smith Overhead Extension", "Smith Floor Press"]),
    ("PL1", ["Plate Overhead Extension", "Plate Skull Crusher", "Plate Close Grip Press", "Plate Kickback", "Plate JM Press"]),
    ("TR1", ["Trap Bar Close Grip Press", "Trap Bar Overhead Extension", "Trap Bar Skull Crusher", "Trap Bar JM Press", "Trap Bar Floor Press"]),
    ("FX1", ["Ring Dip", "TRX Tricep Extension", "Ring Push-Up Tricep", "Suspension Extension", "Ring Skull Crusher"]),
    ("HM1", ["Hammer Tricep Extension", "Hammer Dip", "Hammer Close Grip Press", "Hammer Overhead Extension", "Hammer Kickback"]),
    ("CR1", ["Battle Rope Tricep Slam", "Med Ball Overhead Throw", "Sled Tricep Push", "Plyo Close Grip Push", "Speed Pushdown Drill"]),
    ("BW1", ["Explosive Dip", "Weighted Dip", "Ring Dip", "Feet Elevated Diamond Push-Up", "Tricep Dip Hold"]),
]:
    add("TR", "Push", e, names)
    add("TR", "Rotation", e, ["Overhead Tricep Extension", "Single Arm Tricep Extension", "Rope Overhead Extension", "Cross Body Extension", "Kneeling Overhead Extension"])

# --- CHEST (abbreviated - reuse from prior) ---
for e, names in [
    ("BB1", ["Bench Press", "Incline Bench Press", "Decline Bench Press", "Close Grip Bench Press", "Floor Press"]),
    ("DB1", ["Dumbbell Bench Press", "Incline Dumbbell Press", "Decline Dumbbell Press", "DB Fly Press", "Single Arm DB Press"]),
    ("CB1", ["Cable Fly", "Cable Chest Press", "Low Cable Fly", "High Cable Fly", "Single Arm Cable Fly"]),
    ("BW0", ["Push-Up", "Diamond Push-Up", "Wide Push-Up", "Decline Push-Up", "Archer Push-Up"]),
    ("MC1", ["Machine Chest Press", "Pec Deck", "Hammer Strength Press", "Converging Chest Press", "Seated Machine Press"]),
    ("SM1", ["Smith Bench Press", "Smith Incline Press", "Smith Decline Press", "Smith Close Grip Press", "Smith Floor Press"]),
    ("KB1", ["Kettlebell Floor Press", "KB Crush Press", "Double KB Press", "Single KB Press", "KB Bottoms Up Press"]),
    ("RB1", ["Band Chest Press", "Band Fly", "Band Push-Up Assist", "Band Crossover", "Band Standing Press"]),
    ("PL1", ["Plate Push-Up", "Plate Squeeze Press", "Weighted Push-Up", "Plate Loaded Press", "Plate Pin Press"]),
    ("TR1", ["Trap Bar Floor Press", "Trap Bar Incline Press", "Trap Bar Close Grip Press", "Trap Bar Bench Press", "Trap Bar Push Press"]),
    ("FX1", ["TRX Push-Up", "Ring Push-Up", "Suspension Chest Press", "TRX Chest Fly", "Ring Dip Support"]),
    ("HM1", ["Hammer Chest Press", "Hammer Incline Press", "Hammer Decline Press", "Hammer Iso Press", "Hammer Converging Press"]),
    ("CR1", ["Med Ball Chest Throw", "Battle Rope Slam", "Sled Push", "Plyo Push-Up", "Medicine Ball Push Throw"]),
    ("BW1", ["Pike Push-Up", "Clapping Push-Up", "Staggered Push-Up", "Pseudo Planche Push-Up", "Explosive Push-Up"]),
]:
    add("CH", "Push", e, names)
    add("CH", "Fly", e, {
        "DB1": ["Dumbbell Fly", "Incline Dumbbell Fly", "Decline Dumbbell Fly", "Squeeze Press Fly", "Floor Fly"],
        "CB1": ["Cable Fly", "Low Cable Fly", "High Cable Fly", "Single Arm Cable Fly", "Crossover Fly"],
        "MC1": ["Pec Deck Fly", "Machine Fly", "Converging Fly", "Reverse Fly Machine", "Seated Fly"],
        "BB1": ["Barbell Fly", "Floor Fly Press", "Guillotine Press", "Crush Press", "Pin Press Fly"],
    }.get(e, ["Incline Fly", "Decline Fly", "Flat Fly", "Squeeze Fly", "Arc Fly", "Low Fly", "High Fly", "Single Arm Fly"]))
    add("CH", "Rotation", e, ["Pallof Press", "Cable Wood Chop", "Landmine Rotation", "Medicine Ball Twist", "Anti-Rotation Press", "Half-Kneeling Chop", "Standing Rotation", "Rotational Press"])

# --- SHOULDERS ---
for e, names in [
    ("BB1", ["Overhead Press", "Push Press", "Behind Neck Press", "Z Press", "Landmine Press"]),
    ("DB1", ["Dumbbell Shoulder Press", "Arnold Press", "Lateral Raise", "Front Raise", "Rear Delt Fly"]),
    ("CB1", ["Cable Lateral Raise", "Face Pull", "Cable Rear Delt Fly", "Cable Shoulder Press", "Single Arm Cable Raise"]),
    ("BW0", ["Pike Push-Up", "Handstand Push-Up", "Wall Walk", "Shoulder Tap Push-Up", "Decline Pike Press"]),
    ("MC1", ["Machine Shoulder Press", "Reverse Pec Deck", "Lateral Raise Machine", "Hammer Shoulder Press", "Rear Delt Machine"]),
    ("RB1", ["Band Lateral Raise", "Band Face Pull", "Band Overhead Press", "Band Front Raise", "Band Rear Delt Fly"]),
    ("KB1", ["Kettlebell Press", "KB Push Press", "KB Bottoms Up Press", "KB Windmill", "KB Halo"]),
    ("SM1", ["Smith Overhead Press", "Smith Push Press", "Smith Landmine Press", "Smith Z Press", "Smith Seated Press"]),
    ("PL1", ["Plate Overhead Press", "Plate Front Raise", "Plate Lateral Raise", "Plate Rear Delt Fly", "Plate Push Press"]),
    ("TR1", ["Trap Bar Overhead Press", "Trap Bar Push Press", "Trap Bar Landmine Press", "Trap Bar Z Press", "Trap Bar Shoulder Press"]),
    ("FX1", ["TRX Y Raise", "Ring Support Hold", "Suspension Shoulder Press", "TRX Pike Press", "Ring Handstand Prep"]),
    ("HM1", ["Hammer Shoulder Press", "Hammer Lateral Raise", "Hammer Rear Delt Fly", "Hammer Push Press", "Hammer Landmine Press"]),
    ("CR1", ["Med Ball Overhead Throw", "Battle Rope Shoulder Wave", "Sled Overhead Push", "Plyo Push Press", "Speed Press Drill"]),
    ("BW1", ["Explosive Pike Press", "Wall Handstand Hold", "Elevated Pike Press", "Parallette Press", "Ring Support Press"]),
]:
    add("SH", "Press", e, names)
    add("SH", "Hinge", e, ["Face Pull", "Reverse Fly", "Rear Delt Fly", "Band Pull-Apart", "Scapular Wall Slide"])
    add("SH", "Fly", e, ["Lateral Raise", "Front Raise", "Rear Delt Fly", "Cable Fly Raise", "Y Raise"])

# --- QUADS / LEGS ---
for e, names in [
    ("BB1", ["Back Squat", "Front Squat", "Box Squat", "Pause Squat", "Tempo Squat"]),
    ("DB1", ["Goblet Squat", "Bulgarian Split Squat", "Dumbbell Lunge", "Step-Up", "Walking Lunge"]),
    ("BW0", ["Bodyweight Squat", "Walking Lunge", "Reverse Lunge", "Jump Squat", "Wall Sit"]),
    ("MC1", ["Leg Press", "Hack Squat", "Pendulum Squat", "V Squat", "Belt Squat"]),
    ("SM1", ["Smith Squat", "Smith Front Squat", "Smith Split Squat", "Smith Hack Squat", "Smith Box Squat"]),
    ("KB1", ["Kettlebell Goblet Squat", "KB Front Squat", "KB Lunge", "KB Step-Up", "Double KB Squat"]),
    ("CB1", ["Cable Goblet Squat", "Cable Split Squat", "Cable Lunge", "Cable Step-Up", "Cable Squat"]),
    ("RB1", ["Band Squat", "Band Lunge", "Band Split Squat", "Band Step-Up", "Band Squat Walk"]),
    ("PL1", ["Plate Goblet Squat", "Plate Lunge", "Plate Split Squat", "Plate Step-Up", "Plate Squat"]),
    ("TR1", ["Trap Bar Squat", "Trap Bar Lunge", "Trap Bar Split Squat", "Trap Bar Step-Up", "Trap Bar Box Squat"]),
    ("FX1", ["TRX Squat", "TRX Lunge", "TRX Split Squat", "TRX Pistol Assist", "TRX Jump Squat"]),
    ("HM1", ["Hammer Hack Squat", "Hammer Leg Press", "Hammer V Squat", "Hammer Belt Squat", "Hammer Front Squat"]),
    ("CR1", ["Sled Push", "Prowler Push", "Battle Rope Squat", "Med Ball Squat Throw", "Squat Jump Drill"]),
    ("BW1", ["Pistol Squat", "Cossack Squat", "Sissy Squat", "Shrimp Squat", "1.5 Rep Squat"]),
]:
    add("QD", "Squat", e, names)
    add("QD", "Lunge", e, [
        "Walking Lunge", "Reverse Lunge", "Bulgarian Split Squat", "Lateral Lunge", "Step-Up",
        "Curtsy Lunge", "Deficit Lunge", "Clock Lunge", "Crossover Lunge", "Front Foot Elevated Split Squat",
    ] if "Lunge" not in names[0] and "Split" not in names[0] and "Step" not in names[0] else names + ["Deficit Lunge", "Clock Lunge", "Crossover Lunge"])
    add("QD", "Pull", e, ["Leg Extension", "Sissy Squat", "Terminal Knee Extension", "Spanish Squat", "Poliquin Step-Up"])

# --- HAMSTRINGS / GLUTES ---
for e, names in [
    ("BB1", ["Romanian Deadlift", "Stiff Leg Deadlift", "Good Morning", "Deficit Deadlift", "Snatch Grip Deadlift"]),
    ("DB1", ["Dumbbell RDL", "Single Leg RDL", "DB Good Morning", "DB Stiff Leg Deadlift", "DB Hip Thrust"]),
    ("BW0", ["Nordic Curl", "Glute Bridge", "Single Leg Glute Bridge", "Good Morning BW", "Back Extension"]),
    ("MC1", ["Leg Curl", "Glute Ham Raise", "Reverse Hyper", "45 Degree Hyper", "Seated Leg Curl"]),
    ("CB1", ["Cable Pull Through", "Cable RDL", "Cable Good Morning", "Cable Hip Hinge", "Cable Leg Curl"]),
    ("KB1", ["Kettlebell Swing", "KB RDL", "KB Single Leg RDL", "KB Good Morning", "KB Hip Thrust"]),
    ("SM1", ["Smith RDL", "Smith Good Morning", "Smith Hip Thrust", "Smith Stiff Leg Deadlift", "Smith Glute Bridge"]),
    ("RB1", ["Band RDL", "Band Good Morning", "Band Pull Through", "Band Hip Thrust", "Band Leg Curl"]),
    ("PL1", ["Plate RDL", "Plate Good Morning", "Plate Hip Thrust", "Plate Pull Through", "Plate Glute Bridge"]),
    ("TR1", ["Trap Bar Deadlift", "Trap Bar RDL", "Trap Bar Hip Thrust", "Trap Bar Good Morning", "Trap Bar Pull Through"]),
    ("FX1", ["TRX Hamstring Curl", "TRX Hip Hinge", "TRX Glute Bridge", "TRX Single Leg RDL", "TRX Good Morning"]),
    ("HM1", ["Hammer Leg Curl", "Hammer Glute Ham", "Hammer Reverse Hyper", "Hammer RDL", "Hammer Hip Thrust"]),
    ("CR1", ["Kettlebell Swing Cardio", "Battle Rope Hinge", "Sled Drag", "Med Ball Slam", "Rope Hinge Drill"]),
    ("BW1", ["Single Leg Hip Thrust", "Frog Pump", "Slider Hamstring Curl", "Elevated Glute Bridge", "Reverse Hyper BW"]),
]:
    add("HM", "Hinge", e, names)
    add("HM", "Squat", e, ["Nordic Curl", "Slider Hamstring Curl", "Hamstring Dominant Squat", "Jefferson Curl", "Sissy Squat"])
    add("HM", "Press", e, ["Good Morning", "Back Extension", "Reverse Hyper", "45 Degree Hyper", "Seated Good Morning"])
    add("GL", "Hinge", e, ["Hip Thrust", "Glute Bridge", "Single Leg Hip Thrust", "Cable Pull Through", "Frog Pump"])
    add("GL", "Fly", e, ["Glute Kickback", "Cable Kickback", "Donkey Kick", "Fire Hydrant", "Hip Abduction"])

# --- CALVES ---
for e, names in [
    ("BB1", ["Standing Calf Raise", "Seated Calf Raise", "Donkey Calf Raise", "Single Leg Calf Raise", "Calf Press"]),
    ("DB1", ["Dumbbell Calf Raise", "Single Leg DB Calf Raise", "Seated DB Calf Raise", "Farmer Calf Raise", "DB Donkey Raise"]),
    ("BW0", ["Bodyweight Calf Raise", "Single Leg Calf Raise", "Jump Rope", "Calf Raise Hold", "Explosive Calf Raise"]),
    ("MC1", ["Machine Calf Raise", "Seated Calf Machine", "Leg Press Calf Raise", "Donkey Calf Machine", "Standing Calf Machine"]),
    ("SM1", ["Smith Calf Raise", "Smith Seated Calf Raise", "Smith Donkey Calf Raise", "Smith Single Leg Calf Raise", "Smith Calf Press"]),
    ("CB1", ["Cable Calf Raise", "Cable Single Leg Calf Raise", "Cable Seated Calf Raise", "Cable Donkey Raise", "Cable Calf Press"]),
    ("RB1", ["Band Calf Raise", "Band Single Leg Calf Raise", "Band Seated Calf Raise", "Band Donkey Raise", "Band Calf Press"]),
    ("KB1", ["Kettlebell Calf Raise", "KB Single Leg Calf Raise", "KB Seated Calf Raise", "KB Farmer Calf Raise", "KB Donkey Raise"]),
    ("PL1", ["Plate Calf Raise", "Plate Single Leg Calf Raise", "Plate Seated Calf Raise", "Plate Donkey Raise", "Plate Calf Press"]),
    ("TR1", ["Trap Bar Calf Raise", "Trap Bar Single Leg Calf Raise", "Trap Bar Seated Calf Raise", "Trap Bar Donkey Raise", "Trap Bar Calf Press"]),
    ("FX1", ["TRX Calf Raise", "Suspension Calf Raise", "TRX Single Leg Calf Raise", "TRX Seated Calf Raise", "TRX Donkey Raise"]),
    ("HM1", ["Hammer Calf Raise", "Hammer Seated Calf Raise", "Hammer Donkey Calf Raise", "Hammer Single Leg Calf Raise", "Hammer Calf Press"]),
    ("CR1", ["Jump Rope Cardio", "Battle Rope Calf Bounce", "Sled Calf Drive", "Med Ball Calf Jump", "Speed Rope Drill"]),
    ("BW1", ["Explosive Calf Raise", "Single Leg Jump Rope", "Deficit Calf Raise", "Pulse Calf Raise", "Isometric Calf Hold"]),
]:
    add("CV", "Curl", e, names)
    add("CV", "Carry", e, ["Farmer Walk on Toes", "Single Leg Calf Walk", "Seated Calf Hold Walk", "Weighted Calf March", "Calf Raise Walk"])

# --- CORE ---
for e, names in [
    ("BW0", ["Plank", "Crunch", "Sit-Up", "Dead Bug", "Hollow Hold", "Bicycle Crunch", "Reverse Crunch", "Mountain Climber"]),
    ("BW1", ["Side Plank", "Russian Twist", "V-Up", "Flutter Kick", "Hanging Leg Raise", "Ab Wheel Rollout", "Dragon Flag", "L-Sit"]),
    ("DB1", ["Weighted Sit-Up", "Dumbbell Side Bend", "DB Russian Twist", "DB Dead Bug", "DB V-Up"]),
    ("BB1", ["Barbell Rollout", "Landmine Rotation", "Barbell Side Bend", "Barbell Sit-Up", "Landmine Anti-Rotation"]),
    ("CB1", ["Cable Crunch", "Pallof Press", "Cable Wood Chop", "Cable Side Bend", "Cable Rotation"]),
    ("KB1", ["Kettlebell Windmill", "KB Turkish Get-Up", "KB Halo", "KB Side Bend", "KB Rotation"]),
    ("RB1", ["Band Pallof Press", "Band Wood Chop", "Band Rotation", "Band Crunch", "Band Anti-Rotation"]),
    ("MC1", ["Machine Crunch", "Torso Rotation Machine", "Ab Machine", "Rotary Torso", "Seated Crunch Machine"]),
    ("SM1", ["Smith Oblique Crunch", "Smith Rotation", "Smith Side Bend", "Smith Crunch", "Smith Anti-Rotation"]),
    ("PL1", ["Plate Crunch", "Plate Russian Twist", "Plate Side Bend", "Plate Wood Chop", "Plate Sit-Up"]),
    ("TR1", ["Trap Bar Side Bend", "Trap Bar Rotation", "Trap Bar Crunch", "Trap Bar Anti-Rotation", "Trap Bar Wood Chop"]),
    ("FX1", ["TRX Plank", "TRX Pike", "TRX Oblique Crunch", "Suspension Crunch", "TRX Rotation"]),
    ("HM1", ["Hammer Crunch", "Hammer Rotation", "Hammer Side Bend", "Hammer Oblique Crunch", "Hammer Anti-Rotation"]),
    ("CR1", ["Battle Rope Core Slam", "Med Ball Rotational Throw", "Sled Core Push", "Plyo Crunch", "Speed Core Drill"]),
    ("PL1", ["Plate Hollow Hold", "Plate Leg Raise", "Plate Toe Touch", "Plate Oblique Reach", "Plate Anti-Extension"]),
]:
    add("CO", "Push", e, names[:8] if e == "BW0" else names)
    add("CO", "Rotation", e, ["Russian Twist", "Pallof Press", "Cable Wood Chop", "Landmine Rotation", "Bicycle Crunch", "Oblique Crunch", "Rotational Plank", "Anti-Rotation Hold"])
    add("CO", "Pull", e, ["Hanging Leg Raise", "Ab Wheel Rollout", "Dragon Flag", "L-Sit", "Toes to Bar"])

# --- FOREARMS ---
for e, names in [
    ("BB1", ["Wrist Curl", "Reverse Wrist Curl", "Behind Back Wrist Curl", "Fat Grip Hold", "Barbell Hold"]),
    ("DB1", ["Dumbbell Wrist Curl", "Reverse DB Wrist Curl", "Farmer Hold", "Hammer Hold", "DB Fat Grip Curl"]),
    ("BW0", ["Dead Hang", "Towel Hang", "Fingerboard Hang", "Bar Hang", "Isometric Grip Hold"]),
    ("CB1", ["Cable Wrist Curl", "Reverse Cable Wrist Curl", "Cable Grip Hold", "Cable Fat Grip Curl", "Cable Wrist Extension"]),
    ("RB1", ["Band Wrist Curl", "Band Reverse Wrist Curl", "Band Grip Hold", "Band Fat Grip Curl", "Band Wrist Extension"]),
    ("KB1", ["Kettlebell Wrist Curl", "KB Bottoms Up Hold", "KB Grip Hold", "KB Fat Grip Curl", "KB Wrist Extension"]),
    ("MC1", ["Machine Wrist Curl", "Machine Reverse Wrist Curl", "Machine Grip Hold", "Machine Fat Grip Curl", "Machine Wrist Extension"]),
    ("SM1", ["Smith Wrist Curl", "Smith Reverse Wrist Curl", "Smith Grip Hold", "Smith Fat Grip Curl", "Smith Wrist Extension"]),
    ("PL1", ["Plate Wrist Curl", "Plate Reverse Wrist Curl", "Plate Grip Hold", "Plate Fat Grip Curl", "Plate Wrist Extension"]),
    ("TR1", ["Trap Bar Grip Hold", "Trap Bar Wrist Curl", "Trap Bar Reverse Wrist Curl", "Trap Bar Fat Grip Curl", "Trap Bar Wrist Extension"]),
    ("FX1", ["TRX Grip Hold", "Ring Hang", "Suspension Grip Hold", "TRX Wrist Curl", "Ring Fat Grip Hold"]),
    ("HM1", ["Hammer Wrist Curl", "Hammer Reverse Wrist Curl", "Hammer Grip Hold", "Hammer Fat Grip Curl", "Hammer Wrist Extension"]),
    ("CR1", ["Battle Rope Grip Wave", "Med Ball Grip Throw", "Sled Grip Pull", "Rope Grip Drill", "Plyo Grip Hold"]),
    ("BW1", ["One Arm Hang", "Fat Bar Hang", "Explosive Hang", "Wide Grip Hang", "Close Grip Hang"]),
]:
    add("FA", "Pull", e, names)
    add("FA", "Lunge", e, ["Wrist Roller Walk", "Farmer Hold Walk", "Plate Pinch Walk", "Grip Hold March", "Forearm Farmer Walk"])

# --- CARDIO / FULL BODY / NECK (shorter pools) ---
for e, names in [
    ("CR1", ["Running", "Rowing", "Cycling", "Swimming", "Elliptical", "Stair Climber", "Assault Bike", "Ski Erg"]),
    ("BW0", ["Burpee", "Jumping Jack", "High Knees", "Mountain Climber", "Box Jump"]),
    ("BW1", ["Sprint", "Jump Rope", "Bear Crawl", "Crab Walk", "Shuttle Run"]),
    ("DB1", ["Dumbbell Thruster", "DB Man Maker", "DB Clean and Press", "DB Snatch", "DB Swing Complex"]),
    ("BB1", ["Barbell Complex", "Clean and Press", "Power Clean", "Hang Clean", "Thruster"]),
    ("KB1", ["KB Clean and Press", "KB Snatch", "KB Swing Complex", "KB Thruster", "Turkish Get-Up Complex"]),
    ("CB1", ["Battle Rope Wave", "Sled Push", "Sled Drag", "Rope Slam", "Med Ball Slam"]),
    ("MC1", ["Assault Bike Sprint", "Rower Sprint", "Ski Erg Sprint", "Stair Climber Sprint", "Elliptical Sprint"]),
]:
    add("CA", "Hinge", e, names if e == "CR1" else names[:5] + ["Tempo " + names[0], "Interval " + names[0]])
    add("CA", "Fly", e, [n + " Intervals" for n in (names[:5] if e != "CR1" else names[:8])])

for e, names in [
    ("CR1", ["Burpee", "Man Maker", "Thruster", "Clean and Press", "Turkish Get-Up"]),
    ("BW0", ["Burpee", "Bear Crawl", "Mountain Climber", "Jump Squat", "Inchworm"]),
    ("BW1", ["Burpee Over Bar", "Devil Press", "Man Maker", "Sprawl", "Shuttle Burpee"]),
    ("DB1", ["DB Thruster", "DB Man Maker", "DB Clean and Press", "DB Snatch", "Renegade Row Burpee"]),
    ("BB1", ["Barbell Complex", "Clean and Press", "Power Clean", "Hang Clean", "Thruster"]),
    ("KB1", ["KB Clean and Press", "KB Snatch", "KB Swing", "KB Thruster", "Turkish Get-Up"]),
    ("CB1", ["Battle Rope Slam", "Sled Push", "Sled Drag", "Med Ball Slam", "Rope Wave"]),
    ("MC1", ["Assault Bike Sprint", "Rower Sprint", "Ski Erg Sprint", "Stair Climber", "Elliptical Sprint"]),
    ("SM1", ["Smith Thruster", "Smith Complex", "Smith Clean and Press", "Smith Squat Press", "Smith Man Maker"]),
    ("RB1", ["Band Burpee", "Band Thruster", "Band Man Maker", "Band Clean and Press", "Band Complex"]),
    ("PL1", ["Plate Complex", "Plate Thruster", "Plate Overhead Walk", "Plate Squat to Press", "Plate Man Maker"]),
    ("TR1", ["Trap Bar Carry Complex", "Trap Bar Clean", "Trap Bar Thruster", "Trap Bar Shrug Complex", "Trap Bar Farmer Complex"]),
    ("FX1", ["TRX Burpee", "TRX Mountain Climber", "TRX Sprawl", "TRX Pike to Push-Up", "TRX Complex"]),
    ("HM1", ["Hammer Complex", "Hammer Thruster", "Hammer Clean and Press", "Hammer Squat Press", "Hammer Man Maker"]),
]:
    add("FU", "Carry", e, names)
    add("FU", "Curl", e, ["Burpee", "Thruster", "Man Maker", "Clean and Press", "Complex Circuit", "Power Clean", "Hang Clean", "Devil Press"])

NECK_NAMES = ["Neck Isometric Hold", "Neck Flexion", "Neck Extension", "Neck Lateral Flexion", "Neck Rotation", "Neck Bridge", "Neck Harness Extension", "Neck Harness Curl"]
for e in ["BW0", "BW1", "DB1", "BB1", "KB1", "CB1", "MC1", "SM1", "RB1", "PL1", "TR1", "FX1", "HM1", "CR1"]:
    add("NC", "Squat", e, NECK_NAMES)
    add("NC", "Press", e, [n + " Press" if "Press" not in n else n for n in NECK_NAMES])

# Back / lat lunges and presses across equipment
for e, names in [
    ("BB1", ["Barbell Row", "Pendlay Row", "Yates Row", "T-Bar Row", "Underhand Barbell Row"]),
    ("DB1", ["Reverse Lunge with Row", "Walking Lunge Row", "DB Split Squat Row", "Curtsy Lunge Row", "Lateral Lunge Row"]),
    ("KB1", ["KB Reverse Lunge Row", "KB Walking Lunge Row", "KB Split Squat Row", "KB Curtsy Lunge Row", "KB Lateral Lunge Row"]),
    ("CB1", ["Cable Reverse Lunge Row", "Cable Walking Lunge Row", "Cable Split Squat Row", "Cable Curtsy Lunge Row", "Cable Lateral Lunge Row"]),
    ("MC1", ["Machine Reverse Lunge Row", "Machine Walking Lunge Row", "Machine Split Squat Row", "Machine Curtsy Lunge Row", "Machine Lateral Lunge Row"]),
    ("SM1", ["Smith Reverse Lunge Row", "Smith Walking Lunge Row", "Smith Split Squat Row", "Smith Curtsy Lunge Row", "Smith Lateral Lunge Row"]),
    ("RB1", ["Band Reverse Lunge Row", "Band Walking Lunge Row", "Band Split Squat Row", "Band Curtsy Lunge Row", "Band Lateral Lunge Row"]),
    ("PL1", ["Plate Reverse Lunge Row", "Plate Walking Lunge Row", "Plate Split Squat Row", "Plate Curtsy Lunge Row", "Plate Lateral Lunge Row"]),
    ("TR1", ["Trap Bar Reverse Lunge Row", "Trap Bar Walking Lunge Row", "Trap Bar Split Squat Row", "Trap Bar Curtsy Lunge Row", "Trap Bar Lateral Lunge Row"]),
    ("FX1", ["TRX Reverse Lunge Row", "TRX Walking Lunge Row", "TRX Split Squat Row", "TRX Curtsy Lunge Row", "TRX Lateral Lunge Row"]),
    ("HM1", ["Hammer Reverse Lunge Row", "Hammer Walking Lunge Row", "Hammer Split Squat Row", "Hammer Curtsy Lunge Row", "Hammer Lateral Lunge Row"]),
    ("CR1", ["Sled Reverse Lunge Row", "Sled Walking Lunge Row", "Sled Split Squat Row", "Sled Curtsy Lunge Row", "Sled Lateral Lunge Row"]),
    ("BW0", ["Bodyweight Reverse Lunge", "Walking Lunge", "Split Squat", "Curtsy Lunge", "Lateral Lunge"]),
    ("BW1", ["Explosive Reverse Lunge", "Walking Lunge Jump", "Bulgarian Split Squat", "Curtsy Lunge Jump", "Lateral Lunge Jump"]),
]:
    add("BA", "Lunge", e, names)

for e, names in [
    ("KB1", ["Lat Pulldown", "Single Arm Lat Pulldown", "Straight Arm Pulldown", "Wide Lat Pulldown", "Close Grip Pulldown"]),
    ("MC1", ["Lat Pulldown Machine", "Hammer High Row", "Machine Row", "Iso-Lateral Row", "Assisted Pull-Up"]),
    ("SM1", ["Smith Lat Pulldown", "Smith Straight Arm Pulldown", "Smith Wide Pulldown", "Smith Close Grip Pulldown", "Smith Single Arm Pulldown"]),
    ("RB1", ["Band Lat Pulldown", "Band Straight Arm Pulldown", "Band Wide Pulldown", "Band Close Grip Pulldown", "Band Single Arm Pulldown"]),
    ("PL1", ["Plate Lat Pulldown", "Plate Straight Arm Pulldown", "Plate Wide Pulldown", "Plate Close Grip Pulldown", "Plate Single Arm Pulldown"]),
    ("TR1", ["Trap Bar Lat Pulldown", "Trap Bar Straight Arm Pulldown", "Trap Bar Wide Pulldown", "Trap Bar Close Grip Pulldown", "Trap Bar Single Arm Pulldown"]),
    ("FX1", ["TRX Lat Pulldown", "TRX Straight Arm Pulldown", "TRX Wide Pulldown", "TRX Close Grip Pulldown", "TRX Single Arm Pulldown"]),
    ("HM1", ["Hammer Lat Pulldown", "Hammer Straight Arm Pulldown", "Hammer Wide Pulldown", "Hammer Close Grip Pulldown", "Hammer Single Arm Pulldown"]),
    ("CR1", ["Cable Lat Pulldown", "Cable Straight Arm Pulldown", "Cable Wide Pulldown", "Cable Close Grip Pulldown", "Cable Single Arm Pulldown"]),
    ("BW0", ["Pull-Up", "Chin-Up", "Scapular Pull-Up", "Wide Pull-Up", "Close Grip Pull-Up"]),
    ("BW1", ["Archer Pull-Up", "Commando Pull-Up", "L-Sit Pull-Up", "Typewriter Pull-Up", "Explosive Pull-Up"]),
    ("DB1", ["Single Arm Lat Pulldown", "DB Pullover", "DB Straight Arm Pulldown", "DB Wide Pulldown", "DB Close Grip Pulldown"]),
    ("BB1", ["Barbell Pullover", "Barbell Straight Arm Pulldown", "Barbell Wide Pulldown", "Barbell Close Grip Pulldown", "Barbell Single Arm Pulldown"]),
]:
    add("LA", "Press", e, names)

for e in ["DB1", "BB1", "KB1", "CB1", "MC1", "SM1", "RB1", "PL1", "TR1", "FX1", "HM1", "CR1", "BW0", "BW1"]:
    if not POOL.get("LA", {}).get("Squat", {}).get(e):
        base = ["Goblet Squat", "Front Squat", "Heel Elevated Goblet Squat", "Box Squat", "Pause Squat"]
        add("LA", "Squat", e, base)


EQ_LABEL = {
    "BB1": "Barbell", "DB1": "Dumbbell", "KB1": "Kettlebell", "CB1": "Cable", "MC1": "Machine",
    "BW0": "Bodyweight", "BW1": "Bodyweight", "RB1": "Band", "SM1": "Smith", "TR1": "Trap Bar",
    "PL1": "Plate", "FX1": "Suspension", "HM1": "Hammer", "CR1": "Cardio",
}

PATTERN_FALLBACK = {
    "Push": ["Press", "Bench Press", "Incline Press", "Decline Press", "Floor Press", "Close Grip Press", "Single Arm Press", "Tempo Press"],
    "Pull": ["Row", "Pulldown", "Pull-Up", "Seal Row", "Single Arm Row", "Chest Supported Row", "Wide Row", "Close Grip Row"],
    "Squat": ["Squat", "Goblet Squat", "Front Squat", "Box Squat", "Pause Squat", "Tempo Squat", "Heel Elevated Squat", "Split Squat"],
    "Hinge": ["Romanian Deadlift", "Deadlift", "Good Morning", "Hip Hinge", "Pull Through", "Single Leg RDL", "Stiff Leg Deadlift", "Kettlebell Swing"],
    "Carry": ["Farmer Carry", "Suitcase Carry", "Overhead Carry", "Rack Carry", "Waiter Carry", "Zercher Carry", "Crossbody Carry", "Yoke Walk"],
    "Rotation": ["Russian Twist", "Pallof Press", "Wood Chop", "Rotational Press", "Anti-Rotation Hold", "Bicycle Crunch", "Oblique Crunch", "Landmine Rotation"],
    "Lunge": ["Walking Lunge", "Reverse Lunge", "Bulgarian Split Squat", "Lateral Lunge", "Step-Up", "Curtsy Lunge", "Deficit Lunge", "Crossover Lunge"],
    "Press": ["Overhead Press", "Shoulder Press", "Push Press", "Landmine Press", "Arnold Press", "Z Press", "Single Arm Press", "Seated Press"],
    "Fly": ["Fly", "Incline Fly", "Decline Fly", "Cable Fly", "Rear Delt Fly", "Lateral Raise Fly", "Squeeze Fly", "Arc Fly"],
    "Curl": ["Curl", "Hammer Curl", "Preacher Curl", "Concentration Curl", "Incline Curl", "Reverse Curl", "Drag Curl", "Spider Curl"],
}


def fill_missing_pools(source_rows: list) -> int:
    """Copy sibling pools or pattern fallbacks so every SQL slot gets a real name."""
    needed = sorted({(pm, mov, eq) for _, _, pm, _, eq, _, mov, _, _, _ in source_rows})
    filled = 0
    for pm, mov, eq in needed:
        if POOL.get(pm, {}).get(mov, {}).get(eq):
            continue
        siblings = POOL.get(pm, {}).get(mov, {})
        if siblings:
            ref = next(iter(siblings.values()))
            POOL.setdefault(pm, {}).setdefault(mov, {})[eq] = list(ref)
            filled += 1
            continue
        label = EQ_LABEL.get(eq, "Standard")
        bases = PATTERN_FALLBACK.get(mov, ["Exercise", "Variation A", "Variation B", "Variation C", "Variation D"])
        POOL.setdefault(pm, {}).setdefault(mov, {})[eq] = [f"{label} {b}" for b in bases]
        filled += 1
    return filled


def pick_name(muscle: str, pattern: str, equip: str, slot: int) -> str:
    pool = POOL.get(muscle, {}).get(pattern, {}).get(equip)
    if pool:
        return pool[slot % len(pool)]
    eq_label = {"BB1": "Barbell", "DB1": "Dumbbell", "KB1": "Kettlebell", "CB1": "Cable", "MC1": "Machine",
                "BW0": "Bodyweight", "BW1": "Bodyweight", "RB1": "Band", "SM1": "Smith", "TR1": "Trap Bar",
                "PL1": "Plate", "FX1": "Suspension", "HM1": "Hammer", "CR1": "Cardio"}.get(equip, equip)
    muscle_label = {"CH": "Chest", "BA": "Back", "LA": "Lat", "SH": "Shoulder", "BI": "Bicep", "TR": "Tricep",
                    "QD": "Quad", "HM": "Hamstring", "GL": "Glute", "CV": "Calf", "CO": "Core", "FA": "Forearm",
                    "NC": "Neck", "CA": "Cardio", "FU": "Full Body"}.get(muscle, muscle)
    mods = ["Standard", "Wide", "Close", "Single Arm", "Alternating", "Tempo", "Pause", "Explosive"]
    return f"{mods[slot % len(mods)]} {eq_label} {muscle_label} {pattern}"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def esc(text: str) -> str:
    return text.replace("'", "''")


def main():
    text = SQL_SOURCE.read_text()
    pat = re.compile(
        r"INSERT INTO exercises VALUES \('([^']+)','([^']+)','([^']+)','([^']+)','([^']+)',"
        r"'([^']+)','([^']+)','([^']*)','([^']+)','([^']+)'\);"
    )
    rows = pat.findall(text)
    if len(rows) != 1000:
        raise SystemExit(f"Expected 1000 rows, got {len(rows)}")

    filled = fill_missing_pools(rows)
    print(f"Filled {filled} missing name pools")

    slot_counter: dict[tuple[str, str, str], int] = defaultdict(int)
    used_slugs: dict[str, str] = {}
    renamed = []

    for eid, _old, pm, sm, eq, diff, mov, desc, home, ai in rows:
        slot = slot_counter[(pm, mov, eq)]
        slot_counter[(pm, mov, eq)] += 1
        name = pick_name(pm, mov, eq, slot)
        base_slug = slugify(name)
        slug = base_slug
        if slug in used_slugs and used_slugs[slug] != eid:
            slug = f"{base_slug}-{eid.lower()}"
        used_slugs[slug] = eid

        primary = MUSCLE.get(pm, pm.lower())
        secondary = MUSCLE.get(sm)
        equip, requires = EQUIP.get(eq, ("bodyweight", ["bodyweight"]))
        category = CAT.get(mov, "other")
        family = FAMILY.get(mov, f"{mov.lower()}_pattern")
        et = "cardio" if pm == "CA" else "strength"
        if mov in ("Rotation",) and pm == "CO":
            et = "strength"
        if name.lower() in ("plank", "side plank", "hollow hold", "dead hang"):
            et = "timed"

        meta = {
            "requires": requires,
            "movement_family": family,
            "difficulty": diff,
            "home_gym_compatible": home == "Yes",
            "ai_replacement_category": ai,
            "source_exercise_id": eid,
        }
        renamed.append((slug, name, category, equip, primary, secondary, et, meta, eid))

    lines = [
        "-- LiftFlow 1000 exercise catalog (renamed from LiftFlow_1000_Exercise_Database.sql)",
        "",
    ]
    for slug, name, category, equip, primary, secondary, et, meta, eid in renamed:
        mg = f"array['{primary}']"
        meta_json = esc(json.dumps(meta))
        lines.append(
            f"insert into public.exercises (name, slug, category, equipment, muscle_groups, is_system, exercise_type, metadata) values "
            f"('{esc(name)}', '{slug}', '{category}', '{equip}', {mg}, true, '{et}', '{meta_json}'::jsonb) "
            f"on conflict (slug) do update set name = excluded.name, category = excluded.category, equipment = excluded.equipment, "
            f"muscle_groups = excluded.muscle_groups, exercise_type = excluded.exercise_type, metadata = excluded.metadata;"
        )

    OUT.write_text("\n".join(lines) + "\n")
    print(f"Wrote {OUT} ({len(renamed)} exercises)")
    print("Sample names:", [r[1] for r in renamed[:8]])
    print("Biceps samples:", [r[1] for r in renamed if r[4] == "biceps"][:8])
    print("Core samples:", [r[1] for r in renamed if r[4] == "core"][:8])
    print("Unique slugs:", len(set(r[0] for r in renamed)))
    standard = sum(1 for r in renamed if r[1].startswith("Standard "))
    print("Standard fallback names:", standard)

    import subprocess
    result = subprocess.run(
        ["node", "scripts/validate-exercise-education.mjs"],
        cwd=ROOT,
    )
    if result.returncode != 0:
        raise SystemExit("Exercise education validation failed — fix catalog before committing migration.")


if __name__ == "__main__":
    main()
