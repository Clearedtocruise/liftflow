import { createStubProvider } from './createStubProvider';

export const appleMusicProvider = createStubProvider('apple_music', {
  id: 'apple_music',
  displayName: 'Apple Music',
  playbackControl: true,
  seekSupported: true,
  customTimestampSync: false,
  oauthAvailable: true,
  playlistSnapshot: true,
  queueInterruptResume: true,
  workoutQueueManaged: true,
  notes: 'MusicKit queue + setQueue. Strong playlist continuity via ApplicationMusicPlayer.',
});

export const spotifyProvider = createStubProvider('spotify', {
  id: 'spotify',
  displayName: 'Spotify',
  playbackControl: true,
  seekSupported: true,
  customTimestampSync: false,
  oauthAvailable: true,
  playlistSnapshot: true,
  queueInterruptResume: true,
  workoutQueueManaged: true,
  notes: 'App Remote context URI + playback state. Resume via transferPlayback.',
});

export const amazonMusicProvider = createStubProvider('amazon_music', {
  id: 'amazon_music',
  displayName: 'Amazon Music',
  playbackControl: false,
  seekSupported: false,
  customTimestampSync: false,
  oauthAvailable: false,
  playlistSnapshot: false,
  queueInterruptResume: false,
  workoutQueueManaged: false,
  notes: 'No public queue API — playlist continuity not feasible.',
});

export const pandoraProvider = createStubProvider('pandora', {
  id: 'pandora',
  displayName: 'Pandora',
  playbackControl: true,
  seekSupported: false,
  customTimestampSync: false,
  oauthAvailable: true,
  playlistSnapshot: false,
  queueInterruptResume: false,
  workoutQueueManaged: false,
  notes: 'Station model — no reliable playlist restore or in-track seek.',
});

export const localMusicProvider = createStubProvider('local', {
  id: 'local',
  displayName: 'On-device library',
  playbackControl: true,
  seekSupported: true,
  customTimestampSync: true,
  oauthAvailable: false,
  playlistSnapshot: true,
  queueInterruptResume: true,
  workoutQueueManaged: true,
  notes: 'Full queue control via AVQueuePlayer / expo-av.',
});
