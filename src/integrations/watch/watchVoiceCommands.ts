import type { WatchActiveSetState, WatchVoiceCommandResult } from './types';

export type WatchVoiceContext = {
  activeSet: WatchActiveSetState | null;
  lastWeightLbs?: number;
  lastReps?: number;
  suggestedWeightLbs?: number;
  suggestedReps?: string;
};

function matchInt(text: string, patterns: RegExp[]): number | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return parseInt(m[1], 10);
  }
  return null;
}

/**
 * Parse hands-free Watch voice commands (also used on phone during workouts).
 */
export function parseWatchVoiceCommand(transcript: string, ctx: WatchVoiceContext): WatchVoiceCommandResult | null {
  const text = transcript.trim().toLowerCase();
  if (!text) return null;

  const set = ctx.activeSet;

  if (/what rep am i on|which rep|current rep/.test(text)) {
    const rep = set?.currentRepCount ?? 0;
    return {
      intent: 'query_current_rep',
      spokenResponse: rep > 0 ? `You are on rep ${rep}.` : 'No reps counted yet for this set.',
    };
  }

  if (/how many reps left|reps remaining|reps left/.test(text)) {
    if (!set) {
      return { intent: 'query_reps_remaining', spokenResponse: 'No active set. Start an exercise first.' };
    }
    const left = Math.max(0, set.targetReps - set.currentRepCount);
    return {
      intent: 'query_reps_remaining',
      spokenResponse: left === 1 ? '1 rep remaining.' : `${left} reps remaining.`,
    };
  }

  if (/how many sets left|sets remaining|sets left/.test(text)) {
    if (!set) {
      return { intent: 'query_sets_remaining', spokenResponse: 'No active exercise.' };
    }
    const left = Math.max(0, set.targetSets - set.setNumber + 1);
    const name = set.exerciseName;
    return {
      intent: 'query_sets_remaining',
      spokenResponse:
        left === 0
          ? `No sets remaining for ${name}.`
          : left === 1
            ? `1 set remaining for ${name}.`
            : `${left} sets remaining for ${name}.`,
    };
  }

  const correctRep = matchInt(text, [
    /correct(?:\s+to)?\s+rep\s+(\d+)/,
    /set\s+rep(?:\s+count)?\s+to\s+(\d+)/,
    /change\s+rep\s+to\s+(\d+)/,
    /rep\s+(\d+)\s*$/,
  ]);
  if (correctRep !== null && /correct|set rep|change rep/.test(text)) {
    if (!set) {
      return { intent: 'correct_rep', spokenResponse: 'No active set to update.' };
    }
    return {
      intent: 'correct_rep',
      spokenResponse: `Updated to rep ${correctRep}.`,
      state: { currentRepCount: correctRep, needsConfirmation: false, motionConfidence: 1 },
    };
  }

  if (/what weight did i do last|last (?:time|workout) weight|previous weight/.test(text)) {
    if (ctx.lastWeightLbs && ctx.lastReps) {
      return {
        intent: 'query_last_weight',
        spokenResponse: `Last workout: ${ctx.lastWeightLbs} pounds for ${ctx.lastReps} reps.`,
      };
    }
    return {
      intent: 'query_last_weight',
      spokenResponse: 'No previous weight logged for this exercise.',
    };
  }

  if (/what weight should i use|suggested weight|recommend(?:ed)? weight/.test(text)) {
    if (ctx.suggestedWeightLbs) {
      const reps = ctx.suggestedReps ?? String(set?.targetReps ?? 8);
      return {
        intent: 'query_suggested_weight',
        spokenResponse: `Suggested weight is ${ctx.suggestedWeightLbs} pounds for ${reps} reps.`,
      };
    }
    return {
      intent: 'query_suggested_weight',
      spokenResponse: 'Start with a weight you can control for your target reps.',
    };
  }

  if (/complete set|finish set|done with set/.test(text)) {
    return {
      intent: 'complete_set',
      spokenResponse: 'Set complete. Logging now.',
      shouldLogSet: true,
    };
  }

  if (/start rest|rest timer/.test(text)) {
    return {
      intent: 'start_rest',
      spokenResponse: 'Rest timer started.',
      state: { phase: 'rest' },
    };
  }

  if (/skip rest/.test(text)) {
    return {
      intent: 'skip_rest',
      spokenResponse: 'Rest skipped.',
      state: { phase: 'active_set', restSecondsRemaining: 0 },
    };
  }

  const logReps = matchInt(text, [/(\d+)\s+reps?/, /for\s+(\d+)/]);
  const logWeight = matchInt(text, [/(\d+)\s*(?:lbs?|pounds?)/]);
  if (logReps !== null && (logWeight !== null || /bench|press|curl|squat|row/.test(text))) {
    return {
      intent: 'manual_log',
      spokenResponse: `Logged ${logWeight ?? set?.weightLbs ?? 0} pounds for ${logReps} reps.`,
      state: { currentRepCount: logReps, weightLbs: logWeight ?? set?.weightLbs },
      shouldLogSet: true,
    };
  }

  return null;
}
