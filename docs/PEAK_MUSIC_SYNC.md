# Peak Music Sync — Architecture & Feasibility

Sprint 7.X optional feature: synchronize user-defined song “peak moments” (chorus, drop, hype section) with rest timers so the peak hits when the next set begins.

**Out of scope (this sprint):** copyrighted audio analysis, waveform/chorus detection, community markers, AI peak detection.

---

## Goals

| # | Feature | Status |
|---|---------|--------|
| 1 | Save peak moment (timestamp by track ID) | Architecture + local store |
| 2 | Peak playback during rest → peak at set start | Engine implemented (SDK Phase 2) |
| 3 | Multi-provider abstraction | Implemented (stubs) |
| 4 | Voice commands | Patterns wired |
| 5 | Settings (enable, heavy/PR filters) | UI + service |
| 6 | Future: AI / community / intensity match | Documented only |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Workout Tab                                                  │
│  RestTimerSection ← restSecondsRemaining                    │
│  WorkoutSessionContext.startRestTimer()                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ onRestStarted (Phase 2 hook)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ peakMusicService                                             │
│  • shouldAutoSyncPeak(settings, setContext)                  │
│  • computePeakPlaybackPlan(peakMs, restMs)                   │
│  • onRestStarted → MusicProvider.playAtOffset()              │
└──────────────┬─────────────────────────────┬────────────────┘
               │                             │
               ▼                             ▼
