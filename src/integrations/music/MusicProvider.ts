import type {
  MusicProviderId,
  MusicTrackRef,
  PeakMoment,
  PlaylistSnapshot,
  ProviderCapabilities,
  WorkoutQueueTrack,
} from '@/types/peakMusic';

/** Provider abstraction — implement per streaming service */
export interface MusicProvider {
  readonly id: MusicProviderId;
  readonly capabilities: ProviderCapabilities;

  isConnected(): Promise<boolean>;
  getCurrentTrack(): Promise<MusicTrackRef | null>;
  playAtOffset(track: MusicTrackRef, offsetMs: number): Promise<boolean>;
  pause(): Promise<void>;
  syncPeakToProvider?(moment: PeakMoment): Promise<'provider_sync' | 'local_only'>;

  /** Capture current queue/playlist position before peak interrupt */
  capturePlaylistSnapshot?(): Promise<PlaylistSnapshot | null>;

  /** Restore saved playlist position after set completes */
  restorePlaylistSnapshot?(snapshot: PlaylistSnapshot): Promise<boolean>;

  /** Play peak then continue normal playback from that track (no restore) */
  playPeakAndContinue?(track: MusicTrackRef, offsetMs: number): Promise<boolean>;

  /** Replace or append LiftFlow workout queue */
  setWorkoutQueue?(tracks: WorkoutQueueTrack[], startIndex?: number): Promise<boolean>;
}

export type MusicProviderFactory = () => MusicProvider;
