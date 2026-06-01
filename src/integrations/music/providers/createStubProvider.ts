import type { MusicProvider } from '../MusicProvider';
import type { MusicTrackRef, PeakMoment, ProviderCapabilities } from '@/types/peakMusic';

export function createStubProvider(
  id: MusicProvider['id'],
  capabilities: ProviderCapabilities,
): MusicProvider {
  return {
    id,
    capabilities,
    async isConnected() {
      return false;
    },
    async getCurrentTrack(): Promise<MusicTrackRef | null> {
      return null;
    },
    async playAtOffset(_track, _offsetMs) {
      return false;
    },
    async pause() {},
    async syncPeakToProvider(_moment: PeakMoment) {
      return capabilities.customTimestampSync ? 'provider_sync' : 'local_only';
    },
    async capturePlaylistSnapshot() {
      return capabilities.playlistSnapshot
        ? {
            provider: id,
            contextType: 'queue',
            positionMs: 0,
            capturedAt: new Date().toISOString(),
          }
        : null;
    },
    async restorePlaylistSnapshot(_snapshot) {
      return capabilities.queueInterruptResume;
    },
    async playPeakAndContinue(_track, _offsetMs) {
      return capabilities.playbackControl && capabilities.seekSupported;
    },
    async setWorkoutQueue(_tracks, _startIndex) {
      return capabilities.workoutQueueManaged;
    },
  };
}
