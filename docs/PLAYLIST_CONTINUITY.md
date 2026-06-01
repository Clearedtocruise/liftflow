# Playlist Continuity — Architecture & Feasibility

Enhancement to [Peak Music Sync](./PEAK_MUSIC_SYNC.md): manage what happens to the user's music **before, during, and after** peak playback across rest timers and sets.

**No copyrighted audio analysis.** User-defined peaks and playlist state only.

---

## Playback Modes

### 1. Return to Previous Playlist

**Flow:** Capture snapshot → play peak during rest → restore snapshot after set.

```
[User playlist @ 2:34 of Track 5]
        │ capturePlaylistSnapshot()
        ▼
[Play peak track @ seekTo for rest duration]
        │ onSetCompleted() / timer
        ▼
[Restore playlist @ 2:34 of Track 5]
```

**Settings:** `resumePreviousPlaylistAfterSet`, `playbackMode: return_to_playlist`

### 2. Continue From Peak Song

**Flow:** Play peak section → continue normal playback from that track (no restore).

```
[Play peak @ seekTo]
        ▼
[Track continues from peak position through chorus/drop]
```

**Settings:** `continueFromPeakSong`, `playbackMode: continue_from_peak`

### 3. Workout Mode Playlist

**Flow:** LiftFlow manages a role-based queue:

| Role | Purpose |
|------|---------|
| `rest` | Low-energy between sets |
| `build_up` | Ramp before working sets |
| `peak` | Chorus/drop sync for heavy sets |
| `pr` | Maximum hype for PR attempts |

**Settings:** `playbackMode: workout_mode`, `autoSelectPeakForPr`

---

## Architecture

```
peakMusicService.onRestStarted()
    → planPlaylistContinuity()
        → capture snapshot (if return mode)
        → selectTrackForSet() (PR / heavy / build-up)
        → buildContinuityPlan()
    → provider.playAtOffset | playPeakAndContinue | setWorkoutQueue
    → schedule restorePlaylistSnapshot after rest (return mode)

peakMusicService.onSetCompleted()
    → restorePlaylistSnapshot (if enabled)
```

**New modules:**

| File | Role |
|------|------|
| `playlistContinuityEngine.ts` | Mode resolution, track selection, continuity plan |
| `playlistStateStore.ts` | AsyncStorage for snapshots + workout queue |
| Extended `MusicProvider` | `capturePlaylistSnapshot`, `restorePlaylistSnapshot`, `playPeakAndContinue`, `setWorkoutQueue` |

---

## Additional Settings

| Setting | Default | Purpose |
|---------|---------|---------|
| `resumePreviousPlaylistAfterSet` | true | Return-to-playlist behavior |
| `continueFromPeakSong` | false | Keep playing peak track after section |
| `autoSelectPeakForPr` | true | Auto-pick `pr` role tracks on PR attempts |
| `syncMusicWithRestCompletion` | true | Peak aligns with rest timer end |

---

## Voice Commands

| Phrase | Intent |
|--------|--------|
| Play the good part | `play_peak` |
| Start at the chorus | `start_at_chorus` |
| Sync with next set / Sync music to next set | `sync_music_next_set` |
| Use a PR song | `use_pr_song` |
| Resume playlist | `resume_playlist` |
| Next hype song | `next_hype_song` |

---

## Provider Feasibility — Playlist Continuity

### Summary matrix

| Provider | Return to Playlist | Continue From Peak | Workout Mode Queue | Overall |
|----------|-------------------|--------------------|--------------------|---------|
| **Apple Music** | **High** | **High** | **High** | **Recommended** |
| **Spotify** | **High** | **High** | **Medium-High** | **Recommended** |
| **Amazon Music** | **Not feasible** | **Not feasible** | **Not feasible** | **Skip** |
| **Pandora** | **Low** | **Low** | **Low** | **Limited** |
| **Local library** | **High** | **High** | **High** | **Dev/testing** |

---

### Apple Music

