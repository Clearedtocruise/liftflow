import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export type QaChecklistItemId =
  | 'workout-flow'
  | 'rest-timer'
  | 'timed-exercises'
  | 'day-swap'
  | 'nutrition-replacement'
  | 'data-reset'
  | 'daily-rollover'
  | 'weekly-rollover';

export type QaChecklistStatus = 'pass' | 'fail' | 'untested';

export type QaChecklistEntry = {
  status: QaChecklistStatus;
  notes: string;
  updatedAt: string | null;
};

export type QaChecklistState = Record<QaChecklistItemId, QaChecklistEntry>;

export const QA_CHECKLIST_ITEMS: Array<{
  id: QaChecklistItemId;
  title: string;
  steps: string;
}> = [
  {
    id: 'workout-flow',
    title: 'Complete workout flow',
    steps:
      'Home → Start Workout → log all sets on first exercise → complete workout → verify summary matches logs.',
  },
  {
    id: 'rest-timer',
    title: 'Rest timer',
    steps: 'After each set: rest appears, pause/resume/skip work, timer state is correct when returning to Workout tab.',
  },
  {
    id: 'timed-exercises',
    title: 'Timed exercises',
    steps: 'Plank or timed hold: duration-only logging, all sets complete without freeze.',
  },
  {
    id: 'day-swap',
    title: 'Day swap / move',
    steps: 'Manage Day → move or swap → Home, Weekly Plan, and Nutrition stay consistent (no duplicates).',
  },
  {
    id: 'nutrition-replacement',
    title: 'Nutrition replacement',
    steps: 'Nutrition → Replace Meal → Smart Replace → confirm list and macros update.',
  },
  {
    id: 'data-reset',
    title: 'Data reset',
    steps: 'Settings → reset workouts/nutrition/both → counts shown, old data gone, plan regenerates.',
  },
  {
    id: 'daily-rollover',
    title: 'Daily rollover',
    steps: 'After local midnight, Home shows the new day workout and meals (not yesterday).',
  },
  {
    id: 'weekly-rollover',
    title: 'Weekly rollover',
    steps: 'At week boundary, Workout weekly plan and Nutrition week view roll forward without stale data.',
  },
];

const STORAGE_KEY = '@liftflow/qa/checklist/v1';

function defaultEntry(): QaChecklistEntry {
  return { status: 'untested', notes: '', updatedAt: null };
}

export function createDefaultQaChecklistState(): QaChecklistState {
  return QA_CHECKLIST_ITEMS.reduce((acc, item) => {
    acc[item.id] = defaultEntry();
    return acc;
  }, {} as QaChecklistState);
}

export async function loadQaChecklistState(): Promise<QaChecklistState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const base = createDefaultQaChecklistState();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<QaChecklistState>;
    for (const item of QA_CHECKLIST_ITEMS) {
      const entry = parsed[item.id];
      if (entry) {
        base[item.id] = {
          status: entry.status ?? 'untested',
          notes: entry.notes ?? '',
          updatedAt: entry.updatedAt ?? null,
        };
      }
    }
    return base;
  } catch {
    return base;
  }
}

export async function saveQaChecklistState(state: QaChecklistState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function formatQaChecklistReport(state: QaChecklistState): string {
  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const buildNumber =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber ?? 'unknown'
      : Constants.expoConfig?.android?.versionCode?.toString() ?? 'unknown';
  const device = Device.modelName ?? 'Unknown device';
  const os = `${Platform.OS} ${String(Platform.Version)}`;
  const generatedAt = new Date().toISOString();

  const lines = [
    'ONE MORE — QA Checklist Report',
    `Generated: ${generatedAt}`,
    `App: ${appVersion} (${buildNumber})`,
    `Device: ${device}`,
    `OS: ${os}`,
    '',
  ];

  for (const item of QA_CHECKLIST_ITEMS) {
    const entry = state[item.id];
    const statusLabel = entry.status.toUpperCase();
    lines.push(`[${statusLabel}] ${item.title}`);
    lines.push(`Steps: ${item.steps}`);
    if (entry.notes.trim()) {
      lines.push(`Notes: ${entry.notes.trim()}`);
    }
    if (entry.updatedAt) {
      lines.push(`Updated: ${entry.updatedAt}`);
    }
    lines.push('');
  }

  const passCount = QA_CHECKLIST_ITEMS.filter((item) => state[item.id].status === 'pass').length;
  const failCount = QA_CHECKLIST_ITEMS.filter((item) => state[item.id].status === 'fail').length;
  const untestedCount = QA_CHECKLIST_ITEMS.filter((item) => state[item.id].status === 'untested').length;
  lines.push(`Summary: ${passCount} PASS · ${failCount} FAIL · ${untestedCount} UNTESTED`);

  return lines.join('\n');
}
