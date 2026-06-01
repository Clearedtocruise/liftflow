/** Supported streaming providers (extensible via MusicProvider registry) */
export type MusicProviderId = 'apple_music' | 'spotify' | 'amazon_music' | 'pandora' | 'local';

export type PeakMarkerStorage = 'provider_sync' | 'local_only' | 'hybrid';

export type PeakPlaybackMode =
  | 'return_to_playlist'
  | 'continue_from_peak'
  | 'workout_mode';

export type WorkoutSongRole = 'rest' | 'build_up' | 'peak' | 'pr';

export type PlaylistSnapshot = {
  provider: MusicProviderId;
  /** Provider-specific queue/playlist/context ID */
  contextId?: string;
  contextType?: 'playlist' | 'album' | 'station' | 'queue' | 'library';
  trackIndex?: number;
  trackId?: string;
  positionMs: number;
  capturedAt: string;
};

export type WorkoutQueueTrack = {
  trackId: string;
  name: string;
  artist?: string;
  role: WorkoutSongRole;
  peakOffsetMs?: number;
  uri?: string;
};

export type WorkoutMusicQueue = {
  id: string;
  userId: string;
  name: string;
  tracks: WorkoutQueueTrack[];
  currentIndex: number;
};

export type PeakMusicSettings = {
  enabled: boolean;
  activeProvider?: MusicProviderId;
  playbackMode: PeakPlaybackMode;
  autoSyncHeavySetsOnly: boolean;
  autoSyncPrAttemptsOnly: boolean;
  /** Resume underlying playlist after peak/set (Return to Previous Playlist) */
  resumePreviousPlaylistAfterSet: boolean;
  /** Keep playing from peak track after section (Continue From Peak Song) */
  continueFromPeakSong: boolean;
  /** Pick peak-tagged tracks automatically on PR attempts */
  autoSelectPeakForPr: boolean;
  /** Align music start with rest timer end (next set) */
  syncMusicWithRestCompletion: boolean;
  defaultTrackId?: string;
};

export const DEFAULT_PEAK_MUSIC_SETTINGS: PeakMusicSettings = {
  enabled: false,
  playbackMode: 'return_to_playlist',
  autoSyncHeavySetsOnly: false,
  autoSyncPrAttemptsOnly: false,
  resumePreviousPlaylistAfterSet: true,
  continueFromPeakSong: false,
  autoSelectPeakForPr: true,
  syncMusicWithRestCompletion: true,
};

/** User-defined peak moment in a track — always keyed by provider track ID */
export type PeakMoment = {
  id: string;
  userId: string;
  provider: MusicProviderId;
  trackId: string;
  trackName: string;
  artistName?: string;
  /** Milliseconds from track start where the peak (chorus/drop) begins */
  peakOffsetMs: number;
  label?: string;
  /** Where the marker is persisted */
  storage: PeakMarkerStorage;
  albumArtUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type MusicTrackRef = {
  provider: MusicProviderId;
  trackId: string;
  name: string;
  artist?: string;
  durationMs?: number;
  uri?: string;
};

export type PlaybackSeekPlan = {
  seekToMs: number;
  startDelayMs: number;
  peakHitsAtRestEnd: boolean;
  restDurationMs: number;
  peakOffsetMs: number;
};

export type PeakPlaybackRequest = {
  moment: PeakMoment;
  restDurationMs: number;
  setContext?: {
    isHeavySet?: boolean;
    isPrAttempt?: boolean;
    exerciseName?: string;
  };
};

export type ProviderCapabilities = {
  id: MusicProviderId;
  displayName: string;
  playbackControl: boolean;
  seekSupported: boolean;
  customTimestampSync: boolean;
  oauthAvailable: boolean;
  /** Can capture and restore queue/playlist position */
  playlistSnapshot: boolean;
  /** Can inject a track and resume prior queue */
  queueInterruptResume: boolean;
  /** ONE MORE-managed multi-track workout queue */
  workoutQueueManaged: boolean;
  notes: string;
};

export type PeakMusicVoiceIntent =
  | 'play_peak'
  | 'start_at_chorus'
  | 'sync_next_set'
  | 'use_pr_song'
  | 'resume_playlist'
  | 'next_hype_song'
  | 'sync_music_next_set';

export type PlaylistContinuityPlan = {
  mode: PeakPlaybackMode;
  peakPlan: PlaybackSeekPlan;
  snapshot?: PlaylistSnapshot;
  workoutTrack?: WorkoutQueueTrack;
  resumeAfterSetMs?: number;
  continueFromPeak: boolean;
};
