# Peak Music — Provider Limitation Report

**Sprint 8.3 · LiftFlow Pro feature**

This document summarizes what each music provider supports in LiftFlow Peak Music Sync, and what requires a native dev client vs Expo Go.

## Summary

| Provider | OAuth | Seek / Peak | Playlist Snapshot | Resume Queue | Workout Queue | Sprint 8.3 Status |
|----------|-------|-------------|-------------------|--------------|---------------|-------------------|
| **Apple Music** | MusicKit (iOS dev client) | Yes | Yes | Yes | Partial | **Primary target** — adapter stub; OAuth pending EAS build |
| **Spotify** | App Remote + Web API | Yes | Partial | Partial | No | Stretch — stub only; no App Remote SDK wired |
| **Amazon Music** | No public API | No | No | No | No | **Not feasible v1** — stub for future |
| **Pandora** | Limited | Partial | No | No | No | Out of scope v1 |
| **Local (expo-av)** | N/A | Yes | N/A | N/A | Yes | Fallback for dev/testing |

## Playback Modes vs Providers

### 1. Return To Previous Playlist
- **Requires:** `capturePlaylistSnapshot` + `restorePlaylistSnapshot`
- **Apple Music:** Supported via MusicKit `ApplicationMusicPlayer` (dev client)
- **Spotify:** Partial — App Remote can pause/resume context; full queue restore is unreliable
- **Amazon Music:** Not supported — no developer playback API

### 2. Continue From Peak Song
- **Requires:** `playPeakAndContinue` or seek + continue
- **Apple Music:** Supported
- **Spotify:** Seek supported; continue depends on active session
- **Amazon Music:** Not supported

### 3. Workout Playlist Mode
- **Requires:** `setWorkoutQueue` with role-tagged tracks (rest, build-up, peak, PR)
- **Apple Music:** Queue injection limited; best-effort via library playback
- **Spotify:** No managed multi-track queue in App Remote v1
- **Local:** Full support for testing

## Feature Matrix

| Feature | Implementation | Provider dependency |
|---------|----------------|---------------------|
| Save Peak Moment | AsyncStorage + optional cloud sync | Any with seek |
| Peak Song Library | Settings UI + `peakMomentStore` | None |
| PR Song Tags | `WorkoutSongRole: 'pr'` in workout queue | Provider playback |
| Heavy Set Tags | Auto-sync filters in `peakPlaybackEngine` | None |
| Rest Timer Sync | `triggerRestPeakSync` on rest start | Connected provider |
| Voice commands | Wired in workout flow (Pro-gated) | Connected provider for playback |

## Voice Commands

| Phrase | Intent | Notes |
|--------|--------|-------|
| Play the good part | `play_peak` | Requires saved peak moment |
| Start at the chorus | `start_at_chorus` | Alias for play peak |
| Sync music to next set | `sync_music_next_set` | Requires active rest timer |
| Use a PR song | `use_pr_song` | Uses workout queue PR track |
| Resume playlist | `resume_playlist` | Restores snapshot |
| Next hype song | `next_hype_song` | Advances workout queue |

## Environment Requirements

- **Expo Go:** Voice parsing and settings work; **playback always fails** (no MusicKit / App Remote)
- **EAS iOS dev client:** Required for Apple Music OAuth and real peak playback
- **TestFlight:** Required for sandbox subscription + music entitlement testing

## Recommended Rollout

1. Ship architecture + voice + rest-timer wiring (Sprint 8.3 validator PASS)
2. EAS dev client + MusicKit entitlement
3. Replace `appleMusicProvider` stub with MusicKit adapter
4. Manual E2E: log set → rest → peak plays → set complete → playlist restores
5. Spotify stretch after Apple Music stable

See also: [PEAK_MUSIC_SYNC.md](./PEAK_MUSIC_SYNC.md), [PLAYLIST_CONTINUITY.md](./PLAYLIST_CONTINUITY.md)