┌──────────────────────────┐   ┌─────────────────────────────┐
│ peakMomentStore           │   │ musicProviderRegistry        │
│  AsyncStorage (local)     │   │  apple | spotify | amazon   │
│  + Supabase (013 migration)│   │  pandora | local            │
└──────────────────────────┘   └─────────────────────────────┘
```

### Peak timing math

When rest starts at `T₀` with duration `R` ms, next set at `T₀ + R`.

User saved peak at `P` ms into track. Start playback at:

- `seekTo = max(0, P - R)`
- If `P < R`: `startDelay = R - P`, seek to `0` (peak still aligns at rest end)

Implemented in `src/integrations/music/peakPlaybackEngine.ts`.

---

## Provider Abstraction

Interface: `src/integrations/music/MusicProvider.ts`

| Method | Purpose |
|--------|---------|
| `isConnected()` | OAuth / MusicKit linked |
| `getCurrentTrack()` | Detect now-playing for “save peak here” |
| `playAtOffset(track, ms)` | Seek + play |
| `pause()` | Stop during set |
| `syncPeakToProvider?()` | Optional cloud marker (rare) |

Registry: `src/integrations/music/musicProviderRegistry.ts`

---

## Provider Feasibility Matrix

| Provider | Playback API | Seek | Custom timestamp sync | Peak marker storage | Feasibility | Phase |
|----------|-------------|------|----------------------|---------------------|-------------|-------|
| **Apple Music** | MusicKit (iOS native) | Yes | No native marker API | **Local** + track ID | **High** | 2 |
| **Spotify** | Web API + App Remote | Yes (`position_ms`) | No | **Local** + Spotify URI | **High** | 2 |
| **Amazon Music** | Limited developer access | Unknown | No | **Local** only | **Low** | 3+ |
| **Pandora** | Station/thumb APIs | No in-track seek (most tiers) | No | **Local** by track ID when exposed | **Medium-Low** | 3 |
| **Local files** | expo-av / AVPlayer | Yes | App metadata | **Local** + file URI | **High** | 2 |

### Provider notes

**Apple Music** — Best fit for iOS-first LiftFlow. MusicKit provides playback control and seek. Users save peak while listening; app stores `{ trackId, peakOffsetMs }` locally. Requires Apple Developer MusicKit identifier + user subscription.

**Spotify** — Spotify Premium required for playback control. App Remote (iOS) or Web Playback SDK. OAuth PKCE flow. Peak markers remain local; Spotify has no “bookmark timestamp in song” API for third parties.

**Amazon Music** — No public playback SDK comparable to Spotify/Apple. Feasible paths: Alexa skill (indirect), or deep-link to Amazon app without seek guarantee. **Not recommended for v1.**

**Pandora** — API focuses on stations, playlists, thumbs. Tracks on radio may not expose stable seek or track boundaries. Store peaks locally when `trackToken`/`songId` available; playback may restart station rather than seek. Set expectations in UI.

---

## Data Model

### Local (AsyncStorage)

`PeakMoment`: `{ userId, provider, trackId, peakOffsetMs, label, storage, ... }`

Key: `userId:provider:trackId`

### Cloud (optional, migration 013)

Table `peak_music_moments` — sync across devices when user logs in. Provider still handles playback auth separately.

---

## Voice Commands

| Phrase | Intent | Action |
|--------|--------|--------|
| “Play the good part” | `play_peak` | Play from saved peak offset |
| “Start at the chorus” | `start_at_chorus` | Same (label alias) |
| “Sync with next set” | `sync_next_set` | Plan seek for active rest duration |
| “Use a PR song” | `use_pr_song` | Play PR role track from workout queue |
| “Resume playlist” | `resume_playlist` | Restore saved playlist snapshot |
| “Next hype song” | `next_hype_song` | Advance to next peak/PR track |
| “Sync music to next set” | `sync_music_next_set` | Align peak with rest timer end |

Parsed in `src/lib/voice/parseVoiceCommand.ts`. Workout handler: Phase 2 (call `peakMusicService.handleVoicePeakCommand`).

**Playlist continuity details:** [PLAYLIST_CONTINUITY.md](./PLAYLIST_CONTINUITY.md)

---

## Settings

`PeakMusicSettings`:

- `enabled` — master toggle
- `activeProvider` — linked service
- `playbackMode` — return to playlist | continue from peak | workout mode
- `resumePreviousPlaylistAfterSet` — restore snapshot after set
- `continueFromPeakSong` — keep playing peak track
- `autoSelectPeakForPr` — PR attempts use PR role tracks
- `syncMusicWithRestCompletion` — peak aligns with rest timer end
- `autoSyncHeavySetsOnly` — skip warm-up sets
- `autoSyncPrAttemptsOnly` — PR-focused sync

UI: `src/app/(features)/peak-music-settings.tsx`

---

## Integration Points (Phase 2)

1. **Rest timer hook** — In `WorkoutSessionContext.startRestTimer`, after timer starts:
   ```typescript
   peakMusicService.onRestStarted(userId, { moment, restDurationMs, setContext });
   ```
2. **Save peak UI** — Button on rest screen: “Save peak” captures `getCurrentTrack()` + elapsed position (manual scrub, not audio analysis).
3. **OAuth flows** — Per-provider connect screens in Settings.
4. **Native modules** — MusicKit, Spotify App Remote.

---

## Future Roadmap (not implemented)

| Feature | Approach | Legal/technical note |
|---------|----------|-------------------|
| AI peak detection | On-device energy envelope or licensed metadata API | **No copyrighted audio fingerprinting** without licenses |
| Community peaks | Crowdsourced `{ trackId, peakOffsetMs, votes }` in Supabase | User-generated timestamps only |
| Intensity matching | Map set RPE → BPM/energy bucket from provider metadata | Use public track features APIs where licensed |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Provider ToS / playback restrictions | Premium-only; use official SDKs only |
| Background audio + rest timer | iOS audio session category `playback`; test with silent mode |
| Pandora seek unavailable | Fallback: play station genre match, show “approximate sync” |
| No API running during Expo Go | Dev client + provider SDKs required |
| Copyright analysis | **Explicitly excluded** — user-marked timestamps only |

---

## File Map

| Path | Role |
|------|------|
| `src/types/peakMusic.ts` | Types |
| `src/integrations/music/MusicProvider.ts` | Interface |
| `src/integrations/music/providers/*` | Provider stubs |
| `src/integrations/music/musicProviderRegistry.ts` | Registry |
| `src/integrations/music/peakMomentStore.ts` | Local persistence |
| `src/integrations/music/peakPlaybackEngine.ts` | Timing math |
| `src/services/peakMusicService.ts` | Orchestration |
| `src/hooks/usePeakMusicSync.ts` | React hook |
| `src/app/(features)/peak-music-settings.tsx` | Settings UI |
| `supabase/migrations/013_peak_music_moments.sql` | Cloud sync schema |

---

## Feasibility Verdict

| Area | Verdict |
|------|---------|
| Architecture | **READY** — abstraction, storage, timing engine in place |
| Apple Music + Spotify v1 | **FEASIBLE** (Phase 2 SDK + OAuth) |
| Amazon Music | **NOT FEASIBLE** for precise peak sync near-term |
| Pandora | **PARTIAL** — local markers yes; precise seek unlikely |
| Voice + settings | **READY** (patterns + UI) |
| Rest timer integration | **READY TO WIRE** (one hook in session context) |
| AI / audio analysis | **DEFERRED** by design |

**Overall: PASS for architecture phase. FAIL for production playback until provider SDKs are integrated.**

Run validation: `node scripts/validate-sprint7x-peak-music.mjs`
