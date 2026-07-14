# ONE MORE — QA Testing

Repeatable pre-build QA for LiftFlow / ONE MORE.

## Environment check

```bash
npm run qa:env
```

## Maestro install (one-time)

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

## iOS simulator (if none listed)

1. Open **Xcode → Settings → Platforms**
2. Download an **iOS** simulator runtime
3. Create/boot a device: **Xcode → Window → Devices and Simulators**

## Physical device (recommended)

1. Install **dev client** or **TestFlight** build on iPhone
2. Sign in with a test account that has completed onboarding
3. Connect USB; Maestro will target the device when no simulator is booted

## Run tests

App must be installed (`com.liftflow.app`) and user **logged in**.

```bash
npm run qa:smoke
npm run qa:workout
npm run qa:nutrition
npm run qa:reset
npm run qa:all
```

If Maestro or simulator is missing, scripts print the reason and exit non-zero.

## Founder QA Checklist (fallback)

On founder account (`immadoer@gmail.com`):

**Settings → QA Checklist**

Mark PASS/FAIL/notes for the eight core flows and **Export Report** as text before each build.

## Pre-build gate

Do not submit TestFlight until:

1. `npm run qa:all` passes on simulator or device, **or**
2. Founder QA Checklist export shows all eight items PASS with device/build notes

## testIDs

Stable IDs live on tab bar, home, workout, nutrition, settings, and reset controls. See `.maestro/*.yaml` for usage.
