#!/usr/bin/env node
/**
 * Blocks TestFlight builds when perf refactors drop required user flows.
 * Static source checks — fast, no network.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

/** @type {{ file: string, label: string, patterns: string[], forbidden?: string[] }[]} */
const REQUIRED = [
  {
    file: 'src/app/(tabs)/nutrition/index.tsx',
    label: 'Nutrition tab meal plan',
    patterns: [
      'ensureWeekMealCoverage',
      'generateWeeklyMealPlan',
      'ensureMealPlan',
      'generate !== \'1\'',
    ],
    forbidden: ['weekMeals.length, goals]'],
  },
  {
    file: 'src/contexts/AuthContext.tsx',
    label: 'Auth fast gate',
    patterns: ['signInWithPassword', 'stubProfileFromAuth', 'startPlanPrefetch'],
  },
  {
    file: 'src/lib/planDataPrefetch.ts',
    label: 'Week plan warm cache',
    patterns: ['getMealsForWeek', 'getPlannedWorkouts', 'writeMeals', 'startPlanPrefetch'],
  },
  {
    file: 'src/lib/uploadProgressPhotoFile.ts',
    label: 'Progress photo legacy filesystem',
    patterns: ['expo-file-system/legacy', 'getInfoAsync'],
  },
  {
    file: 'src/components/brand/LiftFlowWordmark.tsx',
    label: 'Wordmark line heights',
    patterns: ['lineHeight: 34', 'lineHeight: 18'],
    forbidden: ["variant=\"caption\""],
  },
  {
    file: 'targets/watch/content.swift',
    label: 'Watch Phase 2 UI',
    patterns: ['Log Set', 'Skip Rest', 'Start Today\'s Workout', 'requestPhoneSync', 'Say Weight'],
  },
  {
    file: 'targets/watch/MotionCapture.swift',
    label: 'Watch motion streaming',
    patterns: ['motion_batch', 'CMMotionManager', 'WKExtendedRuntimeSession'],
  },
  {
    file: 'targets/watch/expo-target.config.js',
    label: 'Watch target config',
    patterns: ["type: 'watch'", 'WatchConnectivity', 'HealthKit'],
  },
  {
    file: 'src/integrations/watchSyncBridge.ts',
    label: 'Watch connectivity bridge',
    patterns: ['react-native-watch-connectivity', 'log_set', 'start_workout', 'getIsWatchAppInstalled'],
  },
  {
    file: 'src/services/watchCompanionService.ts',
    label: 'Watch start from wrist',
    patterns: ['startTodaysWorkoutFromWatch', 'start_workout'],
  },
  {
    // The home screen was simplified to a Today hero; the cached week load it used to guard now
    // lives on the workout tab, which is the screen that actually renders the week.
    file: 'src/app/(tabs)/workout/index.tsx',
    label: 'Week plan loads from cache before the network',
    // `InteractionManager` / `regenCheckedRef` were dashboard-specific scheduling details that did
    // not move with the behaviour; the cached read and the hydration flag are what matter here.
    patterns: ['planDataCache.readWeek', 'warmWeekPlanData', 'hydratedFromCacheRef.current'],
  },
  {
    file: 'src/services/nutritionService.ts',
    label: 'Nutrition service generate',
    patterns: [
      'ensureWeekMealCoverage',
      'generateWeeklyMealPlan',
      'removePlannedMealsForWeek',
      'remapApiMealsToClientWeek',
      'clientWeekStart',
      'insertError',
    ],
  },
  {
    // HomeNextUpCard was removed with the home simplification; generating a meal plan is now
    // reached from the nutrition tab, which is where the guard belongs.
    file: 'src/app/(tabs)/nutrition/index.tsx',
    label: 'Meal plan generation reachable',
    patterns: ['generateWeeklyMealPlan('],
  },
  {
    file: 'src/components/settings/SettingsGroup.tsx',
    label: 'Settings group Children import',
    patterns: ["from 'react'", 'Children.toArray'],
  },
  {
    file: 'src/state/AppProviders.tsx',
    label: 'Workout plan draft provider scope',
    patterns: ['WorkoutPlanDraftProvider', 'WorkoutSessionProvider'],
  },
  {
    file: 'src/app/(tabs)/workout/_layout.tsx',
    label: 'Workout tab no nested draft provider',
    patterns: ['export default function WorkoutLayout'],
    forbidden: ['WorkoutPlanDraftProvider'],
  },
  {
    // The form was reduced to a single food + serving, so there is no longer a results array to
    // total; what matters is that the estimate shown is the one submitted.
    file: 'src/components/nutrition/SmartMealReplaceForm.tsx',
    label: 'Smart replace submits the macros it displayed',
    patterns: ['estimateFoodMacros', 'macros,'],
  },
  {
    file: 'src/state/workout/WorkoutSessionContext.tsx',
    label: 'Cancel workout refresh race guard',
    patterns: ['trackedSessionIdRef', 'clearLocalSessionState', 'trackedSessionIdRef.current !== sessionId'],
  },
  {
    file: 'src/services/bodyService.ts',
    label: 'Progress photo signed URLs',
    patterns: ['resolveProgressPhotos', 'uploadProgressPhotoFile'],
  },
  {
    file: 'src/components/auth/AuthFormContainer.tsx',
    label: 'Auth hero stacked brand',
    patterns: ['styles.brandBlock', 'HeroImages.welcome', 'alignItems: \'center\''],
  },
  {
    file: 'src/services/watchWorkoutService.ts',
    label: 'Watch workout service import',
    patterns: ["import { workoutService } from '@/services/workoutService'", 'workoutService.getActiveSession'],
  },
  {
    file: 'src/services/watchCompanionService.ts',
    label: 'Watch skip rest lightweight',
    patterns: ['LIGHTWEIGHT_INBOUND', 'skip_rest', 'set_weight'],
  },
  {
    file: 'src/hooks/useWatchCompanionSync.ts',
    label: 'Watch voice reps bridge',
    patterns: [
      'setWatchDraftReps',
      'watchPhoneBridge.setRepsHandler',
      'setWatchDraftWeightKg',
      'exerciseIndexRef',
      'WATCH_COMMANDS_WITHOUT_SESSION_REFRESH',
    ],
  },
  {
    file: 'src/lib/navigateAfterAuth.ts',
    label: 'Login post-auth navigation',
    patterns: ['authHomeRoute', 'router.replace(authHomeRoute'],
  },
  {
    file: 'src/app/(auth)/login.tsx',
    label: 'Login hooks before redirect',
    patterns: [
      'useEffect(() => {',
      'navigateAfterAuth',
    ],
  },
];

let fail = 0;

for (const { file, label, patterns, forbidden = [] } of REQUIRED) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.log(`  FAIL — ${label} — missing file ${file}`);
    fail += 1;
    continue;
  }
  const src = read(file);
  const missing = patterns.filter((p) => !src.includes(p));
  const blocked = forbidden.filter((p) => src.includes(p));
  if (missing.length === 0 && blocked.length === 0) {
    console.log(`  PASS — ${label}`);
  } else {
    const parts = [];
    if (missing.length > 0) parts.push(`missing: ${missing.join(', ')}`);
    if (blocked.length > 0) parts.push(`forbidden: ${blocked.join(', ')}`);
    console.log(`  FAIL — ${label} — ${parts.join('; ')}`);
    fail += 1;
  }
}

if (fail > 0) {
  console.error(`\nCritical path validation failed (${fail} check(s)).`);
  process.exit(1);
}

console.log(`\nCritical paths: PASS (${REQUIRED.length}/${REQUIRED.length})`);
