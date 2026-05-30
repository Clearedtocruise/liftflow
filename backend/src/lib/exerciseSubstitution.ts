export type LimitationContext = {
  bodyArea: string;
  limitationType: string;
  painScore?: number;
  affectedMovements?: string[];
  movementRestrictions?: string[];
};

type SubstitutionRule = {
  triggerPatterns: RegExp[];
  blockedExercisePatterns: RegExp[];
  substitutes: string[];
  rationale: string;
};

const SUBSTITUTION_RULES: SubstitutionRule[] = [
  {
    triggerPatterns: [/shoulder/i, /rotator/i, /deltoid/i],
    blockedExercisePatterns: [
      /barbell bench press/i,
      /overhead press/i,
      /barbell press/i,
      /military press/i,
      /upright row/i,
    ],
    substitutes: ['Neutral Grip Dumbbell Press', 'Machine Chest Press', 'Push-Up', 'Landmine Press'],
    rationale: 'Shoulder-friendly pressing alternatives reduce impingement risk.',
  },
  {
    triggerPatterns: [/elbow/i, /forearm/i],
    blockedExercisePatterns: [/skull crusher/i, /tricep extension/i, /barbell curl/i, /chin-?up/i, /pull-?up/i],
    substitutes: ['Cable Tricep Pushdown', 'Hammer Curl', 'Neutral Grip Row', 'Machine Row'],
    rationale: 'Neutral-grip and machine options reduce elbow stress.',
  },
  {
    triggerPatterns: [/lower back/i, /lumbar/i, /back/i],
    blockedExercisePatterns: [/conventional deadlift/i, /barbell deadlift/i, /good morning/i, /back squat/i],
    substitutes: ['Trap Bar Deadlift', 'Hip Thrust', 'Leg Press', 'Romanian Deadlift (light)'],
    rationale: 'Hip-dominant and supported variations reduce spinal loading.',
  },
  {
    triggerPatterns: [/knee/i, /patella/i],
    blockedExercisePatterns: [/back squat/i, /barbell squat/i, /lunge/i, /leg extension/i],
    substitutes: ['Split Squat', 'Leg Press', 'Step-Up', 'Goblet Squat (partial range)'],
    rationale: 'Reduced knee flexion angles and supported patterns limit joint stress.',
  },
  {
    triggerPatterns: [/hip/i, /groin/i],
    blockedExercisePatterns: [/sumo deadlift/i, /wide squat/i, /lateral lunge/i],
    substitutes: ['Trap Bar Deadlift', 'Hip Thrust', 'Romanian Deadlift', 'Leg Press'],
    rationale: 'Narrow-stance and hip-hinge alternatives reduce hip irritation.',
  },
  {
    triggerPatterns: [/wrist/i],
    blockedExercisePatterns: [/front squat/i, /barbell curl/i, /push-?up/i],
    substitutes: ['Dumbbell Press', 'Machine Press', 'Hammer Curl', 'Cable Fly'],
    rationale: 'Neutral wrist positions reduce extension stress.',
  },
];

export function findSubstitutionsForLimitation(limitation: LimitationContext): SubstitutionRule[] {
  const area = limitation.bodyArea.toLowerCase();
  const description = (limitation.affectedMovements ?? []).join(' ').toLowerCase();
  const haystack = `${area} ${description}`;

  return SUBSTITUTION_RULES.filter((rule) =>
    rule.triggerPatterns.some((pattern) => pattern.test(haystack)),
  );
}

export function shouldBlockExercise(
  exerciseName: string,
  limitations: LimitationContext[],
): { blocked: boolean; reason?: string; substitutes?: string[] } {
  const name = exerciseName.toLowerCase();

  for (const limitation of limitations) {
    const rules = findSubstitutionsForLimitation(limitation);
    for (const rule of rules) {
      if (rule.blockedExercisePatterns.some((pattern) => pattern.test(name))) {
        return {
          blocked: true,
          reason: rule.rationale,
          substitutes: rule.substitutes,
        };
      }
    }

    for (const movement of limitation.affectedMovements ?? []) {
      if (name.includes(movement.toLowerCase())) {
        const rulesForArea = findSubstitutionsForLimitation(limitation);
        return {
          blocked: true,
          reason: `Blocked due to ${limitation.bodyArea} ${limitation.limitationType}.`,
          substitutes: rulesForArea[0]?.substitutes ?? ['Machine variation', 'Bodyweight alternative'],
        };
      }
    }
  }

  return { blocked: false };
}

export function applySubstitutionsToExercises<T extends { name: string; notes?: string }>(
  exercises: T[],
  limitations: LimitationContext[],
): T[] {
  if (limitations.length === 0) return exercises;

  return exercises.map((exercise) => {
    const check = shouldBlockExercise(exercise.name, limitations);
    if (!check.blocked || !check.substitutes?.length) return exercise;

    const substitute = check.substitutes[0];
    return {
      ...exercise,
      name: substitute,
      notes: [exercise.notes, `Substituted for ${exercise.name}: ${check.reason}`].filter(Boolean).join(' · '),
    };
  });
}

export function parseLimitationFromVoice(text: string): Partial<LimitationContext> & { description: string } | null {
  const lower = text.toLowerCase();
  const bodyMatch =
    lower.match(/\b(shoulder|elbow|knee|lower back|back|hip|wrist|neck|ankle)\b/i) ??
    lower.match(/\bmy ([a-z ]+?) (hurts|aches|feels)/i);

  const bodyArea = bodyMatch?.[1] ?? bodyMatch?.[0] ?? '';
  if (!bodyArea) return null;

  let limitationType = 'pain';
  if (/injury|diagnosed|torn|sprain|strain/i.test(lower)) limitationType = 'injury';
  else if (/tight|stiff/i.test(lower)) limitationType = 'tightness';
  else if (/mobility|range of motion|rom/i.test(lower)) limitationType = 'mobility';
  else if (/discomfort|uncomfortable/i.test(lower)) limitationType = 'discomfort';

  const movementMatch = lower.match(/when (?:i )?(?:do )?(.+?)(?:\.|$)/i);
  const affectedMovements = movementMatch?.[1]
    ? [movementMatch[1].trim()]
    : undefined;

  return {
    bodyArea: bodyArea.replace(/^my /i, '').trim(),
    limitationType,
    description: text.trim(),
    affectedMovements,
    painScore: /severe|bad|sharp|8|9|10/.test(lower) ? 8 : /moderate|5|6|7/.test(lower) ? 6 : 4,
  };
}
