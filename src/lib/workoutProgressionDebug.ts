type WorkoutProgressionLogInput = {
  exerciseId: string;
  exerciseName: string;
  programmedSets: number;
  completedSets: number;
  advance: boolean;
  advanceTrigger?: string;
};

export function logWorkoutProgressionDecision(input: WorkoutProgressionLogInput): void {
  if (!__DEV__) return;

  const lines = [
    input.exerciseName,
    `Exercise ID: ${input.exerciseId}`,
    `Programmed Sets: ${input.programmedSets}`,
    `Completed Sets: ${input.completedSets}`,
    `Advance: ${input.advance ? 'TRUE' : 'FALSE'}`,
  ];

  if (input.advanceTrigger) {
    lines.push(`Advance Trigger: ${input.advanceTrigger}`);
  }

  console.info(`[workout-progression]\n${lines.join('\n')}`);
}
