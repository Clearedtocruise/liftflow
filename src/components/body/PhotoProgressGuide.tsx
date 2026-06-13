import { Pressable, StyleSheet, View } from 'react-native';

import { PhotoComparisonSlider } from '@/components/body/PhotoComparisonSlider';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { classifyPhotos } from '@/lib/transformation/photoRoles';
import type { ProgressPhoto } from '@/types';
import type { PhotoAngle } from '@/types/common';

const CAPTURE_ANGLES: Array<{ id: PhotoAngle; label: string; hint: string }> = [
  { id: 'front', label: 'Front', hint: 'Take front' },
  { id: 'side_left', label: 'Side', hint: 'Take side' },
  { id: 'back', label: 'Back', hint: 'Take back' },
];

type PhotoProgressGuideProps = {
  photos: ProgressPhoto[];
  uploadAngle: PhotoAngle;
  onSelectAngle: (angle: PhotoAngle) => void;
  onUpload: () => void;
};

function hasAngle(photos: ProgressPhoto[], angle: PhotoAngle): boolean {
  if (angle === 'side_left') {
    return photos.some((p) => p.angle === 'side_left' || p.angle === 'side_right');
  }
  return photos.some((p) => p.angle === angle);
}

function photoForComparison(photos: ProgressPhoto[], angle: PhotoAngle): ProgressPhoto | undefined {
  const classified = classifyPhotos(photos);
  const matching = classified.filter((p) =>
    angle === 'side_left' ? p.angle === 'side_left' || p.angle === 'side_right' : p.angle === angle,
  );
  if (matching.length === 0) return undefined;
  const before = matching.find((p) => p.role === 'before') ?? matching[0];
  const current = matching.find((p) => p.role === 'current') ?? matching[matching.length - 1];
  return before.id !== current.id ? current : before;
}

function beforePhotoForAngle(photos: ProgressPhoto[], angle: PhotoAngle): ProgressPhoto | undefined {
  const classified = classifyPhotos(photos);
  return classified.find(
    (p) =>
      (angle === 'side_left' ? p.angle === 'side_left' || p.angle === 'side_right' : p.angle === angle) &&
      p.role === 'before',
  );
}

export function PhotoProgressGuide({
  photos,
  uploadAngle,
  onSelectAngle,
  onUpload,
}: PhotoProgressGuideProps) {
  const before = beforePhotoForAngle(photos, uploadAngle);
  const current = photoForComparison(photos, uploadAngle);

  return (
    <Card style={styles.card}>
      <AppText variant="label" color="accent">
        Progress photos
      </AppText>
      <AppText variant="footnote" color="textSecondary">
        Capture front, side, and back for the clearest transformation story.
      </AppText>

      <View style={styles.guideRow}>
        {CAPTURE_ANGLES.map((item) => {
          const captured = hasAngle(photos, item.id);
          const active = uploadAngle === item.id || (item.id === 'side_left' && uploadAngle === 'side_right');
          return (
            <Pressable
              key={item.id}
              style={[styles.guideChip, active && styles.guideChipActive]}
              onPress={() => onSelectAngle(item.id === 'side_left' ? 'side_left' : item.id)}>
              <AppText variant="caption" color={active ? 'accent' : 'textSecondary'}>
                {item.label}
              </AppText>
              <AppText variant="caption" color={captured ? 'success' : 'textTertiary'}>
                {captured ? '✓' : item.hint}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <PhotoComparisonSlider
        leftLabel="Before"
        rightLabel="Current"
        leftUri={before?.photoUrl}
        rightUri={current?.photoUrl}
      />

      <PrimaryButton label="Add progress photo" onPress={onUpload} variant="secondary" />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  guideRow: { flexDirection: 'row', gap: Spacing.sm },
  guideChip: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    gap: Spacing.xs,
    alignItems: 'center',
  },
  guideChipActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
  },
});
