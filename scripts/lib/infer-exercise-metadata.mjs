/** Mirror of src/lib/exerciseEducation/inferExerciseMetadata.ts for Node audit scripts. */

function matches(name, keywords) {
  return keywords.some((k) => name.includes(k));
}

function equipmentFromName(name) {
  const rules = [
    { keys: ['smith '], equipment: 'machine' },
    { keys: ['cable '], equipment: 'cable' },
    { keys: ['machine '], equipment: 'machine' },
    { keys: ['band '], equipment: 'bands' },
    { keys: ['kettlebell ', 'kb '], equipment: 'kettlebell' },
    { keys: ['barbell ', 'bb '], equipment: 'barbell' },
    { keys: ['dumbbell ', 'db '], equipment: 'dumbbell' },
    { keys: ['trap bar '], equipment: 'barbell' },
    { keys: ['plate '], equipment: 'dumbbell' },
    { keys: ['bodyweight', 'push-up', 'push up', 'pull-up', 'pull up', 'chin-up', 'chin up'], equipment: 'bodyweight' },
  ];
  for (const rule of rules) {
    if (matches(name, rule.keys)) return rule.equipment;
  }
  return null;
}

function musclesFromName(name) {
  if (matches(name, ['neck'])) return { primary: ['neck'], secondary: ['upper traps'] };
  if (matches(name, ['reverse fly', 'rear delt fly', 'rear-delt fly'])) {
    return { primary: ['rear delts', 'rhomboids'], secondary: ['mid traps'] };
  }
  if (matches(name, ['thruster', 'man maker', 'clean and press'])) {
    return { primary: ['quads', 'glutes', 'shoulders'], secondary: ['triceps', 'core'] };
  }
  if (matches(name, ['lat pulldown', 'pulldown', 'pull-up', 'pull up', 'row'])) {
    return { primary: ['lats', 'mid back'], secondary: ['biceps'] };
  }
  if (matches(name, ['bench', 'push-up', 'fly', 'crossover']) && !matches(name, ['reverse fly'])) {
    return { primary: ['chest'], secondary: ['front delts', 'triceps'] };
  }
  if (matches(name, ['squat', 'lunge', 'leg press', 'goblet'])) {
    return { primary: ['quads', 'glutes'], secondary: ['hamstrings'] };
  }
  if (matches(name, ['deadlift', 'rdl', 'hip thrust', 'leg curl', 'good morning'])) {
    return { primary: ['hamstrings', 'glutes'], secondary: ['lower back'] };
  }
  if (matches(name, ['run', 'running', 'cardio', 'interval', 'burpee', 'jump rope'])) {
    return { primary: ['cardiovascular'], secondary: ['full body'] };
  }
  if (matches(name, ['curl']) && !matches(name, ['leg curl', 'neck'])) {
    return { primary: ['biceps'], secondary: ['forearms'] };
  }
  if (matches(name, ['tricep', 'pushdown', 'skull crusher', 'dip'])) {
    return { primary: ['triceps'], secondary: ['chest'] };
  }
  return { primary: ['full body'], secondary: [] };
}

function categoryFromName(name, muscles) {
  if (matches(name, ['run', 'running', 'cardio', 'interval', 'burpee'])) return 'cardio';
  if (matches(name, ['squat', 'lunge', 'leg press', 'goblet'])) return 'squat';
  if (matches(name, ['deadlift', 'rdl', 'hip thrust', 'leg curl', 'good morning'])) return 'hinge';
  if (matches(name, ['row', 'pulldown', 'pull-up', 'reverse fly', 'face pull'])) return 'pull';
  if (matches(name, ['press', 'push-up', 'bench', 'dip', 'thruster', 'fly'])) return 'push';
  if (muscles.primary.includes('cardiovascular')) return 'cardio';
  return 'other';
}

