import { Router } from 'express';

import { adaptActiveProgram } from '../lib/adaptiveProgram.js';
import { adaptToPreferenceChanges } from '../lib/preferenceAdaptation.js';
import { applyScheduleChange } from '../lib/planAdaptationEngine.js';
import {
  loadExerciseCoachPrescription,
  loadWorkoutExercisePrescriptions,
} from '../lib/exerciseCoachPrescription.js';
import { assessRecovery, suggestMuscleGroups } from '../lib/aiCoach.js';
import { activateCoachSystem } from '../lib/coachActivation.js';
import {
    answerSmartCoachQuestion,
    calculateRecoveryScore,
    loadCoachContext,
    mergeTrainingLoadScore,
} from '../lib/coachContext.js';
import { parseLimitationFromVoice } from '../lib/exerciseSubstitution.js';
import { loadRecoveryIntelligence } from '../lib/loadRecoveryIntelligence.js';
import { loadSmartProgression } from '../lib/loadSmartProgression.js';
import { loadWorkoutRecommendations } from '../lib/loadWorkoutRecommendations.js';
import { generatePostWorkoutCoachSummary } from '../lib/postWorkoutCoach.js';
import {
    generateTrainingProgram,
    getPlannedWorkoutsInRange,
    getPlannedWorkoutsInRangeWithRefresh,
    getProgramDashboard,
    regenerateActiveProgram,
    reschedulePlannedWorkout,
    type CreateProgramInput,
} from '../lib/programEngine.js';
import { requireAdmin } from '../lib/supabase.js';
import { authedUserId } from '../middleware/authUser.js';
import { requireProSubscription } from '../middleware/requireProSubscription.js';

export const trainingRouter = Router();

