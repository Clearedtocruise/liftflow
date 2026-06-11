import type { CardioType } from '@/types/common';

export type CardioActivityCategory = 'running' | 'cycling' | 'swimming' | 'sports' | 'indoor' | 'other';

export type CardioActivity = {
  id: string;
  label: string;
  icon: string;
  category: CardioActivityCategory;
  cardioType: CardioType;
};

export const CARDIO_ACTIVITY_CATEGORIES: { id: CardioActivityCategory; label: string }[] = [
  { id: 'running', label: 'Running' },
  { id: 'cycling', label: 'Cycling' },
  { id: 'swimming', label: 'Swimming' },
  { id: 'sports', label: 'Sports' },
  { id: 'indoor', label: 'Indoor' },
  { id: 'other', label: 'Other' },
];

export const CARDIO_ACTIVITIES: CardioActivity[] = [
  { id: 'road_run', label: 'Road Run', icon: '🏃', category: 'running', cardioType: 'run' },
  { id: 'trail_run', label: 'Trail Run', icon: '⛰️', category: 'running', cardioType: 'run' },
  { id: 'treadmill', label: 'Treadmill', icon: '🏃‍♂️', category: 'running', cardioType: 'treadmill' },
  { id: 'track_run', label: 'Track', icon: '🏟️', category: 'running', cardioType: 'run' },
  { id: 'walk', label: 'Walk', icon: '🚶', category: 'running', cardioType: 'walk' },
  { id: 'hike', label: 'Hike', icon: '🥾', category: 'running', cardioType: 'walk' },
  { id: 'outdoor_cycle', label: 'Outdoor Ride', icon: '🚴', category: 'cycling', cardioType: 'cycle' },
  { id: 'indoor_cycle', label: 'Indoor Cycle', icon: '🚴‍♀️', category: 'cycling', cardioType: 'cycle' },
  { id: 'spin', label: 'Spin Class', icon: '💫', category: 'cycling', cardioType: 'cycle' },
  { id: 'pool_swim', label: 'Pool Swim', icon: '🏊', category: 'swimming', cardioType: 'swim' },
  { id: 'open_water', label: 'Open Water', icon: '🌊', category: 'swimming', cardioType: 'swim' },
  { id: 'basketball', label: 'Basketball', icon: '🏀', category: 'sports', cardioType: 'other' },
  { id: 'soccer', label: 'Soccer', icon: '⚽', category: 'sports', cardioType: 'other' },
  { id: 'tennis', label: 'Tennis', icon: '🎾', category: 'sports', cardioType: 'other' },
  { id: 'pickleball', label: 'Pickleball', icon: '🏓', category: 'sports', cardioType: 'other' },
  { id: 'volleyball', label: 'Volleyball', icon: '🏐', category: 'sports', cardioType: 'other' },
  { id: 'boxing', label: 'Boxing', icon: '🥊', category: 'sports', cardioType: 'hiit' },
  { id: 'martial_arts', label: 'Martial Arts', icon: '🥋', category: 'sports', cardioType: 'hiit' },
  { id: 'rowing', label: 'Rowing', icon: '🚣', category: 'indoor', cardioType: 'row' },
  { id: 'elliptical', label: 'Elliptical', icon: '🔄', category: 'indoor', cardioType: 'elliptical' },
  { id: 'stair_climber', label: 'Stair Climber', icon: '🪜', category: 'indoor', cardioType: 'other' },
  { id: 'hiit', label: 'HIIT', icon: '⚡', category: 'indoor', cardioType: 'hiit' },
  { id: 'jump_rope', label: 'Jump Rope', icon: '🪢', category: 'indoor', cardioType: 'hiit' },
  { id: 'dance', label: 'Dance', icon: '💃', category: 'other', cardioType: 'other' },
  { id: 'skating', label: 'Skating', icon: '⛸️', category: 'other', cardioType: 'other' },
  { id: 'ski', label: 'Ski / Snowboard', icon: '⛷️', category: 'other', cardioType: 'other' },
];

const ACTIVITY_MAP = new Map(CARDIO_ACTIVITIES.map((a) => [a.id, a]));

export function getCardioActivity(id: string | undefined): CardioActivity | undefined {
  if (!id) return undefined;
  return ACTIVITY_MAP.get(id);
}

export function getCardioActivityLabel(id: string | undefined): string {
  return getCardioActivity(id)?.label ?? 'Cardio';
}

export function cardioTypeFromSlotLabel(label: string): CardioType {
  const key = label.toLowerCase();
  if (key.includes('run') || key.includes('jog')) return 'run';
  if (key.includes('walk') || key.includes('hike')) return 'walk';
  if (key.includes('cycle') || key.includes('bike') || key.includes('ride')) return 'cycle';
  if (key.includes('swim')) return 'swim';
  if (key.includes('row')) return 'row';
  if (key.includes('hiit') || key.includes('interval')) return 'hiit';
  if (key.includes('treadmill')) return 'treadmill';
  if (key.includes('elliptical')) return 'elliptical';
  return 'other';
}

export function defaultActivityIdForCardioType(type: CardioType): string {
  switch (type) {
    case 'run':
      return 'road_run';
    case 'walk':
      return 'walk';
    case 'cycle':
      return 'outdoor_cycle';
    case 'swim':
      return 'pool_swim';
    case 'row':
      return 'rowing';
    case 'hiit':
      return 'hiit';
    case 'treadmill':
      return 'treadmill';
    case 'elliptical':
      return 'elliptical';
    default:
      return 'road_run';
  }
}

export function isCardioSessionMetadata(metadata: Record<string, unknown> | undefined): boolean {
  return metadata?.sessionType === 'cardio';
}
