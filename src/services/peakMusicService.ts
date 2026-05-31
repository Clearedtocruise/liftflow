import { getMusicProvider } from '@/integrations/music/musicProviderRegistry';
import {
  buildContinuityPlan,
  buildDefaultWorkoutQueue,
  nextHypeTrack,
  selectTrackForSet,
} from '@/integrations/music/playlistContinuityEngine';
import { computePeakPlaybackPlan, shouldAutoSyncPeak } from '@/integrations/music/peakPlaybackEngine';
import { peakMomentStore } from '@/integrations/music/peakMomentStore';
import { playlistStateStore } from '@/integrations/music/playlistStateStore';
import { fail, ok, type ServiceResult } from '@/lib/serviceResult';
import type {
  MusicProviderId,
  PeakMoment,
  PeakMusicSettings,
  PeakMusicVoiceIntent,
  PeakPlaybackRequest,
  PlaybackSeekPlan,
  PlaylistContinuityPlan,
  WorkoutMusicQueue,
} from '@/types/peakMusic';
import { DEFAULT_PEAK_MUSIC_SETTINGS } from '@/types/peakMusic';

const settingsCache = new Map<string, PeakMusicSettings>();

export const peakMusicService = {
  getSettings(userId: string): PeakMusicSettings {
    return settingsCache.get(userId) ?? { ...DEFAULT_PEAK_MUSIC_SETTINGS };
  },

  updateSettings(userId: string, patch: Partial<PeakMusicSettings>): PeakMusicSettings {
    const next = { ...this.getSettings(userId), ...patch };
    settingsCache.set(userId, next);
    return next;
  },

  async savePeakMoment(
    userId: string,
    input: Omit<PeakMoment, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'storage'> & {
      storage?: PeakMoment['storage'];
    },
  ): Promise<ServiceResult<PeakMoment>> {
    try {
      const provider = getMusicProvider(input.provider);
      let finalStorage: PeakMoment['storage'] = 'local_only';
      if (provider.syncPeakToProvider) {
        finalStorage = await provider.syncPeakToProvider({
          ...input,
          id: peakMomentStore.buildId(userId, input.provider, input.trackId),
          userId,
          storage: 'local_only',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      const moment = await peakMomentStore.save({
        id: peakMomentStore.buildId(userId, input.provider, input.trackId),
        userId,
        storage: finalStorage,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...input,
      });
      return ok(moment);
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Failed to save peak moment');
    }
  },

  async getPeakMoment(
    userId: string,
    provider: MusicProviderId,
    trackId: string,
  ): Promise<ServiceResult<PeakMoment | null>> {
    try {
      return ok(await peakMomentStore.get(userId, provider, trackId));
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Failed to load peak moment');
    }
  },

  async getWorkoutQueue(userId: string, provider: MusicProviderId): Promise<WorkoutMusicQueue> {
    const stored = await playlistStateStore.getWorkoutQueue<WorkoutMusicQueue>(userId);
    if (stored) return stored;
    const queue = buildDefaultWorkoutQueue(userId, provider);
    await playlistStateStore.saveWorkoutQueue(queue);
    return queue;
  },

  planRestPeakSync(request: PeakPlaybackRequest, settings: PeakMusicSettings): PlaybackSeekPlan | null {
    if (!shouldAutoSyncPeak(settings, request.setContext)) return null;
    return computePeakPlaybackPlan(request.moment.peakOffsetMs, request.restDurationMs);
  },

  async planPlaylistContinuity(
    userId: string,
    request: PeakPlaybackRequest,
  ): Promise<ServiceResult<PlaylistContinuityPlan>> {
    const settings = this.getSettings(userId);
    const providerId = settings.activeProvider ?? request.moment.provider;
    const provider = getMusicProvider(providerId);

    let snapshot = await playlistStateStore.getSnapshot(userId);
    if (!snapshot && provider.capturePlaylistSnapshot) {
      snapshot = (await provider.capturePlaylistSnapshot()) ?? undefined;
      if (snapshot) await playlistStateStore.saveSnapshot(userId, snapshot);
    }

    const queue = await this.getWorkoutQueue(userId, providerId);
    const prTracks = queue.tracks.filter((t) => t.role === 'pr');
    const workoutTrack = selectTrackForSet(
      settings,
      request.setContext,
      queue.tracks,
      prTracks,
      {
        trackId: request.moment.trackId,
        name: request.moment.trackName,
        artist: request.moment.artistName,
        role: 'peak',
        peakOffsetMs: request.moment.peakOffsetMs,
      },
    );

    const plan = buildContinuityPlan(settings, request, snapshot ?? undefined, workoutTrack);
    return ok(plan);
  },

  async onRestStarted(
    userId: string,
    request: PeakPlaybackRequest,
  ): Promise<ServiceResult<{ plan: PlaylistContinuityPlan; started: boolean }>> {
    const settings = this.getSettings(userId);
    if (!settings.enabled) {
      return ok({
        plan: buildContinuityPlan(settings, request),
        started: false,
      });
    }

    const planResult = await this.planPlaylistContinuity(userId, request);
    if (!planResult.success) return fail(planResult.error);
    const continuity = planResult.data;

    const provider = getMusicProvider(settings.activeProvider ?? request.moment.provider);
    if (!(await provider.isConnected())) {
      return ok({ plan: continuity, started: false });
    }

    const track = continuity.workoutTrack ?? {
      trackId: request.moment.trackId,
      name: request.moment.trackName,
      artist: request.moment.artistName,
      role: 'peak' as const,
      peakOffsetMs: request.moment.peakOffsetMs,
    };

    const trackRef = {
      provider: provider.id,
      trackId: track.trackId,
      name: track.name,
      artist: track.artist,
    };

    const run = async () => {
      if (continuity.mode === 'workout_mode' && provider.setWorkoutQueue) {
        const queue = await this.getWorkoutQueue(userId, provider.id);
        await provider.setWorkoutQueue(queue.tracks, queue.currentIndex);
      }

      if (continuity.mode === 'continue_from_peak' && provider.playPeakAndContinue) {
        await provider.playPeakAndContinue(trackRef, continuity.peakPlan.seekToMs);
        return;
      }

      await provider.playAtOffset(trackRef, continuity.peakPlan.seekToMs);

      if (continuity.mode === 'return_to_playlist' && continuity.resumeAfterSetMs && continuity.snapshot) {
        setTimeout(async () => {
          await provider.restorePlaylistSnapshot?.(continuity.snapshot!);
        }, continuity.resumeAfterSetMs);
      }
    };

    if (continuity.peakPlan.startDelayMs > 0) {
      setTimeout(run, continuity.peakPlan.startDelayMs);
    } else {
      await run();
    }

    return ok({ plan: continuity, started: true });
  },

  async onSetCompleted(userId: string): Promise<ServiceResult<string>> {
    const settings = this.getSettings(userId);
    if (!settings.enabled || !settings.resumePreviousPlaylistAfterSet) {
      return ok('Set complete');
    }

    const snapshot = await playlistStateStore.getSnapshot(userId);
    if (!snapshot) return ok('No saved playlist');

    const provider = getMusicProvider(snapshot.provider);
    const restored = (await provider.restorePlaylistSnapshot?.(snapshot)) ?? false;
    if (restored) await playlistStateStore.clearSnapshot(userId);
    return ok(restored ? 'Playlist resumed' : 'Could not resume playlist — provider limitation');
  },

  async handleVoicePeakCommand(
    userId: string,
    intent: PeakMusicVoiceIntent,
    context: { restDurationMs?: number; trackId?: string; provider?: MusicProviderId },
  ): Promise<ServiceResult<string>> {
    const settings = this.getSettings(userId);
    if (!settings.enabled) return fail('Peak music sync is disabled in Settings');

    const providerId = context.provider ?? settings.activeProvider ?? 'spotify';

    switch (intent) {
      case 'resume_playlist': {
        const result = await this.onSetCompleted(userId);
        return result.success ? ok(result.data) : fail(result.error);
      }
      case 'use_pr_song': {
        const queue = await this.getWorkoutQueue(userId, providerId);
        const pr = queue.tracks.find((t) => t.role === 'pr');
        if (!pr) return fail('No PR song in workout queue');
        const provider = getMusicProvider(providerId);
        const started = await provider.playAtOffset(
          { provider: providerId, trackId: pr.trackId, name: pr.name, artist: pr.artist },
          pr.peakOffsetMs ?? 0,
        );
        return started ? ok(`Playing PR song: ${pr.name}`) : fail('Connect music provider');
      }
      case 'next_hype_song': {
        const queue = await this.getWorkoutQueue(userId, providerId);
        const next = nextHypeTrack(queue.tracks, queue.currentIndex);
        if (!next) return fail('No hype tracks in queue');
        queue.currentIndex = queue.tracks.indexOf(next);
        await playlistStateStore.saveWorkoutQueue(queue);
        const provider = getMusicProvider(providerId);
        const started = await provider.playAtOffset(
          { provider: providerId, trackId: next.trackId, name: next.name, artist: next.artist },
          next.peakOffsetMs ?? 0,
        );
        return started ? ok(`Next hype: ${next.name}`) : fail('Connect music provider');
      }
      case 'sync_music_next_set':
      case 'sync_next_set': {
        if (!context.restDurationMs) return fail('Start a rest timer first');
        const trackId = context.trackId ?? settings.defaultTrackId;
        if (!trackId) return fail('No track selected');
        const moment = await peakMomentStore.get(userId, providerId, trackId);
        if (!moment) return fail('No saved peak for this track');
        const plan = computePeakPlaybackPlan(moment.peakOffsetMs, context.restDurationMs);
        return ok(`Music synced — peak at rest end (${plan.seekToMs}ms seek)`);
      }
      case 'start_at_chorus':
      case 'play_peak':
      default: {
        const trackId = context.trackId ?? settings.defaultTrackId;
        if (!trackId) return fail('No track selected');
        const moment = await peakMomentStore.get(userId, providerId, trackId);
        if (!moment) return fail('No saved peak for this track');
        const provider = getMusicProvider(providerId);
        const started = await provider.playAtOffset(
          { provider: providerId, trackId, name: moment.trackName, artist: moment.artistName },
          moment.peakOffsetMs,
        );
        return started
          ? ok(`Playing ${moment.label ?? 'peak'} at ${Math.round(moment.peakOffsetMs / 1000)}s`)
          : fail('Connect your music provider');
      }
    }
  },
};
