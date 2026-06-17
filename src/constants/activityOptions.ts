export type SportActivity = {
  id: string;
  label: string;
  intensity: 'low' | 'moderate' | 'high';
};

export const SPORTS_ACTIVITIES: SportActivity[] = [
  { id: 'basketball', label: 'Basketball', intensity: 'high' },
  { id: 'pickleball', label: 'Pickleball', intensity: 'moderate' },
  { id: 'tennis', label: 'Tennis', intensity: 'moderate' },
  { id: 'soccer', label: 'Soccer', intensity: 'high' },
  { id: 'football', label: 'Football', intensity: 'high' },
  { id: 'hockey', label: 'Hockey', intensity: 'high' },
  { id: 'volleyball', label: 'Volleyball', intensity: 'moderate' },
  { id: 'golf', label: 'Golf', intensity: 'low' },
  { id: 'baseball', label: 'Baseball', intensity: 'moderate' },
  { id: 'softball', label: 'Softball', intensity: 'moderate' },
  { id: 'martial-arts', label: 'Martial Arts', intensity: 'high' },
  { id: 'wrestling', label: 'Wrestling', intensity: 'high' },
  { id: 'boxing', label: 'Boxing', intensity: 'high' },
  { id: 'mma', label: 'MMA', intensity: 'high' },
  { id: 'surfing', label: 'Surfing', intensity: 'moderate' },
  { id: 'skateboarding', label: 'Skateboarding', intensity: 'moderate' },
  { id: 'hiking', label: 'Hiking', intensity: 'moderate' },
  { id: 'other-sport', label: 'Other Sport', intensity: 'moderate' },
];

export const MANUAL_CARDIO_OPTIONS = [
  { id: 'walk', label: 'Walk', cardioType: 'walk' as const },
  { id: 'run', label: 'Run', cardioType: 'run' as const },
  { id: 'bike', label: 'Bike', cardioType: 'cycle' as const },
  { id: 'row', label: 'Row', cardioType: 'row' as const },
  { id: 'stairs', label: 'Stair Climber', cardioType: 'treadmill' as const },
  { id: 'elliptical', label: 'Elliptical', cardioType: 'elliptical' as const },
  { id: 'swim', label: 'Swimming', cardioType: 'swim' as const },
  { id: 'other-cardio', label: 'Other', cardioType: 'other' as const },
];

export type ActivityLogKind = 'workout' | 'cardio' | 'sport' | 'conditioning' | 'mobility' | 'recovery' | 'walk';

export const HOME_ACTIVITY_OPTIONS: Array<{ id: ActivityLogKind | 'tabata' | 'hiit'; label: string; route: string }> = [
  { id: 'tabata', label: 'Tabata', route: '/(features)/cardio-tracking?activity=tabata' },
  { id: 'hiit', label: 'HIIT Intervals', route: '/(features)/cardio-tracking?activity=hiit-40-20' },
  { id: 'workout', label: 'Workout', route: '/(tabs)/workout/manual-log' },
  { id: 'cardio', label: 'Cardio (log)', route: '/(features)/log-activity?kind=cardio' },
  { id: 'sport', label: 'Sport', route: '/(features)/log-activity?kind=sport' },
  { id: 'conditioning', label: 'HIIT & Cardio', route: '/(features)/cardio-tracking' },
  { id: 'mobility', label: 'Mobility', route: '/(features)/log-activity?kind=mobility' },
  { id: 'recovery', label: 'Recovery', route: '/(features)/recovery-check-in' },
  { id: 'walk', label: 'Walk', route: '/(features)/log-activity?kind=walk' },
];
