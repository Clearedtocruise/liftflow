import { answerSmartCoachQuestion } from './coachContext.js';
import { classifyCoachTopic, saveCoachTurn, type CoachTopic } from './coachMemory.js';
import { getOpenAI, hasOpenAI } from './openai.js';
import {
  buildContextSnapshot,
  loadConversationalCoachContext,
  type ConversationalCoachContext,
} from './loadConversationalCoachContext.js';

export type CoachReferenceSource =
  | 'workout_history'
  | 'recovery'
  | 'nutrition'
  | 'goals'
  | 'progress_photos'
  | 'success_scores';

export type ConversationalCoachResponse = {
  id: string;
  assessedAt: string;
  topic: CoachTopic;
  shortAnswer: string;
  detailedAnswer: string;
  voiceLine: string;
  answer: string;
  referencesUsed: CoachReferenceSource[];
  suggestedFollowUps: string[];
  rationale: string;
  memorySummary: string;
  contextSnapshot: ReturnType<typeof buildContextSnapshot>;
};

const FOLLOW_UPS: Record<CoachTopic, string[]> = {
  train_today: ['Why am I fatigued?', 'How much should I lift?', 'What should I eat?'],
  stalled: ['What should I train today?', 'How much protein should I consume?', 'Why am I fatigued?'],
  lift_weight: ['What did I do last time?', 'Why am I stalled?', 'What should I train today?'],
  eat: ['How much protein should I consume?', 'What should I train today?', 'Why am I fatigued?'],
  fatigued: ['What should I train today?', 'How much protein should I consume?', 'Why am I stalled?'],
  protein: ['What should I eat?', 'Why am I fatigued?', 'What should I train today?'],
  general: ['What should I train today?', 'What should I eat?', 'Why am I stalled?'],
};

function refs(...sources: CoachReferenceSource[]): CoachReferenceSource[] {
  return [...new Set(sources)];
}

function answerTrainToday(ctx: ConversationalCoachContext): { short: string; detailed: string; voice: string; used: CoachReferenceSource[] } {
  const { today, context: recCtx } = ctx.workoutRecommendation;
  const used = refs('workout_history', 'recovery', 'goals');

  if (today.isRestDay) {
    const short = `Rest day — recovery score ${ctx.recovery.recoveryScore}. ${ctx.recovery.trainingRecommendationLabel}.`;
    const detailed = `${short} Your ${ctx.goals.primary.replace(/_/g, ' ')} goal supports recovery today. Success score: ${ctx.outcome.successScore?.overall_score ?? 'n/a'}. Avoid: ${ctx.recovery.avoidMuscleGroups.join(', ') || 'none'}.`;
    return { short, detailed, voice: short, used };
  }

  const muscles = today.targetMuscles.join(' & ') || 'full body';
  const short = `Train ${muscles} — ${today.sessionLabel ?? today.workout?.name ?? 'scheduled session'}. Recovery ${ctx.recovery.recoveryScore}.`;
  const why = today.whySelected.slice(0, 2).join(' ');
  const detailed = `${short} ${why} Adherence ${recCtx.adherencePct}%. Based on ${recCtx.workoutsLast7d} sessions in the last 7 days and your ${ctx.goals.primary.replace(/_/g, ' ')} goal.`;
  return { short, detailed, voice: `${short} ${today.whySelected[0] ?? ''}`.trim(), used };
}

function answerStalled(ctx: ConversationalCoachContext): { short: string; detailed: string; voice: string; used: CoachReferenceSource[] } {
  const used = refs('workout_history', 'recovery', 'nutrition', 'success_scores', 'progress_photos', 'goals');
  const score = ctx.outcome.successScore?.overall_score;
  const adherence = ctx.nutrition.context.adherencePct;
  const risks = ctx.outcome.activeRiskFlags ?? [];

  const factors: string[] = [];
  if (ctx.recovery.recoveryScore < 55) factors.push(`low recovery (${ctx.recovery.recoveryScore})`);
  if (adherence < 60) factors.push(`nutrition logging at ${adherence}%`);
  if ((ctx.recovery.factors.consecutiveTrainingDays ?? 0) >= 4) factors.push('high consecutive training days');
  if (score != null && Number(score) < 60) factors.push(`success score ${score}`);
  if (ctx.progressPhotos.totalCount === 0) factors.push('no progress photos for visual tracking');

  const short =
    factors.length > 0
      ? `Likely stall drivers: ${factors.slice(0, 2).join(' and ')}.`
      : 'Volume may have plateaued — consider a deload or rep-range change.';

  const riskNote = risks.length > 0 ? ` Active risk flags: ${risks.map((r) => r.flag_type).join(', ')}.` : '';
  const photoNote =
    ctx.progressPhotos.latestDate
      ? ` Latest progress photo: ${ctx.progressPhotos.latestDate} (${ctx.progressPhotos.latestAngle ?? 'photo'}).`
      : ' Log progress photos to compare visual changes.';

  const detailed = `${short}${riskNote} Goal: ${ctx.goals.primary.replace(/_/g, ' ')}. ${photoNote} Weekly volume: ${ctx.nutrition.context.trainingVolume7d}.`;
  return { short, detailed, voice: short, used };
}

