# Beta Known Issues — LiftFlow

**Last updated:** Sprint 8.5 beta readiness pack  
**Audience:** Closed beta testers (25–50 users)

## Platform limitations

| Issue | Impact | Workaround | Target fix |
|-------|--------|------------|------------|
| Expo Go | IAP, HealthKit, Watch, MusicKit unavailable | Use TestFlight / dev client build | Before beta invite |
| Watch companion | Requires paired Watch + native target | Use phone Apple Watch screen | Sprint 8.4+ native |
| Peak Music playback | Stubs until MusicKit OAuth | Voice + settings work; connect in dev client | Post-beta |
| Transformation API | 404 until migration + deploy | Apply migration 014 + deploy Render | Ops |

## Pro features

- Sandbox subscriptions may take 1–2 min to sync after purchase
- Free tier sees upgrade prompts on Pro surfaces (expected)

## Voice

- Noisy gyms may reduce recognition accuracy
- Peak music voice commands require Pro + enabled settings

## Reporting new issues

Settings → **Report a bug** (preferred) or support@liftflow.app

Include: steps to reproduce, screenshot, whether on TestFlight or Expo Go.
