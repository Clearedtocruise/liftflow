import type {
    MusicProviderId,
    PeakMusicSettings,
    PeakPlaybackMode,
    PeakPlaybackRequest,
    PlaylistContinuityPlan,
    PlaylistSnapshot,
    WorkoutQueueTrack,
} from '@/types/peakMusic';
import { computePeakPlaybackPlan } from './peakPlaybackEngine';

export function resolvePlaybackMode(settings: PeakMusicSettings): PeakPlaybackMode {
  if (settings.playbackMode === 'workout_mode') return 'workout_mode';
  if (settings.continueFromPeakSong) return 'continue_from_peak';
  if (settings.resumePreviousPlaylistAfterSet) return 'return_to_playlist';
  return settings.playbackMode;
}

export function selectTrackForSet(
  settings: PeakMusicSettings,
  context: PeakPlaybackRequest['setContext'],
  workoutQueue: WorkoutQueueTrack[],
  prTracks: WorkoutQueueTrack[],
  defaultPeak?: WorkoutQueueTrack,
): WorkoutQueueTrack | undefined {
  if (settings.autoSelectPeakForPr && context?.isPrAttempt) {
    return prTracks[0] ?? workoutQueue.find((t) => t.role === 'pr') ?? defaultPeak;
  }
  if (context?.isHeavySet) {
    return workoutQueue.find((t) => t.role === 'peak') ?? defaultPeak;
  }
  return workoutQueue.find((t) => t.role === 'build_up') ?? defaultPeak;
}

export function buildContinuityPlan(
  settings: PeakMusicSettings,
  request: PeakPlaybackRequest,
  snapshot?: PlaylistSnapshot,
  workoutTrack?: WorkoutQueueTrack,
): PlaylistContinuityPlan {
  const mode = resolvePlaybackMode(settings);
  const peakOffsetMs = workoutTrack?.peakOffsetMs ?? request.moment.peakOffsetMs;
  const restMs = settings.syncMusicWithRestCompletion ? request.restDurationMs : request.restDurationMs;

  const peakPlan = computePeakPlaybackPlan(peakOffsetMs, restMs);

  return {
    mode,
    peakPlan,
    snapshot,
    workoutTrack,
    resumeAfterSetMs: mode === 'return_to_playlist' ? restMs : undefined,
    continueFromPeak: mode === 'continue_from_peak' || settings.continueFromPeakSong,
  };
}

export function nextHypeTrack(queue: WorkoutQueueTrack[], currentIndex: number): WorkoutQueueTrack | undefined {
  const hype = queue.filter((t) => t.role === 'peak' || t.role === 'pr');
  if (hype.length === 0) return queue[(currentIndex + 1) % Math.max(1, queue.length)];
  const idx = hype.findIndex((t) => queue.indexOf(t) > currentIndex);
  return idx >= 0 ? hype[idx] : hype[0];
}

export function buildDefaultWorkoutQueue(userId: string, provider: MusicProviderId): {
  id: string;
  userId: string;
  name: string;
  tracks: WorkoutQueueTrack[];
  currentIndex: number;
} {
  return {
    id: `${userId}-workout-queue`,
    userId,
    name: 'ONE MORE Workout Mode',
    currentIndex: 0,
    tracks: (
      [
        { trackId: 'rest-ambient', name: 'Rest — ambient', role: 'rest' as const, peakOffsetMs: 0 },
        { trackId: 'build-up', name: 'Build-up track', role: 'build_up' as const, peakOffsetMs: 45000 },
        { trackId: 'peak-track', name: 'Peak track', role: 'peak' as const, peakOffsetMs: 90000 },
        { trackId: 'pr-track', name: 'PR hype track', role: 'pr' as const, peakOffsetMs: 75000 },
      ] as const
    ).map((t) => ({ ...t, artist: 'Placeholder — assign in Workout Mode' })),
  };
}
