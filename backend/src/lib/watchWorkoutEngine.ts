/**
 * Server-side mirror of mobile watch workout logic (motion + voice).
 * Keep in sync with src/integrations/watch/*
 */

export type MotionSample = {
  recordedAt: number;
  accelerometer: { x: number; y: number; z: number };
  gyroscope?: { x: number; y: number; z: number };
};

type Profile = {
  id: string;
  displayName: string;
  aliases: string[];
  signalMode: 'magnitude' | 'axis_y' | 'axis_z';
  minPeakIntervalMs: number;
  maxPeakIntervalMs: number;
  peakProminence: number;
  baselineConfidence: number;
  targetRepsDefault: number;
};

const PROFILES: Profile[] = [
  p('bench_press', 'Bench Press', ['bench'], 'magnitude', 900, 4500, 1.35, 0.82),
  p('dumbbell_press', 'Dumbbell Press', ['db press'], 'magnitude', 900, 4500, 1.3, 0.78),
  p('bicep_curl', 'Bicep Curls', ['curl'], 'axis_y', 700, 3500, 1.25, 0.8),
  p('shoulder_press', 'Shoulder Press', ['ohp'], 'magnitude', 900, 4500, 1.35, 0.8),
  p('tricep_extension', 'Tricep Extensions', ['triceps'], 'axis_y', 700, 3200, 1.2, 0.74),
  p('squat', 'Squats', ['back squat'], 'axis_z', 1100, 5500, 1.4, 0.85),
  p('lunge', 'Lunges', ['walking lunge'], 'axis_z', 1000, 5000, 1.35, 0.76),
  p('leg_extension', 'Leg Extensions', [], 'axis_y', 800, 3800, 1.25, 0.77),
  p('leg_curl', 'Leg Curls', [], 'axis_y', 800, 3800, 1.25, 0.77),
  p('calf_raise', 'Calf Raises', [], 'axis_z', 600, 2800, 1.15, 0.75),
  p('row', 'Rows', ['barbell row'], 'magnitude', 900, 4500, 1.3, 0.81),
  p('lat_pulldown', 'Lat Pulldowns', ['pulldown'], 'magnitude', 900, 4200, 1.3, 0.79),
];

function p(
  id: string,
  displayName: string,
  aliases: string[],
  signalMode: Profile['signalMode'],
  minMs: number,
  maxMs: number,
  prominence: number,
  confidence: number,
): Profile {
  return {
    id,
    displayName,
    aliases: [displayName.toLowerCase(), ...aliases],
    signalMode,
    minPeakIntervalMs: minMs,
    maxPeakIntervalMs: maxMs,
    peakProminence: prominence,
    baselineConfidence: confidence,
    targetRepsDefault: 8,
  };
}

export function resolveProfile(name: string): Profile | null {
  const n = name.trim().toLowerCase();
  for (const profile of PROFILES) {
    if (profile.id === n || profile.displayName.toLowerCase() === n) return profile;
    if (profile.aliases.some((a) => n.includes(a))) return profile;
  }
  return null;
}

export function detectReps(samples: MotionSample[], profile: Profile) {
  if (samples.length < 15) {
    return { detectedReps: 0, confidence: 0, needsConfirmation: true };
  }
  const sorted = [...samples].sort((a, b) => a.recordedAt - b.recordedAt);
  const ts = sorted.map((s) => s.recordedAt);
  const signal = sorted.map((s) => {
    const { x, y, z } = s.accelerometer;
    if (profile.signalMode === 'axis_y') return Math.abs(y);
    if (profile.signalMode === 'axis_z') return Math.abs(z);
    return Math.sqrt(x * x + y * y + z * z);
  });

  const peaks: number[] = [];
  for (let i = 2; i < signal.length - 2; i++) {
    const window = signal.slice(Math.max(0, i - 12), i + 1);
    const mean = window.reduce((s, v) => s + v, 0) / window.length;
    const std = Math.sqrt(window.reduce((s, v) => s + (v - mean) ** 2, 0) / window.length) || 0.001;
    if (signal[i] > mean + profile.peakProminence * std && signal[i] > signal[i - 1] && signal[i] >= signal[i + 1]) {
      const last = peaks[peaks.length - 1];
      if (last !== undefined) {
        const dt = ts[i] - ts[last];
        if (dt < profile.minPeakIntervalMs || dt > profile.maxPeakIntervalMs) continue;
      }
      peaks.push(i);
    }
  }

  const confidence = Math.min(0.98, profile.baselineConfidence * (peaks.length > 0 ? 0.85 : 0.3));
  return {
    detectedReps: peaks.length,
    confidence,
    needsConfirmation: confidence < 0.55,
  };
}

export function parseWatchVoice(
  transcript: string,
  ctx: { currentRep?: number; targetReps?: number; targetSets?: number; setNumber?: number; exerciseName?: string; lastWeight?: number; lastReps?: number; suggestedWeight?: number },
) {
  const text = transcript.trim().toLowerCase();
  if (/what rep am i on|which rep|current rep/.test(text)) {
    const rep = ctx.currentRep ?? 0;
    return { spokenResponse: rep > 0 ? `You are on rep ${rep}.` : 'No reps counted yet.' };
  }
  if (/how many reps left|reps remaining/.test(text)) {
    const left = Math.max(0, (ctx.targetReps ?? 8) - (ctx.currentRep ?? 0));
    return { spokenResponse: `${left} reps remaining.` };
  }
  if (/how many sets left|sets remaining/.test(text)) {
    const left = Math.max(0, (ctx.targetSets ?? 3) - (ctx.setNumber ?? 1) + 1);
    return { spokenResponse: `${left} sets remaining for ${ctx.exerciseName ?? 'this exercise'}.` };
  }
  const correct = text.match(/correct(?:\s+to)?\s+rep\s+(\d+)/);
  if (correct) {
    return { spokenResponse: `Updated to rep ${correct[1]}.`, repCount: parseInt(correct[1], 10) };
  }
  if (/what weight did i do last|last workout weight/.test(text) && ctx.lastWeight && ctx.lastReps) {
    return { spokenResponse: `Last workout: ${ctx.lastWeight} pounds for ${ctx.lastReps} reps.` };
  }
  if (/what weight should i use|suggested weight/.test(text) && ctx.suggestedWeight) {
    return { spokenResponse: `Suggested weight is ${ctx.suggestedWeight} pounds for ${ctx.targetReps ?? 8} reps.` };
  }
  return null;
}

export function listSupportedExercises(): string[] {
  return PROFILES.map((p) => p.displayName);
}
