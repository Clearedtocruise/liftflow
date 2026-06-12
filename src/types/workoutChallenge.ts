export type WorkoutChallengeKind = 'reps' | 'tempo' | 'hold' | 'finisher' | 'drop_set';

export type WorkoutChallengeTrigger = 'between_sets' | 'between_exercises';

export type WorkoutChallengeStatus = 'skipped' | 'completed';

export type WorkoutChallengeTemplate = {
  id: string;
  kind: WorkoutChallengeKind;
  title: string;
  prompt: string;
  logLabel?: string;
  logPlaceholder?: string;
};

export type WorkoutChallengeRecord = {
  challengeId: string;
  kind: WorkoutChallengeKind;
  title: string;
  prompt: string;
  status: WorkoutChallengeStatus;
  trigger: WorkoutChallengeTrigger;
  exerciseName?: string;
  loggedValue?: string;
};

export type WorkoutChallengeNotesPayload = {
  challenges: WorkoutChallengeRecord[];
};