function answerLiftWeight(ctx: ConversationalCoachContext): { short: string; detailed: string; voice: string; used: CoachReferenceSource[] } {
  const used = refs('workout_history', 'recovery', 'goals');
  const last = ctx.coachContext.lastPerformance[0];

  if (!last) {
    const short = 'No recent sets logged — start conservative and add weight when reps feel solid.';
    return { short, detailed: `${short} Your ${ctx.goals.primary.replace(/_/g, ' ')} goal favors controlled progression.`, voice: short, used };
  }

  const suggested = last.weight + 5;
  const short = `${last.exercise}: last ${last.weight} lb × ${last.reps}. Try ${suggested} lb if recovery is good.`;
  const detailed = `${short} Recovery score ${ctx.recovery.recoveryScore}. ${ctx.recovery.trainingRecommendation === 'rest_day' ? 'Consider keeping weight today due to fatigue.' : 'Progressive overload when you hit the top of your rep range.'}`;
  return { short, detailed, voice: short, used };
}

function answerEat(ctx: ConversationalCoachContext): { short: string; detailed: string; voice: string; used: CoachReferenceSource[] } {
  const used = refs('nutrition', 'recovery', 'goals', 'workout_history');
  const { macroTargets, mealSuggestions, coachingTips } = ctx.nutrition;
  const meals = mealSuggestions.slice(0, 2).map((m) => `${m.mealType}: ${m.name}`).join('. ');
  const tip = coachingTips[0]?.message ?? '';

  const short = `Target ${macroTargets.calories} kcal, ${macroTargets.proteinG}g protein. ${meals}.`;
  const detailed = `${short} ${tip} Goal: ${ctx.nutrition.context.goalLabel}. Recovery ${ctx.recovery.recoveryScore}. ${macroTargets.rationale}`;
  return { short, detailed, voice: ctx.nutrition.voiceEatTodayLine || short, used };
}

function answerFatigued(ctx: ConversationalCoachContext): { short: string; detailed: string; voice: string; used: CoachReferenceSource[] } {
  const used = refs('recovery', 'workout_history', 'nutrition', 'success_scores');
  const f = ctx.recovery.factors;
  const drivers: string[] = [];

  if (ctx.recovery.recoveryScore < 50) drivers.push(`recovery score ${ctx.recovery.recoveryScore}`);
  if (f.consecutiveTrainingDays >= 3) drivers.push(`${f.consecutiveTrainingDays} consecutive training days`);
  if (f.totalVolume3d > 50000) drivers.push('high 3-day training volume');
  if (f.sleepHours != null && f.sleepHours < 6) drivers.push(`sleep ${f.sleepHours}h`);
  if (ctx.nutrition.intakeToday.proteinG < ctx.nutrition.macroTargets.proteinG * 0.5) drivers.push('low protein intake today');

  const short =
    drivers.length > 0
      ? `Fatigue likely from ${drivers.slice(0, 2).join(' and ')}.`
      : `Recovery status: ${ctx.recovery.recoveryStatusLabel}. ${ctx.recovery.trainingRecommendationLabel}.`;

  const detailed = `${short} ${ctx.recovery.rationale} Success score: ${ctx.outcome.successScore?.overall_score ?? 'n/a'}. Consider ${ctx.recovery.trainingRecommendationLabel.toLowerCase()}.`;
  return { short, detailed, voice: short, used };
}

function answerProtein(ctx: ConversationalCoachContext): { short: string; detailed: string; voice: string; used: CoachReferenceSource[] } {
  const used = refs('nutrition', 'goals', 'recovery', 'workout_history');
  const target = ctx.nutrition.macroTargets.proteinG;
  const today = ctx.nutrition.intakeToday.proteinG;
  const remaining = Math.max(0, target - today);

  const short = `Target ${target}g protein daily (${remaining}g remaining today). Logged ${today}g so far.`;
  const detailed = `${short} ${ctx.nutrition.macroTargets.rationale} Recovery ${ctx.recovery.recoveryScore} — higher protein supports repair when fatigued.`;
  return { short, detailed, voice: short, used };
}

