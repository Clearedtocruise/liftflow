import type { WorkoutChallengeTemplate } from '@/types/workoutChallenge';

export const MAX_CHALLENGES_PER_WORKOUT = 2;
export const CHALLENGE_CHANCE_AFTER_SET = 0.28;
export const CHALLENGE_CHANCE_AFTER_EXERCISE = 0.35;

export const WORKOUT_CHALLENGE_TEMPLATES: WorkoutChallengeTemplate[] = [
  {
    id: 'plus-two-reps',
    kind: 'reps',
    title: 'Bonus Reps',
    prompt: 'Add 2 extra reps on your next set — optional push past the plan.',
    logLabel: 'Reps completed',
    logPlaceholder: 'e.g. 10',
  },
  {
    id: 'slow-tempo',
    kind: 'tempo',
    title: 'Tempo Challenge',
    prompt: 'Use a 3-second lowering phase on your next set. Control the weight.',
    logLabel: 'Notes (optional)',
    logPlaceholder: 'Felt solid',
  },
  {
    id: 'top-hold',
    kind: 'hold',
    title: 'Top Hold',
    prompt: 'Hold the top position for 3 seconds on each rep of your next set.',
    logLabel: 'Notes (optional)',
    logPlaceholder: 'Completed',
  },
  {
    id: 'light-finisher',
    kind: 'finisher',
    title: 'Light Finisher',
    prompt: 'Drop to ~60% weight and chase 15–20 clean reps. Optional burnout set.',
    logLabel: 'Reps completed',
    logPlaceholder: 'e.g. 18',
  },
  {
    id: 'drop-set',
    kind: 'drop_set',
    title: 'Drop Set',
    prompt: 'After your next working set, reduce weight ~20% and go to near-failure.',
    logLabel: 'Reps on drop set',
    logPlaceholder: 'e.g. 12',
  },
  {
    id: 'pause-reps',
    kind: 'tempo',
    title: 'Pause Reps',
    prompt: 'Pause for 2 seconds at the hardest point of each rep on your next set.',
    logLabel: 'Notes (optional)',
    logPlaceholder: 'Done',
  },
];
