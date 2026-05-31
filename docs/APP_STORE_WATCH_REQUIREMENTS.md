# App Store Requirements — Apple Watch Companion

**Sprint 8.4 · LiftFlow Pro**

## App Store Connect

1. **Primary category:** Health & Fitness
2. **Watch companion:** Declare watchOS app when native target ships (companion-only in v1)
3. **Privacy nutrition labels:** Health data collected (fitness, heart rate, sleep) — linked to user, not used for tracking
4. **App Review notes:** Provide demo account with Pro subscription for Watch + HealthKit features

## Entitlements (iOS + watchOS)

| Entitlement | Required for |
|-------------|--------------|
| HealthKit | HR, HRV, sleep, steps sync |
| MusicKit | Peak Music Sync (Sprint 8.3) — separate from Watch |
| WatchKit / WatchConnectivity | Phone ↔ Watch messaging |
| Background modes | Optional: `workout-processing`, HealthKit background delivery |

## TestFlight

- Pro features (Watch assistant, HealthKit, Peak Music) require sandbox subscription or `grantSandboxPro` in dev
- Watch companion requires **paired physical Watch** — Simulator limited
- Document known limitation: Expo Go cannot test WatchConnectivity or HealthKit

## Review demo script

1. Sign in with review account (Pro active)
2. Start workout on iPhone
3. Open Apple Watch screen — verify rest timer + recovery score
4. Voice: “Log set”, “How recovered am I?”
5. HealthKit: Settings → sync steps + sleep
6. Peak Music: Settings → enable peak sync (architecture demo if no MusicKit)

## Binary requirements

- iOS 17+ recommended
- watchOS 10+ for companion target
- EAS build with development client for full Watch + HealthKit QA

See also: [WATCH_ARCHITECTURE.md](./WATCH_ARCHITECTURE.md), [WATCH_NATIVE.md](./WATCH_NATIVE.md)