function weekStartDate(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

trainingRouter.get('/suggest-muscles', async (req, res) => {
  try {
    const userId = authedUserId(req);
    res.json(await suggestMuscleGroups(userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Suggest muscles failed' });
  }
});

trainingRouter.get('/recovery', async (req, res) => {
  try {
    const userId = authedUserId(req);
    res.json(await assessRecovery(userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Recovery assessment failed' });
  }
});

trainingRouter.get('/recovery/today', async (req, res) => {
  try {
    const userId = authedUserId(req);

    const db = requireAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await db
      .from('recovery_assessments')
      .select('*')
      .eq('user_id', userId)
      .eq('check_in_date', today)
      .maybeSingle();

    res.json(data ?? null);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Recovery today failed' });
  }
});

trainingRouter.get('/recommendations/daily', requireProSubscription, async (req, res) => {
  try {
    const userId = authedUserId(req);
    res.json(await loadWorkoutRecommendations(userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Workout recommendations failed' });
  }
});

trainingRouter.get('/recovery/intelligence', requireProSubscription, async (req, res) => {
  try {
    const userId = authedUserId(req);
    res.json(await loadRecoveryIntelligence(userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Recovery intelligence failed' });
  }
});

trainingRouter.post('/progression/smart', requireProSubscription, async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { exerciseId, sessionId, currentSessionSets } = req.body as {
      exerciseId?: string;
      sessionId?: string;
      currentSessionSets?: Array<{ weightKg: number; reps: number; setNumber?: number; isFailure?: boolean }>;
    };

    if (!exerciseId) {
      res.status(400).json({ message: 'exerciseId is required' });
      return;
    }

    res.json(
      await loadSmartProgression(userId, exerciseId, {
        sessionId,
        currentSessionSets,
      }),
    );
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Smart progression failed' });
  }
});

trainingRouter.get('/progression/:exerciseId', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { exerciseId } = req.params;
    res.json(await loadSmartProgression(userId, exerciseId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Smart progression failed' });
  }
});

trainingRouter.get('/recovery/trend', async (req, res) => {
  try {
    const userId = authedUserId(req);

    const db = requireAdmin();
    const since = new Date();
    since.setDate(since.getDate() - 14);

    const { data } = await db
      .from('recovery_assessments')
      .select('check_in_date, recovery_score, daily_recommendation, recovery_mode_active, status')
      .eq('user_id', userId)
      .not('check_in_date', 'is', null)
      .gte('check_in_date', since.toISOString().slice(0, 10))
      .order('check_in_date', { ascending: true });

    res.json(data ?? []);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Recovery trend failed' });
  }
});

trainingRouter.post('/recovery/check-in', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const {
      sleepHours,
      sleepQuality,
      energyLevel,
      stressLevel,
      sorenessLevel,
    } = req.body as {
      sleepHours?: number;
      sleepQuality?: number;
      energyLevel?: number;
      stressLevel?: number;
      sorenessLevel?: number;
    };

    const db = requireAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: recent } = await db
      .from('workout_sessions')
      .select('total_volume')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('started_at', threeDaysAgo.toISOString());

    const sessionCount = recent?.length ?? 0;
    const totalVolume = (recent ?? []).reduce((s, r) => s + Number(r.total_volume ?? 0), 0);

    const subjective = calculateRecoveryScore({
      sleepHours,
      sleepQuality,
      energyLevel,
      stressLevel,
      sorenessLevel,
    });

    const recoveryScore = mergeTrainingLoadScore(subjective.recoveryScore, sessionCount, totalVolume);
    const recoveryModeActive = recoveryScore < 40 || subjective.recoveryModeActive;

    let dailyRecommendation = subjective.dailyRecommendation;
    if (recoveryScore < subjective.recoveryScore) {
      dailyRecommendation = `${dailyRecommendation} Recent training load also elevated — consider extra recovery.`;
    }

    const payload = {
      user_id: userId,
      assessed_at: new Date().toISOString(),
      check_in_date: today,
      status: subjective.status,
      sleep_hours: sleepHours,
      sleep_quality_score: sleepQuality,
      stress_score: stressLevel,
      soreness_score: sorenessLevel,
      energy_score: energyLevel,
      recovery_score: recoveryScore,
      daily_recommendation: dailyRecommendation,
      recovery_mode_active: recoveryModeActive,
      ai_analysis: dailyRecommendation,
      recommendations: JSON.stringify([
        recoveryModeActive ? 'Recovery Mode Active' : recoveryScore >= 85 ? 'Proceed as planned' : 'Reduce volume',
      ]),
      metadata: {
        volumeMultiplier: subjective.volumeMultiplier,
        intensityMultiplier: subjective.intensityMultiplier,
      },
    };

    const { data, error } = await db
      .from('recovery_assessments')
      .upsert(payload, { onConflict: 'user_id,check_in_date' })
      .select('*')
      .single();

    if (error) {
      const { data: inserted, error: insertError } = await db
        .from('recovery_assessments')
        .insert(payload)
        .select('*')
        .single();
      if (insertError) throw insertError;
      res.json(inserted);
      return;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Recovery check-in failed' });
  }
});

trainingRouter.post('/weekly-check-in', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const {
      weightKg,
      waistCm,
      compliancePct,
      energyScore,
      sleepScore,
    } = req.body as {
      weightKg?: number;
      waistCm?: number;
      compliancePct?: number;
      energyScore?: number;
      sleepScore?: number;
    };

    const db = requireAdmin();
    const weekStart = weekStartDate();

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const [priorCheckIns, recentSessions, priorWeight] = await Promise.all([
      db
        .from('weekly_coach_check_ins')
        .select('*')
        .eq('user_id', userId)
        .order('week_start_date', { ascending: false })
        .limit(4),
      db
        .from('workout_sessions')
        .select('id, status')
        .eq('user_id', userId)
        .gte('started_at', fourWeeksAgo.toISOString()),
      db
        .from('weekly_coach_check_ins')
        .select('weight_kg')
        .eq('user_id', userId)
        .order('week_start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const completed = (recentSessions.data ?? []).filter((s) => s.status === 'completed').length;
    const planned = (recentSessions.data ?? []).length;
    const completionRate = planned > 0 ? Math.round((completed / planned) * 100) : compliancePct ?? 0;

    const recommendations: string[] = [];
    let analysis = 'Weekly check-in recorded.';

    if (weightKg && priorWeight.data?.weight_kg) {
      const delta = weightKg - Number(priorWeight.data.weight_kg);
      if (delta > 0.5) recommendations.push('Weight trending up — review calorie intake if fat loss is the goal.');
      else if (delta < -0.5) recommendations.push('Weight trending down — ensure adequate protein and recovery.');
      else analysis = 'Weight stable week over week.';
    }

    if ((compliancePct ?? completionRate) < 70) {
      recommendations.push('Workout compliance below 70% — reduce session frequency or simplify the program.');
    } else if ((compliancePct ?? completionRate) >= 90) {
      recommendations.push('Strong compliance — good window for progressive overload.');
    }

    if ((energyScore ?? 8) <= 5 || (sleepScore ?? 8) <= 5) {
      recommendations.push('Low energy or sleep — consider a deload week.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Maintain current training and nutrition approach.');
    }

    const payload = {
      user_id: userId,
      week_start_date: weekStart,
      weight_kg: weightKg,
      waist_cm: waistCm,
      compliance_pct: compliancePct ?? completionRate,
      energy_score: energyScore,
      sleep_score: sleepScore,
      analysis,
      recommendations,
      metadata: { completedSessions: completed },
    };

    const { data, error } = await db
      .from('weekly_coach_check_ins')
      .upsert(payload, { onConflict: 'user_id,week_start_date' })
      .select('*')
      .single();

    if (error) throw error;

    if (weightKg) {
      await db.from('body_composition_records').insert({
        user_id: userId,
        weight_kg: weightKg,
        waist_cm: waistCm,
        estimation_method: 'weekly_check_in',
      });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Weekly check-in failed' });
  }
});

trainingRouter.get('/weekly-check-in/trend', async (req, res) => {
  try {
    const userId = authedUserId(req);

    const db = requireAdmin();
    const { data } = await db
      .from('weekly_coach_check_ins')
      .select('*')
      .eq('user_id', userId)
      .order('week_start_date', { ascending: false })
      .limit(12);

    res.json(data ?? []);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Weekly trend failed' });
  }
});

trainingRouter.get('/limitations', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const activeOnly = req.query.active !== 'false';

    const db = requireAdmin();
    let query = db.from('training_limitations').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data ?? []);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'List limitations failed' });
  }
});

trainingRouter.post('/limitations', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const {
      limitationType,
      bodyArea,
      severity,
      painScore,
      isDiagnosed,
      description,
      movementRestrictions,
      affectedMovements,
      voiceText,
    } = req.body as {
      limitationType?: string;
      bodyArea?: string;
      severity?: number;
      painScore?: number;
      isDiagnosed?: boolean;
      description?: string;
      movementRestrictions?: string[];
      affectedMovements?: string[];
      voiceText?: string;
    };

    let parsed = voiceText ? parseLimitationFromVoice(voiceText) : null;

    const db = requireAdmin();
    const { data, error } = await db
      .from('training_limitations')
      .insert({
        user_id: userId,
        limitation_type: limitationType ?? parsed?.limitationType ?? 'pain',
        body_area: bodyArea ?? parsed?.bodyArea ?? 'unspecified',
        severity: severity ?? parsed?.painScore ?? 5,
        pain_score: painScore ?? parsed?.painScore ?? 5,
        is_diagnosed: isDiagnosed ?? (parsed?.limitationType === 'injury'),
        description: description ?? parsed?.description ?? voiceText,
        movement_restrictions: movementRestrictions ?? parsed?.movementRestrictions ?? [],
        affected_movements: affectedMovements ?? parsed?.affectedMovements ?? [],
        is_active: true,
      })
      .select('*')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Create limitation failed' });
  }
});

