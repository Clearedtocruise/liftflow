import type { ProgressPhoto } from '@/types';
import type { PhotoAngle } from '@/types/common';
import type { PhotoRole } from '@/types/transformation';

export type ClassifiedPhoto = ProgressPhoto & { role: PhotoRole };

const ANGLE_LABELS: Record<PhotoAngle, string> = {
  front: 'Front',
  back: 'Back',
  side_left: 'Side L',
  side_right: 'Side R',
  custom: 'Custom',
};

export function angleLabel(angle: PhotoAngle): string {
  return ANGLE_LABELS[angle] ?? angle;
}

/** Infer timeline roles from chronological order (oldest → newest). */
export function classifyPhotos(photos: ProgressPhoto[]): ClassifiedPhoto[] {
  if (photos.length === 0) return [];

  const sorted = [...photos].sort(
    (a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime(),
  );

  return sorted.map((photo, index) => {
    const notes = photo.notes?.toLowerCase() ?? '';
    if (notes.includes('milestone')) {
      return { ...photo, role: 'milestone' as PhotoRole };
    }
    if (sorted.length === 1) return { ...photo, role: 'current' as PhotoRole };
    if (index === 0) return { ...photo, role: 'before' as PhotoRole };
    if (index === sorted.length - 1) return { ...photo, role: 'current' as PhotoRole };
    return { ...photo, role: 'progress' as PhotoRole };
  });
}

export function photosByAngle(photos: ClassifiedPhoto[]): Map<PhotoAngle, ClassifiedPhoto[]> {
  const map = new Map<PhotoAngle, ClassifiedPhoto[]>();
  for (const photo of photos) {
    const list = map.get(photo.angle) ?? [];
    list.push(photo);
    map.set(photo.angle, list);
  }
  return map;
}

export function roleBadgeColor(role: PhotoRole): 'accent' | 'textSecondary' | 'textTertiary' {
  switch (role) {
    case 'before':
      return 'textSecondary';
    case 'current':
      return 'accent';
    case 'milestone':
      return 'accent';
    default:
      return 'textTertiary';
  }
}

export function roleLabel(role: PhotoRole): string {
  switch (role) {
    case 'before':
      return 'Before';
    case 'progress':
      return 'Progress';
    case 'milestone':
      return 'Milestone';
    case 'current':
      return 'Current';
  }
}
