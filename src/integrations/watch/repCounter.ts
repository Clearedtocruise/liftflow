import { getConfidenceThreshold } from './exerciseMotionProfiles';
import type { ExerciseMotionProfile, RepDetectionResult, WatchMotionSample } from './types';

const ROLLING_WINDOW = 12;

function extractSignal(sample: WatchMotionSample, profile: ExerciseMotionProfile): number {
  const { x, y, z } = sample.accelerometer;
  switch (profile.signalMode) {
    case 'axis_y':
      return Math.abs(y);
    case 'axis_z':
      return Math.abs(z);
    case 'gyro_magnitude': {
      const g = sample.gyroscope;
      if (!g) return Math.sqrt(x * x + y * y + z * z);
      return Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
    }
    case 'magnitude':
    default:
      return Math.sqrt(x * x + y * y + z * z);
  }
}

function rollingStats(values: number[], index: number): { mean: number; std: number } {
  const start = Math.max(0, index - ROLLING_WINDOW);
  const slice = values.slice(start, index + 1);
  const mean = slice.reduce((s, v) => s + v, 0) / slice.length;
  const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length;
  return { mean, std: Math.sqrt(variance) || 0.001 };
}

function findPeaks(
  timestamps: number[],
  signal: number[],
  profile: ExerciseMotionProfile,
): { indices: number[]; intervalCv: number } {
  const peaks: number[] = [];
  const intervals: number[] = [];

  for (let i = 2; i < signal.length - 2; i++) {
    const { mean, std } = rollingStats(signal, i);
    const threshold = mean + profile.peakProminence * std;
    const isPeak =
      signal[i] > threshold &&
      signal[i] > signal[i - 1] &&
      signal[i] >= signal[i + 1];

    if (!isPeak) continue;

    const lastPeakIdx = peaks[peaks.length - 1];
    if (lastPeakIdx !== undefined) {
      const dt = timestamps[i] - timestamps[lastPeakIdx];
      if (dt < profile.minPeakIntervalMs) continue;
      if (dt > profile.maxPeakIntervalMs) continue;
      intervals.push(dt);
    }
    peaks.push(i);
  }

  let intervalCv = 1;
  if (intervals.length >= 2) {
    const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    const std = Math.sqrt(intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length);
    intervalCv = mean > 0 ? std / mean : 1;
  }

  return { indices: peaks, intervalCv };
}

/**
 * Count reps from a window of Watch motion samples using peak detection
 * matched to the exercise movement profile.
 */
export function detectRepsFromMotion(
  samples: WatchMotionSample[],
  profile: ExerciseMotionProfile,
): RepDetectionResult {
  if (samples.length < 15) {
    return {
      detectedReps: 0,
      confidence: 0,
      supported: true,
      needsConfirmation: true,
      reason: 'Not enough motion data yet — keep moving or confirm manually.',
    };
  }

  const sorted = [...samples].sort((a, b) => a.recordedAt - b.recordedAt);
  const timestamps = sorted.map((s) => s.recordedAt);
  const signal = sorted.map((s) => extractSignal(s, profile));

  const { indices: peakIndices, intervalCv } = findPeaks(timestamps, signal, profile);
  const detectedReps = peakIndices.length;

  const durationMs = timestamps[timestamps.length - 1] - timestamps[0];
  const repsPerMin = durationMs > 0 ? (detectedReps / durationMs) * 60000 : 0;
  const tempoScore = repsPerMin >= 4 && repsPerMin <= 40 ? 1 : 0.6;

  const regularityScore = Math.max(0, 1 - intervalCv * 2);
  const snr = signal.length > 0 ? Math.min(1, (Math.max(...signal) - Math.min(...signal)) / 2) : 0;

  let confidence =
    profile.baselineConfidence * 0.4 + regularityScore * 0.35 + tempoScore * 0.15 + Math.min(snr, 1) * 0.1;

  if (detectedReps === 0) confidence *= 0.4;
  confidence = Math.round(Math.min(0.98, Math.max(0, confidence)) * 1000) / 1000;

  const needsConfirmation = confidence < getConfidenceThreshold();

  return {
    detectedReps,
    confidence,
    supported: true,
    needsConfirmation,
    reason: needsConfirmation
      ? 'Motion confidence is low — confirm rep count or use voice.'
      : undefined,
  };
}

/** Generate synthetic motion for dev/simulator (one rep bump per call). */
export function synthesizeRepMotionBatch(
  profile: ExerciseMotionProfile,
  repIndex: number,
  sampleCount = 24,
): WatchMotionSample[] {
  const now = Date.now();
  const samples: WatchMotionSample[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = now - (sampleCount - i) * 40;
    const phase = (i / sampleCount) * Math.PI * 2;
    const peak = i > sampleCount * 0.4 && i < sampleCount * 0.55 ? 2.8 + repIndex * 0.02 : 1.0;
    samples.push({
      recordedAt: t,
      accelerometer: {
        x: 0.1 * Math.sin(phase),
        y: profile.signalMode === 'axis_y' ? peak * Math.sin(phase) : 0.2,
        z: profile.signalMode === 'axis_z' ? peak * Math.cos(phase) : 0.9 + 0.1 * Math.sin(phase),
      },
      gyroscope: { x: 0.05, y: 0.1, z: 0.05 },
    });
  }
  return samples;
}