| Capability | Support | Notes |
|------------|---------|-------|
| Playlist snapshot | Yes | `ApplicationMusicPlayer.queue` + `currentEntry` |
| Restore position | Yes | Re-set queue with saved entries + `playbackTime` |
| Continue from peak | Yes | Seek then leave player running |
| Workout queue | Yes | `MusicPlayer.Queue` with ordered entries |
| Seek | Yes | `playbackTime` property |
| Limitations | Subscription required; background audio session; no cross-device queue sync in API |

**Verdict:** Best platform for all three modes.

---

### Spotify

| Capability | Support | Notes |
|------------|---------|-------|
| Playlist snapshot | Yes | App Remote `PlayerState` (track URI, position ms, context URI) |
| Restore position | Yes | `connect()` + `play(uri, { offset: { position } })` on saved context |
| Continue from peak | Yes | Play track URI at offset; no restore call |
| Workout queue | Partial | Web API can add to queue; App Remote limited to single context — may need playlist URI workaround |
| Seek | Yes | Premium required |
| Limitations | Premium only for playback control; Spotify ToS restricts queue manipulation; background limitations on iOS |

**Verdict:** Strong for modes 1 & 2; mode 3 needs curated Spotify playlist + context URI rather than dynamic queue.

---

### Amazon Music

| Capability | Support | Notes |
|------------|---------|-------|
| Playlist snapshot | No | No public playback/state API |
| Restore position | No | — |
| Continue from peak | No | — |
| Workout queue | No | — |

**Verdict:** **Not feasible** for playlist continuity. Deep links only; no guaranteed seek or restore.

---

### Pandora

| Capability | Support | Notes |
|------------|---------|-------|
| Playlist snapshot | No | Station-based; no stable “playlist position” |
| Restore position | No | Switching songs changes station context |
| Continue from peak | Partial | May restart station track; no in-track seek on most tiers |
| Workout queue | No | API focuses on stations/thumbs, not ordered workout queues |
| Seek | No | Radio model |

**Verdict:** **Low feasibility.** Users can thumb-up hype stations; LiftFlow stores local peak markers when track ID is exposed, but cannot reliably restore prior station state or seek to chorus.

---

### Local / on-device

| Capability | Support | Notes |
|------------|---------|-------|
| All modes | Yes | `AVQueuePlayer` full control |
| Limitations | Not streaming catalog; user must own files |

---

## Mode × Provider Compatibility

| Mode | Apple | Spotify | Amazon | Pandora | Local |
|------|-------|---------|--------|---------|-------|
| Return to Previous Playlist | ✅ | ✅ | ❌ | ⚠️ | ✅ |
| Continue From Peak Song | ✅ | ✅ | ❌ | ⚠️ | ✅ |
| Workout Mode Playlist | ✅ | ⚠️ | ❌ | ❌ | ✅ |

✅ Supported · ⚠️ Partial/degraded · ❌ Not supported

---

## Implementation Phases

| Phase | Scope |
|-------|--------|
| **7.X (current)** | Types, engines, stubs, settings, voice patterns, feasibility doc |
| **Phase 2a** | Apple Music MusicKit — modes 1 & 2 |
| **Phase 2b** | Spotify App Remote — modes 1 & 2 |
| **Phase 2c** | Workout Mode curated playlists (Spotify playlist URI + Apple queue) |
| **Phase 3** | Pandora station presets (no seek restore) |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Spotify queue API limits | Pre-built “LiftFlow Workout” playlist per user |
| Apple background suspend | `UIBackgroundModes: audio` + audio session |
| Pandora station drift | UI disclaimer; local peak markers only |
| Race: restore before set done | Tie restore to `onSetCompleted` + user setting |

---

## Validation

```bash
node scripts/validate-sprint7x-peak-music.mjs
node scripts/test-playlist-continuity.mjs
```

---

## Verdict

| Item | Status |
|------|--------|
| Architecture | **READY** |
| Apple Music continuity | **FEASIBLE** |
| Spotify continuity | **FEASIBLE** (modes 1–2 strong, mode 3 partial) |
| Amazon Music | **NOT FEASIBLE** |
| Pandora | **LIMITED** (local markers only) |
| Production SDK | **Phase 2** |
