import type { ExerciseFormGuide } from '@/lib/exerciseFormGuides';

export type MovementPhase = {
  label: string;
  detail: string;
};

export type ExerciseGuideSections = {
  /** Setup and execution steps, in order, for the phase-by-phase walkthrough. */
  phases: MovementPhase[];
  breathing: string | null;
  avoid: string[];
  easier: string[];
  harder: string[];
  /** Tips that are not already shown as a phase. */
  cues: string[];
};

/**
 * Guide steps are not all movement phases. Sources mix the setup and execution with breathing,
 * common mistakes and regressions, so each line is routed to the section it belongs to rather than
 * being labelled as a phase it is not.
 */
const BREATHING_PATTERN = /\b(inhale|exhale|breathe|breathing|breaths?)\b/i;
const AVOID_PATTERN = /^(avoid|do\s*not|don'?t|never)\b/i;
const EASIER_PATTERN = /^(regress|make\s*it\s*easier|easier)\b/i;
const HARDER_PATTERN = /^(progress|make\s*it\s*harder|harder)\b/i;

/**
 * Cue lines open with the action for that phase, so the leading verb names the phase. Anything
 * unrecognised keeps a neutral label instead of a misleading one.
 */
const PHASE_VERBS = new Set([
  'adjust',
  'align',
  'begin',
  'bend',
  'brace',
  'bring',
  'catch',
  'complete',
  'continue',
  'curl',
  'depress',
  'descend',
  'drive',
  'engage',
  'extend',
  'finish',
  'grab',
  'grip',
  'hang',
  'hinge',
  'hold',
  'initiate',
  'keep',
  'kick',
  'land',
  'lie',
  'lift',
  'load',
  'lock',
  'lower',
  'maintain',
  'move',
  'open',
  'pause',
  'pin',
  'place',
  'plant',
  'position',
  'press',
  'pull',
  'punch',
  'push',
  'rack',
  'raise',
  'reach',
  'recover',
  'resist',
  'retract',
  'return',
  'reverse',
  'rise',
  'rotate',
  'row',
  'set',
  'settle',
  'shift',
  'shorten',
  'sit',
  'squat',
  'squeeze',
  'stand',
  'start',
  'step',
  'stop',
  'straighten',
  'support',
  'swing',
  'take',
  'tighten',
  'touch',
  'tuck',
  'twist',
  'unrack',
  'walk',
  'wrap',
]);

function leadingVerb(step: string): string | null {
  const firstWord = step.trim().split(/[\s,.:;—-]+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  return PHASE_VERBS.has(firstWord) ? firstWord : null;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeForCompare(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function buildPhases(steps: string[]): MovementPhase[] {
  const labelCounts = new Map<string, number>();

  return steps.map((step, index) => {
    const verb = leadingVerb(step);
    const base =
      index === 0
        ? 'Setup'
        : verb
          ? titleCase(verb)
          : index === steps.length - 1
            ? 'Finish'
            : `Phase ${index + 1}`;

    const seen = labelCounts.get(base) ?? 0;
    labelCounts.set(base, seen + 1);
    // A repeated verb across steps would render as two identical phase chips.
    return { label: seen === 0 ? base : `${base} ${seen + 1}`, detail: step };
  });
}

export function resolveExerciseGuideSections(
  guide: ExerciseFormGuide | null | undefined,
): ExerciseGuideSections {
  const empty: ExerciseGuideSections = {
    phases: [],
    breathing: null,
    avoid: [],
    easier: [],
    harder: [],
    cues: [],
  };
  if (!guide) return empty;

  const phaseSteps: string[] = [];
  const avoid: string[] = [];
  const easier: string[] = [];
  const harder: string[] = [];
  let breathing: string | null = null;

  for (const step of guide.steps) {
    const trimmed = step.trim();
    if (!trimmed) continue;

    if (AVOID_PATTERN.test(trimmed)) {
      avoid.push(trimmed);
      continue;
    }
    if (EASIER_PATTERN.test(trimmed)) {
      easier.push(trimmed);
      continue;
    }
    if (HARDER_PATTERN.test(trimmed)) {
      harder.push(trimmed);
      continue;
    }
    // Breathing only counts when the line is about breathing rather than a cue that mentions it.
    if (breathing == null && BREATHING_PATTERN.test(trimmed) && leadingVerb(trimmed) == null) {
      breathing = trimmed;
      continue;
    }
    phaseSteps.push(trimmed);
  }

  const phases = buildPhases(phaseSteps);

  // Sources often repeat the execution steps as tips, which rendered the same sentence twice.
  const shown = new Set(phases.map((phase) => normalizeForCompare(phase.detail)));
  const cues: string[] = [];
  for (const tip of guide.tips ?? []) {
    const trimmed = tip.trim();
    if (!trimmed) continue;
    const key = normalizeForCompare(trimmed);
    if (shown.has(key)) continue;
    shown.add(key);

    if (AVOID_PATTERN.test(trimmed)) {
      if (!avoid.some((item) => normalizeForCompare(item) === key)) avoid.push(trimmed);
      continue;
    }
    if (EASIER_PATTERN.test(trimmed)) {
      if (!easier.some((item) => normalizeForCompare(item) === key)) easier.push(trimmed);
      continue;
    }
    if (HARDER_PATTERN.test(trimmed)) {
      if (!harder.some((item) => normalizeForCompare(item) === key)) harder.push(trimmed);
      continue;
    }
    if (breathing == null && BREATHING_PATTERN.test(trimmed)) {
      breathing = trimmed;
      continue;
    }
    cues.push(trimmed);
  }

  return { phases, breathing, avoid, easier, harder, cues };
}