function exerciseTypeFromName(name) {
  if (matches(name, ['interval', 'running', 'run', 'cardio', 'burpee', 'jump rope'])) {
    return { type: 'cardio', isTimed: true, isBodyweight: false };
  }
  if (matches(name, ['plank', 'hold', 'hang', 'wall sit', 'isometric', 'carry', 'walk'])) {
    return { type: 'timed', isTimed: true, isBodyweight: false };
  }
  if (matches(name, ['push-up', 'pull-up', 'chin-up', 'dip', 'bodyweight'])) {
    return { type: 'bodyweight', isTimed: false, isBodyweight: true };
  }
  return { type: 'strength', isTimed: false, isBodyweight: false };
}

export function inferExerciseMetadata(row) {
  const name = row.name.trim().toLowerCase();
  const muscles = musclesFromName(name);
  const equipmentGuess = equipmentFromName(name);
  const typeGuess = exerciseTypeFromName(name);
  return {
    primaryMuscles: muscles.primary,
    secondaryMuscles: muscles.secondary,
    equipment: equipmentGuess ?? row.equipment,
    movementCategory: categoryFromName(name, muscles),
    exerciseType: typeGuess.type,
    isBodyweight: typeGuess.isBodyweight || equipmentGuess === 'bodyweight',
    isTimed: typeGuess.isTimed,
  };
}

export function detectMetadataMismatches(row) {
  const inferred = inferExerciseMetadata(row);
  const mismatches = [];

  if (row.category !== inferred.movementCategory) {
    mismatches.push({ field: 'category', stored: row.category, expected: inferred.movementCategory });
  }
  if (equipmentFromName(row.name.trim().toLowerCase()) && row.equipment !== inferred.equipment) {
    mismatches.push({ field: 'equipment', stored: row.equipment, expected: inferred.equipment });
  }
  if (row.exerciseType !== inferred.exerciseType) {
    mismatches.push({ field: 'exercise_type', stored: row.exerciseType, expected: inferred.exerciseType });
  }

  const storedMuscle = row.muscleGroups?.[0];
  const expectedMuscle = inferred.primaryMuscles[0];
  if (storedMuscle && expectedMuscle && storedMuscle !== expectedMuscle) {
    const name = row.name.trim().toLowerCase();
    if (name.includes('interval') && row.exerciseType === 'cardio' && storedMuscle === 'cardiovascular') {
      return mismatches;
    }
    if (name.includes('reverse fly') && storedMuscle === 'shoulders') {
      return mismatches;
    }
    const overlap = inferred.primaryMuscles.some((m) =>
      (row.muscleGroups ?? []).some((s) => s.includes(m.split(' ')[0])),
    );
    if (!overlap && storedMuscle !== 'full body') {
      mismatches.push({
        field: 'muscle_groups',
        stored: row.muscleGroups.join(', '),
        expected: inferred.primaryMuscles.join(', '),
      });
    }
  }

  return mismatches;
}

export function guidePatternForName(name) {
  const n = name.toLowerCase();
  if (n.includes('reverse fly') || n.includes('rear delt')) return 'rear_delt_fly';
  if (n.includes('neck')) return 'neck_isolation';
  if (n.includes('thruster') || n.includes('man maker') || n.includes('clean and press')) return 'thruster_or_cardio';
  if (n.includes('interval') || n.includes('sprint') || n.includes('cardio')) return 'thruster_or_cardio';
  if (n.includes('squat') || n.includes('lunge') || n.includes('leg press') || n.includes('goblet')) return 'squat';
  if (n.includes('deadlift') || n.includes('rdl') || n.includes('hip thrust') || n.includes('leg curl')) return 'hinge';
  if (n.includes('row') || n.includes('pulldown') || n.includes('pull-up') || n.includes('pull up') || n.includes('chin')) return 'pull';
  if (n.includes('press') || n.includes('push-up') || n.includes('push up') || n.includes('bench') || n.includes('dip')) return 'press';
  if (n.includes('curl')) return 'curl';
  if (n.includes('fly') || n.includes('crossover') || n.includes('raise')) return 'chest_fly';
  if (n.includes('plank') || n.includes('crunch') || n.includes('twist') || n.includes('core')) return 'core';
  if (n.includes('carry') || n.includes('farmer') || n.includes('walk')) return 'carry';
  if (n.includes('run') || n.includes('burpee') || n.includes('jump rope')) return 'cardio';
  return 'general';
}
