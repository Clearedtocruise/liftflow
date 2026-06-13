import type { CardioType } from '@/types/common';

export type CardioActivity = {
  id: string;
  label: string;
  description: string;
  type: CardioType;
  mode: 'steady' | 'interval' | 'tabata';
  workSeconds?: number;
  restSeconds?: number;
  rounds?: number;
};

export const CARDIO_ACTIVITIES: CardioActivity[] = [
  {
    id: 'tabata',
    label: 'Tabata',
    description: '20 sec work · 10 sec rest · 10 rounds',
    type: 'hiit',
    mode: 'tabata',
    workSeconds: 20,
    restSeconds: 10,
    rounds: 10,
  },
  {
    id: 'hiit-40-20',
    label: 'HIIT Intervals',
    description: '40 sec work · 20 sec rest · 10 rounds',
    type: 'hiit',
    mode: 'interval',
    workSeconds: 40,
    restSeconds: 20,
    rounds: 10,
  },
  {
    id: 'steady-run',
    label: 'Steady Run',
    description: 'Continuous cardio with elapsed timer',
    type: 'run',
    mode: 'steady',
  },
  {
    id: 'steady-bike',
    label: 'Steady Bike',
    description: 'Continuous cycling session',
    type: 'cycle',
    mode: 'steady',
  },
  {
    id: 'row-intervals',
    label: 'Row Intervals',
    description: '60 sec work · 30 sec rest · 8 rounds',
    type: 'row',
    mode: 'interval',
    workSeconds: 60,
    restSeconds: 30,
    rounds: 8,
  },
  {
    id: 'walk',
    label: 'Recovery Walk',
    description: 'Low-intensity steady walk',
    type: 'walk',
    mode: 'steady',
  },
];

export function cardioActivityById(id: string): CardioActivity | undefined {
  return CARDIO_ACTIVITIES.find((activity) => activity.id === id);
}