function answerGeneral(ctx: ConversationalCoachContext, message: string): { short: string; detailed: string; voice: string; used: CoachReferenceSource[] } {
  const heuristic = answerSmartCoachQuestion(message, ctx.coachContext);
  const used = refs('workout_history', 'recovery', 'nutrition', 'goals');

  if (heuristic) {
    return { short: heuristic, detailed: `${heuristic} Recovery ${ctx.recovery.recoveryScore}. Not medical advice.`, voice: heuristic, used };
  }

  const short = `Recovery ${ctx.recovery.recoveryScore} · ${ctx.recovery.trainingRecommendationLabel}. Protein target ${ctx.nutrition.macroTargets.proteinG}g.`;
  const detailed = `${short} ${ctx.workoutRecommendation.voiceTrainTodayLine}`;
  return { short, detailed, voice: short, used };
}

function buildAnswer(topic: CoachTopic, ctx: ConversationalCoachContext, message: string) {
  switch (topic) {
    case 'train_today':
      return answerTrainToday(ctx);
    case 'stalled':
      return answerStalled(ctx);
    case 'lift_weight':
      return answerLiftWeight(ctx);
    case 'eat':
      return answerEat(ctx);
    case 'fatigued':
      return answerFatigued(ctx);
    case 'protein':
      return answerProtein(ctx);
    default:
      return answerGeneral(ctx, message);
  }
}

function pickAnswer(
  detailLevel: 'short' | 'detailed' | 'voice',
  short: string,
  detailed: string,
  voice: string,
): string {
  if (detailLevel === 'short') return short;
  if (detailLevel === 'voice') return voice;
  return detailed;
}

export async function converseWithCoach(
  userId: string,
  message: string,
  options: {
    context?: string;
    includeHistory?: boolean;
    detailLevel?: 'short' | 'detailed' | 'voice';
  } = {},
): Promise<ConversationalCoachResponse> {
  const ctx = await loadConversationalCoachContext(userId);
  const topic = classifyCoachTopic(message);
  let { short, detailed, voice, used } = buildAnswer(topic, ctx, message);

  if (topic === 'general' && hasOpenAI()) {
    const snapshot = buildContextSnapshot(ctx);
    const openai = getOpenAI()!;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are LiftFlow Coach. Give evidence-based fitness coaching using the user context. Provide a concise shortAnswer (1-2 sentences) and detailedAnswer (3-5 sentences). Never diagnose medical conditions.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            question: message,
            context: snapshot,
            memory: options.includeHistory !== false ? ctx.memory.summary : undefined,
            heuristicHint: short,
          }),
        },
      ],
      response_format: { type: 'json_object' },
    });

    try {
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as {
        shortAnswer?: string;
        detailedAnswer?: string;
      };
      if (parsed.shortAnswer) short = parsed.shortAnswer;
      if (parsed.detailedAnswer) detailed = parsed.detailedAnswer;
      voice = short;
    } catch {
      // keep heuristic
    }
  }

  const detailLevel = options.detailLevel ?? 'detailed';
  const answer = pickAnswer(detailLevel, short, detailed, voice);
  const contextSnapshot = buildContextSnapshot(ctx);

  let id: string;
  try {
    id = await saveCoachTurn(userId, {
      message,
      topic,
      shortAnswer: short,
      detailedAnswer: detailed,
      voiceLine: voice,
      referencesUsed: used,
      context: options.context ?? 'general',
      modelVersion: topic === 'general' && hasOpenAI() ? 'gpt-4o-mini-conversational' : 'conversational-coach-v1',
    });
  } catch {
    // Validation and orphaned user IDs should not block coaching responses.
    id = `ephemeral-${Date.now()}`;
  }

  return {
    id,
    assessedAt: new Date().toISOString(),
    topic,
    shortAnswer: short,
    detailedAnswer: detailed,
    voiceLine: voice,
    answer,
    referencesUsed: used,
    suggestedFollowUps: FOLLOW_UPS[topic],
    rationale: `Answered from ${used.join(', ')}.`,
    memorySummary: ctx.memory.summary,
    contextSnapshot,
  };
}

export async function loadConversationalCoachHistory(userId: string, limit = 20) {
  const ctx = await loadConversationalCoachContext(userId);
  return {
    turns: ctx.memory.recentTurns.slice(0, limit),
    summary: ctx.memory.summary,
    suggestedQuestions: FOLLOW_UPS.general,
  };
}

export { classifyCoachTopic, FOLLOW_UPS };
