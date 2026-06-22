#!/usr/bin/env python3
"""Generate src/lib/generatedExerciseFormGuides.ts from migration 024 catalog."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/024_import_1000_exercise_catalog.sql"
OUT = ROOT / "src/lib/generatedExerciseFormGuides.ts"
HAND_WRITTEN = ROOT / "src/lib/exerciseFormGuides.ts"
LIMIT = 500


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def esc_ts(text: str) -> str:
    return text.replace("\\", "\\\\").replace("'", "\\'")


def hand_written_slugs() -> set[str]:
    text = HAND_WRITTEN.read_text()
    return set(re.findall(r"'([a-z0-9-]+)':\s*\{", text))


def parse_migration() -> list[dict]:
    text = MIGRATION.read_text()
    pat = re.compile(
        r"values \('([^']+)', '([^']+)', '([^']+)', '([^']+)', array\['([^']+)'\], true, '([^']+)', '(\{.*?\})'::jsonb\)"
    )
    rows = []
    for name, slug, category, equipment, muscle, ex_type, meta_raw in pat.findall(text):
        meta = json.loads(meta_raw.replace("''", "'"))
        rows.append(
            {
                "name": name,
                "slug": slug,
                "category": category,
                "equipment": equipment,
                "muscle": muscle,
                "exercise_type": ex_type,
                "family": meta.get("movement_family", ""),
            }
        )
    return rows


def pick_template(name: str, category: str, family: str) -> tuple[list[str], list[str] | None]:
    n = name.lower()
    tips: list[str] | None = None

    if any(k in n for k in ("plank", "hollow hold", "dead hang", "l-sit", "wall sit", "isometric")):
        return (
            [
                f"Set up for {name} with a neutral spine and active shoulders.",
                "Brace your core and glutes before you start the hold.",
                "Breathe steadily while keeping your body in one clean line.",
                "End the set when your hips sag, shoulders collapse, or form breaks.",
            ],
            ["Quality beats duration—stop before form deteriorates."],
        )

    if any(k in n for k in ("crunch", "sit-up", "sit up", "v-up", "toes to bar", "leg raise", "dead bug", "flutter")):
        return (
            [
                f"Start {name} with your lower back supported and ribs stacked over pelvis.",
                "Exhale as you curl or lift, moving from your abs—not momentum.",
                "Keep neck relaxed; avoid pulling on your head.",
                "Return slowly with control before the next rep.",
            ],
            None,
        )

    if any(k in n for k in ("twist", "rotation", "wood chop", "pallof", "bicycle", "oblique")):
        return (
            [
                f"Set a stable base for {name}—feet planted or kneeling with core braced.",
                "Rotate through your thoracic spine and obliques, not your lower back.",
                "Move with control; resist letting the weight pull you off balance.",
                "Return to center and repeat on the other side if alternating.",
            ],
            ["Keep hips square unless the drill specifically calls for hip rotation."],
        )

    if "curl" in n or "chin" in n or family == "biceps":
        return (
            [
                f"Stand or sit tall for {name} with shoulders down and back.",
                "Keep elbows fixed near your sides (or on the pad for preacher curls).",
                "Curl through a full range without swinging or leaning back.",
                "Squeeze at the top, then lower slowly to full extension.",
            ],
            None,
        )

    if any(k in n for k in ("back extension", "hyperextension", "reverse hyper")):
        return (
            [
                f"Position hips on the pad for {name} with feet anchored.",
                "Start with torso hanging — neutral spine, not rounded.",
                "Raise torso by extending hips and lower back to a straight line with legs.",
                "Squeeze glutes and erectors at the top; lower with control.",
            ],
            ["This is a back/hip extension — not a tricep exercise."],
        )

    if any(k in n for k in ("pushdown", "skull crusher", "kickback", "dip", "jm press")) or "tricep" in n or (
        "extension" in n and "back" not in n and "leg" not in n
    ):
        return (
            [
                f"Set up for {name} with elbows tucked and upper arms mostly still.",
                "Extend through the elbows to straighten your arms.",
                "Stop just short of hyperextending or locking out aggressively.",
                "Return with control—do not let shoulders roll forward.",
            ],
            None,
        )

    if any(k in n for k in ("row", "pulldown", "pull-up", "pull up", "pullup", "chin-up", "chin up")) or category == "pull":
        return (
            [
                f"Begin {name} with a braced core and shoulders set down and back.",
                "Pull by driving elbows toward your ribs or hips—lead with your back.",
                "Squeeze shoulder blades together at the end of the pull.",
                "Lower the weight or your body under control to full extension.",
            ],
            ["Avoid shrugging; keep chest lifted throughout."],
        )

    if any(k in n for k in ("fly", "crossover", "pec deck", "raise")) and "face pull" not in n:
        return (
            [
                f"Set up for {name} with a slight bend in your elbows that stays fixed.",
                "Open or raise through a controlled arc—no jerking.",
                "Pause briefly at the top when you feel the target muscle contract.",
                "Return slowly until you feel a comfortable stretch.",
            ],
            None,
        )

    if "face pull" in n or "pull-apart" in n or "pull apart" in n:
        return (
            [
                f"Set cable or band at roughly face height for {name}.",
                "Pull toward your face with elbows high and wide.",
                "Externally rotate at the end so hands finish near your ears.",
                "Return with control, keeping shoulders down.",
            ],
            None,
        )

    if any(k in n for k in ("press", "push-up", "push up", "bench", "floor press")) or category == "push":
        return (
            [
                f"Set your base for {name}: feet planted, core braced, shoulders packed.",
                "Lower the load with control to the target range (chest or shoulder line).",
                "Keep wrists stacked and elbows at a safe angle—usually around 45°.",
                "Press or push back up in a smooth path without bouncing.",
            ],
            None,
        )

    if any(k in n for k in ("lunge", "split squat", "step-up", "step up")) or family == "lunge_pattern":
        return (
            [
                f"Stand tall before starting {name}.",
                "Step or split into the lunge with front knee tracking over mid-foot.",
                "Lower until both knees bend roughly 90° without crashing the back knee.",
                "Drive through the front foot to return to standing or the next rep.",
            ],
            ["Keep torso upright; avoid letting the front knee collapse inward."],
        )

    if any(k in n for k in ("squat", "leg press", "hack squat", "goblet")) or category == "squat":
        return (
            [
                f"Set feet shoulder-width (or as programmed) for {name}.",
                "Brace your core, sit hips down and back, and keep chest up.",
                "Descend to comfortable depth with knees tracking over toes.",
                "Drive through mid-foot to stand without losing spinal position.",
            ],
            None,
        )

    if any(k in n for k in ("rdl", "deadlift", "good morning", "hip thrust", "glute bridge", "swing", "pull through", "pull-through")) or category == "hinge":
        return (
            [
                f"Hinge at the hips for {name} with a flat back and soft knee bend.",
                "Keep the load close to your body as you move.",
                "Stop when you feel hamstrings and glutes load—not lower back strain.",
                "Drive hips forward to return to standing and squeeze glutes at the top.",
            ],
            None,
        )

    if any(k in n for k in ("carry", "walk", "crawl", "farmer", "yoke", "suitcase", "zercher")) or category == "carry":
        return (
            [
                f"Pick up the load for {name} with a tall posture and braced core.",
                "Take short, controlled steps—do not lean or twist.",
                "Keep shoulders level and ribs stacked over pelvis.",
                "Walk the prescribed distance or time, then lower the weight safely.",
            ],
            None,
        )

    if any(k in n for k in ("calf", "toes", "raise")) and "lateral" not in n:
        return (
            [
                f"Place the balls of your feet on the platform or floor for {name}.",
                "Rise onto your toes as high as possible.",
                "Pause briefly at the top.",
                "Lower heels below parallel for a full stretch at the bottom.",
            ],
            None,
        )

    if any(k in n for k in ("wrist", "forearm", "grip", "hang")):
        return (
            [
                f"Set up {name} with forearms supported or elbows fixed as required.",
                "Move only through the wrist or grip—keep upper arms still.",
                "Use a controlled tempo; avoid jerking the weight.",
                "Stop if you feel sharp pain in the wrist or elbow.",
            ],
            None,
        )

    if any(k in n for k in ("run", "sprint", "row", "cycle", "bike", "swim", "elliptical", "burpee", "jump rope", "cardio", "interval")) or category == "cardio":
        return (
            [
                f"Start {name} at an easy effort to find rhythm and posture.",
                "Keep breathing steady and shoulders relaxed.",
                "Build intensity gradually while maintaining form.",
                "Cool down and recover before stopping completely.",
            ],
            None,
        )

    if category == "core":
        return (
            [
                f"Brace your core before starting {name}.",
                "Move slowly through the full range with a neutral spine.",
                "Exhale on the hardest part of the rep.",
                "Stop if your lower back arches or form breaks down.",
            ],
            None,
        )

    return (
        [
            f"Set up for {name} with stable footing and a braced core.",
            "Move through the full range with control—no bouncing or jerking.",
            "Keep tension on the working muscles throughout each rep.",
            "Return to the start position slowly before the next rep.",
        ],
        None,
    )


def render_ts(guides: dict[str, dict]) -> str:
    lines = [
        "// Auto-generated by scripts/generate-exercise-form-guides.py — do not edit by hand.",
        "type GeneratedExerciseFormGuide = { steps: string[]; tips?: string[] };",
        "",
        "export const GENERATED_EXERCISE_FORM_GUIDES: Record<string, GeneratedExerciseFormGuide> = {",
    ]
    for slug in sorted(guides):
        g = guides[slug]
        lines.append(f"  '{esc_ts(slug)}': {{")
        lines.append("    steps: [")
        for step in g["steps"]:
            lines.append(f"      '{esc_ts(step)}',")
        lines.append("    ],")
        if g.get("tips"):
            lines.append("    tips: [")
            for tip in g["tips"]:
                lines.append(f"      '{esc_ts(tip)}',")
            lines.append("    ],")
        lines.append("  },")
    lines.append("};")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    if not MIGRATION.exists():
        raise SystemExit(f"Missing migration: {MIGRATION}")

    existing = hand_written_slugs()
    rows = parse_migration()
    guides: dict[str, dict] = {}

    for row in rows:
        if len(guides) >= LIMIT:
            break
        slug = row["slug"]
        if slug in existing or slug in guides:
            continue
        steps, tips = pick_template(row["name"], row["category"], row["family"])
        entry: dict = {"steps": steps}
        if tips:
            entry["tips"] = tips
        guides[slug] = entry

    OUT.write_text(render_ts(guides))
    print(f"Wrote {OUT} ({len(guides)} guides, skipped {len(existing)} hand-written slugs)")


if __name__ == "__main__":
    main()