trainingRouter.patch('/limitations/:id', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { id } = req.params;
    const updates = req.body as Record<string, unknown>;
    const db = requireAdmin();

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    if (updates.resolved === true) {
      payload.is_active = false;
      payload.resolved_at = new Date().toISOString();
    }
    if (updates.painScore !== undefined) payload.pain_score = updates.painScore;
    if (updates.severity !== undefined) payload.severity = updates.severity;
    if (updates.description !== undefined) payload.description = updates.description;

    const { data, error } = await db
      .from('training_limitations')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Update limitation failed' });
  }
});

trainingRouter.get('/coach-context', async (req, res) => {
  try {
    const userId = authedUserId(req);
    res.json(await loadCoachContext(userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Coach context failed' });
  }
});

trainingRouter.post('/coach/ask', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { message = '' } = req.body as { message?: string };

    const ctx = await loadCoachContext(userId);
    const smart = answerSmartCoachQuestion(message, ctx);
    res.json({
      response: smart ?? 'Ask about weight selection, last session, recovery, nutrition, or exercise substitutions.',
      contextUsed: true,
      recoveryScore: ctx.recovery.score,
    });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Coach ask failed' });
  }
});

trainingRouter.post('/coach/activate', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const result = await activateCoachSystem(userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Coach activation failed' });
  }
});

trainingRouter.post('/coach/post-workout', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) {
      res.status(400).json({ message: 'sessionId is required' });
      return;
    }
    res.json(await generatePostWorkoutCoachSummary(userId, sessionId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Post-workout coach failed' });
  }
});

trainingRouter.post('/programs/regenerate', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const result = await regenerateActiveProgram(userId, { force: Boolean((req.body as { force?: boolean }).force) });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Program regeneration failed' });
  }
});

