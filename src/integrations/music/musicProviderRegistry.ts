import type { MusicProviderId, ProviderCapabilities } from '@/types/peakMusic';
import type { MusicProvider } from './MusicProvider';
import {
    amazonMusicProvider,
    appleMusicProvider,
    localMusicProvider,
    pandoraProvider,
    spotifyProvider,
} from './providers/index';

const REGISTRY: Record<MusicProviderId, MusicProvider> = {
  apple_music: appleMusicProvider,
  spotify: spotifyProvider,
  amazon_music: amazonMusicProvider,
  pandora: pandoraProvider,
  local: localMusicProvider,
};

export function getMusicProvider(id: MusicProviderId): MusicProvider {
  return REGISTRY[id];
}

export function listMusicProviders(): MusicProvider[] {
  return Object.values(REGISTRY);
}

export function listProviderCapabilities(): ProviderCapabilities[] {
  return listMusicProviders().map((p) => p.capabilities);
}

export function providersWithPlaybackControl(): MusicProvider[] {
  return listMusicProviders().filter((p) => p.capabilities.playbackControl);
}
