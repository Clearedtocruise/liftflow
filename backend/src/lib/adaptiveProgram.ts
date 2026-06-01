import { applySubstitutionsToExercises, type LimitationContext } from './exerciseSubstitution.js';
import { reschedulePlannedWorkout } from './programEngine.js';
import { addDays, currentProgramWeek, phaseForWeek } from './programTypes.js';
import { requireAdmin } from './supabase.js';
import { loadActiveLimitations, loadRecoveryModifiers } from './workoutPlanner.js';

export async function adaptActiveProgram(userId: string) {
  const db = requireAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: program } = await db
    .from('training_programs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!program) return { adapted: false, changes: [] as string[] };

  const programId = program.id;
  const metadata = program.metadata as { startDate?: string; durationWeeks?: number };
  const startDate = metadata.startDate ?? program.created_at.slice(0, 10);
  const durationWeeks = program.duration_weeks ?? 12;
  const changes: string[] = [];

  const [limitations, recoveryMods] = await Promise.all([
    loadActiveLimitations(userId),
    loadRecoveryModifiers(userId),
  ]);

  const { data: missed } = await db
    .from('planned_workouts')
    .select('*')
    .eq('user_id', userId)
    .contains('metadata', { programId })
    .eq('status', 'planned')
    .lt('scheduled_date', today)
    .order('scheduled_date', { ascending: true });

  for (const workout of missed ?? []) {
    const meta = workout.metadata as { slotLabel?: string; rescheduledFrom?: string };
    if (meta.rescheduledFrom) continue;

    let newDate = today;
    const dayIndex = new Date(workout.scheduled_date + 'T12:00:00').getDay();
    const daysUntilSameSlot = (dayIndex + 7 - new Date(today + 'T12:00:00').getDay()) % 7 || 7;
    newDate = addDays(today, daysUntilSameSlot);

    await reschedulePlannedWorkout(workout.id, newDate);
    changes.push(`Rescheduled missed ${meta.slotLabel ?? workout.name} to ${newDate}`);
  }

  if (recoveryMods.recoveryModeActive || recoveryMods.volumeMultiplier < 1) {
    const { data: upcoming } = await db
      .from('planned_workouts')
      .select('*')
      .eq('user_id', userId)
      .contains('metadata', { programId })
      .eq('status', 'planned')
      .gte('scheduled_date', today)
      .limit(3);

    for (const workout of upcoming ?? []) {
      const meta = workout.metadata as { exercises?: Array<{ name: string; sets: number; reps: string; weightLbs?: number; restSeconds: number; notes?: string }> };
      if (!meta.exercises) continue;

      let exercises = meta.exercises.map((ex) => ({
        ...ex,
        sets: Math.max(1, Math.round(ex.sets * recoveryMods.volumeMultiplier)),
        weightLbs: ex.weightLbs
          ? Math.round((ex.weightLbs * recoveryMods.intensityMultiplier) / 5) * 5
          : ex.weightLbs,
        notes: [ex.notes, 'Adjusted for recovery score'].filter(Boolean).join(' · '),
      }));

      if (recoveryMods.recoveryModeActive) {
        exercises = exercises.map((ex) => ({ ...ex, reps: '10-12' }));
      }

      await db
        .from('planned_workouts')
        .update({
          ai_rationale: `${workout.ai_rationale ?? ''} · Recovery-adjusted workload`.trim(),
          metadata: { ...meta, exercises, recoveryAdjusted: true },
        })
        .eq('id', workout.id);
    }

    if ((upcoming ?? []).length > 0) {
      changes.push(`Reduced workload on ${upcoming!.length} upcoming session(s) due to recovery score`);
    }
  }

  if (limitations.length > 0) {
    const { data: upcoming } = await db
      .from('planned_workouts')
      .select('*')
      .eq('user_id', userId)
      .contains('metadata', { programId })
      .eq('status', 'planned')
      .gte('scheduled_date', today)
      .limit(5);

    for (const workout of upcoming ?? []) {
      const meta = workout.metadata as { exercises?: Array<{ name: string; sets: number; reps: string; weightLbs?: number; restSeconds: number; notes?: string }> };
      if (!meta.exercises) continue;

      const substituted = applySubstitutionsToExercises(meta.exercises, limitations as LimitationContext[]);
      const changed = substituted.some((ex, i) => ex.name !== meta.exercises![i]?.name);
      if (!changed) continue;

      await db
        .from('planned_workouts')
        .update({
          metadata: { ...meta, exercises: substituted, limitationAdjusted: true },
          ai_rationale: `${workout.ai_rationale ?? ''} · Exercises substituted for active limitations`.trim(),
        })
        .eq('id', workout.id);
    }

    changes.push(`Applied exercise substitutions for ${limitations.length} active limitation(s)`);
  }

  const week = currentProgramWeek(startDate, today);
  const expectedPhase = phaseForWeek(week, durationWeeks);

  const { data: activePhase } = await db
    .from('training_phases')
    .select('*')
    .eq('program_id', programId)
    .lte('start_date', today)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentSprintPhase = (activePhase?.metadata as { sprintPhase?: string })?.sprintPhase;
  if (currentSprintPhase && currentSprintPhase !== expectedPhase.sprintPhase) {
    const weekStart = addDays(startDate, (week - 1) * 7);
    await db.from('training_phases').insert({
      user_id: userId,
      program_id: programId,
      name: `${expectedPhase.sprintPhase} — Week ${week}`,
      phase_type: expectedPhase.phaseType,
      start_date: weekStart,
      end_date: addDays(weekStart, 6),
      metadata: {
        sprintPhase: expectedPhase.sprintPhase,
        weekNumber: week,
        autoTransition: true,
        previousPhase: currentSprintPhase,
      },
    });
    changes.push(`Advanced to ${expectedPhase.sprintPhase} phase (week ${week})`);
  }

  if (recoveryMods.recoveryModeActive && expectedPhase.sprintPhase !== 'deload' && expectedPhase.sprintPhase !== 'recovery') {
    changes.push('Recovery Mode active — consider deload if fatigue persists');
  }

  return { adapted: changes.length > 0, changes };
}
