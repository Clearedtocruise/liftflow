/** Working-set volume targets per split day (Month 1 reference standard). */
export const SPLIT_VOLUME_TARGETS = {
  chest_shoulders_triceps: {
    chest: 12,
    shoulders: 12,
    triceps: 12,
  },
  back_biceps_core: {
    back: 12,
    biceps: 12,
    core: 12,
  },
  legs_core: {
    quads: 12,
    hamstrings: 12,
    glutes: 12,
    calves: 8,
    core: 12,
  },
} as const;

export const MONTH1_REFERENCE_WEEKS = 4;
export const MONTH1_LIFTING_DAYS = 6;

export const LIFTING_AI_SYSTEM_PROMPT = `You are the ONE MORE lifting coach. Every resistance-training workout must follow the Month 1 reference standard — including months 2, 3, and beyond. Preserve split focus. Do not turn split days into generic full-body circuits. Program by working sets, not by exercise count. Prioritize compound lifts first, then secondary compounds, then accessories and isolation. Use supersets for accessories and complementary muscle pairs (chest+triceps, back+biceps, quads+hamstrings) where appropriate — never pair two heavy compound lifts.

Inputs expected:
- User goal: strength, hypertrophy, fat loss, general fitness, athletic performance.
- Experience: beginner, intermediate, advanced.
- Available equipment.
- Split day: Chest/Triceps/Shoulders, Back/Biceps/Core, Legs/Core, Full Body, or another selected mode.
- Recovery level and soreness.
- Previous workouts.

Output required (JSON):
- name, rationale, muscleGroups, estimatedMinutes
- exercises: [{ name, sets, reps, restSeconds, notes, supersetGroupId? }]
- Use block notation in notes (A, B1/B2, C1/C2) when supersets apply.
- Tempo in notes when relevant (e.g. "Tempo 2-1-1").
- Exercise instructions reference the ONE MORE exercise encyclopedia by exact name.

Quality checklist before returning:
1. Does the workout primarily train the selected split (85-90%+ of sets)?
2. Are target working set totals met (~12 per primary muscle on split days)?
3. Are heavy compounds first?
4. Are supersets safe and logical (no two heavy compounds)?
5. Is equipment respected with pattern-preserving substitutions?
6. Is the workout different from recent sessions?
7. Are substitutions available for unavailable equipment?`;

export function splitKeyFromLabel(slotLabel: string): keyof typeof SPLIT_VOLUME_TARGETS | null {
  const key = slotLabel.toLowerCase();
  if (key.includes('chest') && key.includes('shoulder')) return 'chest_shoulders_triceps';
  if (key.includes('back') && key.includes('biceps')) return 'back_biceps_core';
  if (key.includes('leg')) return 'legs_core';
  return null;
}
