import { Router } from 'express';

import { adaptActiveProgram } from '../lib/adaptiveProgram.js';
import { assessRecovery, suggestMuscleGroups } from '../lib/aiCoach.js';
import { loadSmartProgression } from '../lib/loadSmartProgression.js';
import { loadRecoveryIntelligence } from '../lib/loadRecoveryIntelligence.js';
import { loadWorkoutRecommendations } from '../lib/loadWorkoutRecommendations.js';
import { activateCoachSystem } from '../lib/coachActivation.js';
import {
    answerSmartCoachQuestion,
    calculateRecoveryScore,
    loadCoachContext,
    mergeTrainingLoadScore,
} from '../lib/coachContext.js';
import { parseLimitationFromVoice } from '../lib/exerciseSubstitution.js';
import { generatePostWorkoutCoachSummary } from '../lib/postWorkoutCoach.js';
import {
    generateTrainingProgram,
    getPlannedWorkoutsInRange,
    getProgramDashboard,
    reschedulePlannedWorkout,
    type CreateProgramInput,
} from '../lib/programEngine.js';
import { requireAdmin } from '../lib/supabase.js';

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
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      res.status(400).json({ message: 'userId query param required' });
      return;
    }
    res.json(await suggestMuscleGroups(userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Suggest muscles failed' });
  }
});

trainingRouter.get('/recovery', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      res.status(400).json({ message: 'userId query param required' });
      return;
    }
    res.json(await assessRecovery(userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Recovery assessment failed' });
  }
});

trainingRouter.get('/recovery/today', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      res.status(400).json({ message: 'userId query param required' });
      return;
    }

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

trainingRouter.get('/recommendations/daily', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      res.status(400).json({ message: 'userId query param required' });
      return;
    }
    res.json(await loadWorkoutRecommendations(userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Workout recommendations failed' });
  }
});

trainingRouter.get('/recovery/intelligence', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      res.status(400).json({ message: 'userId query param required' });
      return;
    }
    res.json(await loadRecoveryIntelligence(userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Recovery intelligence failed' });
  }
});

trainingRouter.post('/progression/smart', async (req, res) => {
  try {
    const { userId, exerciseId, sessionId, currentSessionSets } = req.body as {
      userId?: string;
      exerciseId?: string;
      sessionId?: string;
      currentSessionSets?: Array<{ weightKg: number; reps: number; setNumber?: number; isFailure?: boolean }>;
    };

    if (!userId || !exerciseId) {
      res.status(400).json({ message: 'userId and exerciseId are required' });
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
    const userId = req.query.userId as string | undefined;
    const { exerciseId } = req.params;
    if (!userId) {
      res.status(400).json({ message: 'userId query param required' });
      return;
    }
    res.json(await loadSmartProgression(userId, exerciseId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Smart progression failed' });
  }
});

trainingRouter.get('/recovery/trend', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      res.status(400).json({ message: 'userId query param required' });
      return;
    }

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
    const {
      userId,
      sleepHours,
      sleepQuality,
      energyLevel,
      stressLevel,
      sorenessLevel,
    } = req.body as {
      userId?: string;
      sleepHours?: number;
      sleepQuality?: number;
      energyLevel?: number;
      stressLevel?: number;
      sorenessLevel?: number;
    };

    if (!userId) {
      res.status(400).json({ message: 'userId is required' });
      return;
    }

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
    const {
      userId,
      weightKg,
      waistCm,
      compliancePct,
      energyScore,
      sleepScore,
    } = req.body as {
      userId?: string;
      weightKg?: number;
      waistCm?: number;
      compliancePct?: number;
      energyScore?: number;
      sleepScore?: number;
    };

    if (!userId) {
      res.status(400).json({ message: 'userId is required' });
      return;
    }

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
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      res.status(400).json({ message: 'userId query param required' });
      return;
    }

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
    const userId = req.query.userId as string | undefined;
    const activeOnly = req.query.active !== 'false';
    if (!userId) {
      res.status(400).json({ message: 'userId query param required' });
      return;
    }

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
    const {
      userId,
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
      userId?: string;
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

    if (!userId) {
      res.status(400).json({ message: 'userId is required' });
      return;
    }

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

    const { data, error } = await db.from('training_limitations').update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Update limitation failed' });
  }
});

trainingRouter.get('/coach-context', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      res.status(400).json({ message: 'userId query param required' });
      return;
    }
    res.json(await loadCoachContext(userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Coach context failed' });
  }
});

trainingRouter.post('/coach/ask', async (req, res) => {
  try {
    const { userId, message = '' } = req.body as { userId?: string; message?: string };
    if (!userId) {
      res.status(400).json({ message: 'userId is required' });
      return;
    }

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
    const { userId } = req.body as { userId?: string };
    if (!userId) {
      res.status(400).json({ message: 'userId is required' });
      return;
    }
    const result = await activateCoachSystem(userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Coach activation failed' });
  }
});

trainingRouter.post('/coach/post-workout', async (req, res) => {
  try {
    const { userId, sessionId } = req.body as { userId?: string; sessionId?: string };
    if (!userId || !sessionId) {
      res.status(400).json({ message: 'userId and sessionId are required' });
      return;
    }
    res.json(await generatePostWorkoutCoachSummary(userId, sessionId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Post-workout coach failed' });
  }
});

trainingRouter.post('/programs/generate', async (req, res) => {
  try {
    const body = req.body as CreateProgramInput;
    if (!body.userId || !body.programType || !body.frequency) {
      res.status(400).json({ message: 'userId, programType, and frequency are required' });
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
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      res.status(400).json({ message: 'userId query param required' });
      return;
    }
    const dashboard = await getProgramDashboard(userId);
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Program dashboard failed' });
  }
});

trainingRouter.get('/programs/planned', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    if (!userId || !from || !to) {
      res.status(400).json({ message: 'userId, from, and to query params required' });
      return;
    }
    res.json(await getPlannedWorkoutsInRange(userId, from, to));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Planned workouts failed' });
  }
});

trainingRouter.patch('/programs/planned/:id/reschedule', async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate } = req.body as { scheduledDate?: string };
    if (!scheduledDate) {
      res.status(400).json({ message: 'scheduledDate is required' });
      return;
    }
    res.json(await reschedulePlannedWorkout(id, scheduledDate));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Reschedule failed' });
  }
});

trainingRouter.post('/programs/adapt', async (req, res) => {
  try {
    const { userId } = req.body as { userId?: string };
    if (!userId) {
      res.status(400).json({ message: 'userId is required' });
      return;
    }
    res.json(await adaptActiveProgram(userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Program adaptation failed' });
  }
});
