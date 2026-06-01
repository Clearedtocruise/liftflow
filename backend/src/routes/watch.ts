import { Router } from 'express';

import { requireAdmin } from '../lib/supabase.js';
import { detectReps, listSupportedExercises, parseWatchVoice, resolveProfile } from '../lib/watchWorkoutEngine.js';
import { requireUser, type AuthedRequest } from '../middleware/authUser.js';

export const watchRouter = Router();

watchRouter.get('/supported-exercises', (_req, res) => {
  res.json({ exercises: listSupportedExercises() });
});

watchRouter.post('/motion', requireUser, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const { exerciseName, samples } = req.body as {
      exerciseName?: string;
      samples?: { recordedAt: number; accelerometer: { x: number; y: number; z: number }; gyroscope?: { x: number; y: number; z: number } }[];
    };

    if (!exerciseName?.trim() || !samples?.length) {
      res.status(400).json({ message: 'exerciseName and samples are required' });
      return;
    }

    const profile = resolveProfile(exerciseName);
    if (!profile) {
      res.json({
        supported: false,
        detectedReps: 0,
        confidence: 0,
        needsConfirmation: true,
        spokenPrompt: 'This exercise is not motion-tracked. Use voice or manual entry.',
      });
      return;
    }

    const result = detectReps(samples, profile);
    const db = requireAdmin();

    await db.from('motion_samples').insert(
      samples.slice(-20).map((s) => ({
        user_id: userId,
        recorded_at: new Date(s.recordedAt).toISOString(),
        accelerometer: s.accelerometer,
        gyroscope: s.gyroscope ?? null,
        movement_category: 'other',
        metadata: { exerciseProfileId: profile.id, source: 'apple_watch_api' },
      })),
    );

    res.json({
      supported: true,
      exerciseProfileId: profile.id,
      ...result,
      spokenPrompt: result.needsConfirmation
        ? `Counted ${result.detectedReps} reps with low confidence. Please confirm.`
        : result.detectedReps > 0
          ? `Rep ${result.detectedReps}.`
          : undefined,
    });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Motion processing failed' });
  }
});

watchRouter.post('/voice', requireUser, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const { transcript, exerciseId, exerciseName, currentRep, targetReps, targetSets, setNumber } = req.body as {
      transcript?: string;
      exerciseId?: string;
      exerciseName?: string;
      currentRep?: number;
      targetReps?: number;
      targetSets?: number;
      setNumber?: number;
    };

    if (!transcript?.trim()) {
      res.status(400).json({ message: 'transcript is required' });
      return;
    }

    let lastWeight: number | undefined;
    let lastReps: number | undefined;
    let suggestedWeight: number | undefined;

    if (exerciseId) {
      const db = requireAdmin();
      const { data } = await db
        .from('workout_sets')
        .select('weight, reps, workout_exercises!inner(exercise_id, workout_sessions!inner(user_id, status))')
        .eq('workout_exercises.exercise_id', exerciseId)
        .eq('workout_exercises.workout_sessions.user_id', userId)
        .eq('workout_exercises.workout_sessions.status', 'completed')
        .order('logged_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        lastWeight = Number(data.weight ?? 0) || undefined;
        lastReps = Number(data.reps ?? 0) || undefined;
        if (lastWeight && lastReps && lastReps >= (targetReps ?? 8)) {
          suggestedWeight = lastWeight + 5;
        } else {
          suggestedWeight = lastWeight;
        }
      }
    }

    const parsed = parseWatchVoice(transcript, {
      currentRep,
      targetReps,
      targetSets,
      setNumber,
      exerciseName,
      lastWeight,
      lastReps,
      suggestedWeight,
    });

    if (!parsed) {
      res.status(422).json({
        message: 'Could not parse watch command',
        hint: 'Try "What rep am I on?" or "Correct to rep 8."',
      });
      return;
    }

    res.json(parsed);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Voice command failed' });
  }
});
