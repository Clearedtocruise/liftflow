import type { WatchHeartRateReading } from '@/integrations/watch/watchHealthArchitecture';

type HeartRateZone = 'rest' | 'fat_burn' | 'cardio' | 'peak';

const DEFAULT_MAX_HR = 190;

export function estimateMaxHeartRate(age?: number): number {
  if (age != null && age > 0) return Math.round(220 - age);
  return DEFAULT_MAX_HR;
}

export function classifyHeartRateZone(bpm: number, maxHr = DEFAULT_MAX_HR): HeartRateZone {
  const pct = bpm / maxHr;
  if (pct < 0.6) return 'rest';
  if (pct < 0.7) return 'fat_burn';
  if (pct < 0.85) return 'cardio';
  return 'peak';
}

export type HeartRateMonitorState = {
  currentBpm?: number;
  zone: HeartRateZone;
  samples: WatchHeartRateReading[];
  avgBpm?: number;
  maxBpm?: number;
};

export function createHeartRateMonitor(maxHr = DEFAULT_MAX_HR): {
  state: HeartRateMonitorState;
  push: (sample: WatchHeartRateReading) => HeartRateMonitorState;
  reset: () => HeartRateMonitorState;
} {
  let state: HeartRateMonitorState = { zone: 'rest', samples: [] };

  return {
    get state() {
      return state;
    },
    push(sample) {
      const samples = [...state.samples, sample].slice(-120);
      const bpms = samples.map((s) => s.bpm);
      const avg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
      state = {
        currentBpm: sample.bpm,
        zone: classifyHeartRateZone(sample.bpm, maxHr),
        samples,
        avgBpm: avg,
        maxBpm: Math.max(...bpms),
      };
      return state;
    },
    reset() {
      state = { zone: 'rest', samples: [] };
      return state;
    },
  };
}
