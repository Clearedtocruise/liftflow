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
    file: 'src/app/(tabs)/dashboard.tsx',
    label: 'Dashboard plan load',
    patterns: [
      'planDataCache.readWeek',
      'warmWeekPlanData',
      'InteractionManager',
      'regenCheckedRef',
      'hydratedFromCacheRef.current',
    ],
    forbidden: ['weekWorkouts.length]'],
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
    file: 'src/components/dashboard/HomeNextUpCard.tsx',
    label: 'Home generate prop destructured',
    patterns: ['onGenerateMealPlan?:', 'onGenerateMealPlan,', 'onPress={onGenerateMealPlan}'],
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
    file: 'src/components/nutrition/SmartMealReplaceForm.tsx',
    label: 'Smart replace macro totals',
    patterns: ['sumMealMacros(results.map((item) => item.macros))'],
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
  {
    file: 'src/lib/exerciseGuideTypes.ts',
    label: 'Structured exercise form guides',
    patterns: ['equipment?:', 'setup?:', 'muscleFocus?:', 'guideSections'],
  },
  {
    file: 'src/components/cardio/CardioSessionPanel.tsx',
    label: 'Cardio session save on complete',
    patterns: ['cardioService.logSession', 'ActivitySessionSaveCard', 'estimateActivityCalories'],
  },
  {
    file: 'backend/src/lib/movementPatternExclusion.ts',
    label: 'Pull-up variant pattern exclusion',
    patterns: ['wide-pull-up', 'archer-pull-up', 'pull-up'],
  },
  {
    file: 'src/lib/heartRateZones.ts',
    label: 'Activity heart rate zones helper',
    patterns: ['buildHeartRateZoneBuckets', 'HeartRateZone', 'supportsPowerMetrics'],
  },
  {
    file: 'backend/src/lib/ageAdjustments.ts',
    label: 'Age-based training adjustments',
    patterns: ['ageTrainingAdjustments', 'preferLowImpact', 'ageNutritionAdjustments', 'JOINT_FRIENDLY_PREF_KEY'],
  },
  {
    file: 'backend/src/lib/workoutPlanner.ts',
    label: 'Planner uses age and joint-friendly prefs',
    patterns: ['resolveTrainingAdjustments', 'jointFriendlyTraining', 'date_of_birth'],
  },
  {
    file: 'src/lib/pendingMealQueue.ts',
    label: 'Nutrition meal offline queue',
    patterns: ['pendingMealQueue', 'enqueue', 'countForUser'],
  },
  {
    file: 'src/hooks/useVoiceRecognition.ts',
    label: 'Voice STT re-enabled',
    patterns: ['expo-speech-recognition', 'startListening', 'isAvailable'],
    forbidden: ['Voice logging is temporarily unavailable'],
  },
  {
    file: 'src/constants/activityOptions.ts',
    label: 'Home activity equestrian and walk route',
    patterns: ["id: 'equestrian'", 'cardio-tracking?activity=walk'],
  },
  {
    file: 'src/app/(features)/_layout.tsx',
    label: 'Cardio routes registered in features stack',
    patterns: ["name=\"cardio-tracking\"", "name=\"log-activity\""],
  },
  {
    file: 'src/components/dashboard/HomeNextUpCard.tsx',
    label: 'Home activity / calories entry',
    patterns: ['Calories left', 'onLogActivity', 'Log Activity'],
  },
  {
    file: 'src/components/workout/execution/WorkoutWeeklyPlanScreen.tsx',
    label: 'Workout tab cardio entry',
    patterns: ['Cardio & HIIT', 'onCardio'],
  },
  {
    file: '.easignore',
    label: 'EAS must not exclude cardio from builds',
    patterns: ['ios/', 'android/'],
    forbidden: ['cardio-tracking', 'src/components/cardio'],
  },
  {
    file: 'targets/watch/content.swift',
    label: 'Watch home screen when idle',
    patterns: ['WatchHomeScreen', 'Sync with iPhone', 'Start a lift or cardio on iPhone'],
  },
  {
    file: 'src/app/(tabs)/settings.tsx',
    label: 'Settings tabata preference imports',
    patterns: ['isTabataModeEnabled', 'TABATA_MODE_PREF_KEY', 'tabataModeSummary'],
  },
  {
    file: 'src/app/(tabs)/settings.tsx',
    label: 'Settings useAuth import',
    patterns: ["import { useAuth } from '@/hooks/useAuth'", 'useAuth()'],
  },
  {
    file: 'src/components/workout/execution/GlobalRestTimerOverlay.tsx',
    label: 'Rest overlay last-exercise guard',
    patterns: ['next ? (exerciseEffectiveTargetSets[next.id]', 'next?.exercise?.name'],
  },
  {
    file: 'src/state/workout/WorkoutSessionContext.tsx',
    label: 'Sprint B offline set retry',
    patterns: [
      'pendingSetQueue',
      'mergePendingSetsIntoSession',
      'flushInFlightRef',
      'countForSession',
      'purgeSession',
    ],
    forbidden: ['!sessionId || item.sessionId === sessionId'],
  },
  {
    file: 'src/lib/pendingSetSync.ts',
    label: 'Sprint B pending set merge',
    patterns: ['mergePendingSetsIntoSession', 'pendingSync: true', 'clearLocalRestTimerState'],
  },
  {
    file: 'src/services/exerciseCoachService.ts',
    label: 'Sprint B coach prescription timeout',
    patterns: ['COACH_PRESCRIPTION_TIMEOUT_MS', 'withTimeout'],
  },
  {
    file: 'src/components/workout/ExerciseCoachCard.tsx',
    label: 'Sprint B coach flicker guard',
    patterns: ['coachPrescriptionsEqual', 'sessionSetsSignature', 'onPrescriptionRef'],
  },
  {
    file: 'src/app/(tabs)/workout/index.tsx',
    label: 'Sprint B workout tab spinner guard',
    patterns: ['loading && !session && loadingPlan && weekDays.length === 0'],
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