trainingRouter.post('/programs/generate', async (req, res) => {
  try {
    const body: CreateProgramInput = { ...(req.body as CreateProgramInput), userId: authedUserId(req) };
    if (!body.programType || !body.frequency) {
      res.status(400).json({ message: 'programType and frequency are required' });
      return;
    }
    const result = await generateTrainingProgram(body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Program generation failed' });
  }
});

trainingRouter.get('/programs/dashboard', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const dashboard = await getProgramDashboard(userId);
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Program dashboard failed' });
  }
});

trainingRouter.get('/programs/planned', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    if (!from || !to) {
      res.status(400).json({ message: 'from and to query params are required' });
      return;
    }
    res.json(await getPlannedWorkoutsInRangeWithRefresh(userId, from, to));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Planned workouts failed' });
  }
});

trainingRouter.patch('/programs/planned/:id/reschedule', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { id } = req.params;
    const { scheduledDate } = req.body as { scheduledDate?: string };
    if (!scheduledDate) {
      res.status(400).json({ message: 'scheduledDate is required' });
      return;
    }
    res.json(await reschedulePlannedWorkout(id, scheduledDate, userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Reschedule failed' });
  }
});

trainingRouter.post('/plan/adapt', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { change } = req.body as {
      change?: {
        type?: string;
        workoutId?: string;
        toDate?: string;
        workoutIdA?: string;
        workoutIdB?: string;
        activity?: string;
      };
    };
    if (!change?.type) {
      res.status(400).json({ message: 'change.type is required' });
      return;
    }

    if (change.type === 'move') {
      if (!change.workoutId || !change.toDate) {
        res.status(400).json({ message: 'change.workoutId and change.toDate are required for move' });
        return;
      }
      res.json(await applyScheduleChange(userId, { type: 'move', workoutId: change.workoutId, toDate: change.toDate }));
      return;
    }

    if (change.type === 'swap') {
      if (!change.workoutIdA || !change.workoutIdB) {
        res.status(400).json({ message: 'change.workoutIdA and change.workoutIdB are required for swap' });
        return;
      }
      res.json(
        await applyScheduleChange(userId, {
          type: 'swap',
          workoutIdA: change.workoutIdA,
          workoutIdB: change.workoutIdB,
        }),
      );
      return;
    }

    if (change.type === 'skip') {
      if (!change.workoutId) {
        res.status(400).json({ message: 'change.workoutId is required for skip' });
        return;
      }
      res.json(await applyScheduleChange(userId, { type: 'skip', workoutId: change.workoutId }));
      return;
    }

    if (change.type === 'to_cardio') {
      if (!change.workoutId || !change.activity) {
        res.status(400).json({ message: 'change.workoutId and change.activity are required for to_cardio' });
        return;
      }
      const activity = change.activity as import('../lib/planAdaptationEngine.js').CardioActivity;
      res.json(
        await applyScheduleChange(userId, {
          type: 'to_cardio',
          workoutId: change.workoutId,
          activity,
        }),
      );
      return;
    }

    if (change.type === 'to_recovery') {
      if (!change.workoutId) {
        res.status(400).json({ message: 'change.workoutId is required for to_recovery' });
        return;
      }
      res.json(await applyScheduleChange(userId, { type: 'to_recovery', workoutId: change.workoutId }));
      return;
    }

    res.status(400).json({ message: `Unsupported change type: ${change.type}` });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Plan adaptation failed' });
  }
});

trainingRouter.post('/programs/adapt', async (req, res) => {
  try {
    const userId = authedUserId(req);
    res.json(await adaptActiveProgram(userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Program adaptation failed' });
  }
});

trainingRouter.post('/preferences/adapt', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { trigger } = req.body as { trigger?: 'equipment' | 'nutrition' | 'all' };
    res.json(await adaptToPreferenceChanges(userId, trigger ?? 'all'));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Preference adaptation failed' });
  }
});

trainingRouter.post('/coaching/exercise-prescription', requireProSubscription, async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { exerciseId, plan } = req.body as {
      exerciseId?: string;
      plan?: Record<string, unknown>;
    };
    if (!exerciseId) {
      res.status(400).json({ message: 'exerciseId is required' });
      return;
    }
    res.json(await loadExerciseCoachPrescription(userId, exerciseId, plan as Parameters<typeof loadExerciseCoachPrescription>[2]));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Exercise prescription failed' });
  }
});

trainingRouter.post('/coaching/workout-prescriptions', requireProSubscription, async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { exercises } = req.body as {
      exercises?: Parameters<typeof loadWorkoutExercisePrescriptions>[1];
    };
    if (!exercises?.length) {
      res.status(400).json({ message: 'exercises is required' });
      return;
    }
    res.json(await loadWorkoutExercisePrescriptions(userId, exercises));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Workout prescriptions failed' });
  }
});
