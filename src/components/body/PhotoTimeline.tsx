import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { angleLabel, classifyPhotos, roleLabel, type ClassifiedPhoto } from '@/lib/transformation/photoRoles';
import type { ProgressPhoto } from '@/types';

type PhotoTimelineProps = {
  photos: ProgressPhoto[];
  selectedId: string | null;
  onSelect: (photo: ProgressPhoto) => void;
};

export function PhotoTimeline({ photos, selectedId, onSelect }: PhotoTimelineProps) {
  const classified = classifyPhotos(photos);

  if (classified.length === 0) {
    return (
      <View style={styles.empty}>
        <AppText variant="body" color="textSecondary">
          Upload front, side, and back photos to build your transformation timeline.
        </AppText>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      {classified.map((photo) => (
        <TimelineCard
          key={photo.id}
          photo={photo}
          selected={selectedId === photo.id}
          onPress={() => onSelect(photo)}
        />
      ))}
    </ScrollView>
  );
}

function TimelineCard({
  photo,
  selected,
  onPress,
}: {
  photo: ClassifiedPhoto;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.card, selected && styles.cardSelected]} onPress={onPress}>
      <Image source={{ uri: photo.photoUrl }} style={styles.image} />
      <View style={styles.meta}>
        <AppText variant="caption" color={photo.role === 'current' ? 'accent' : 'textSecondary'}>
          {roleLabel(photo.role)}
        </AppText>
        <AppText variant="caption" color="textTertiary">
          {angleLabel(photo.angle)}
        </AppText>
        <AppText variant="caption" color="textTertiary">
          {new Date(photo.takenAt).toLocaleDateString()}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { marginVertical: Spacing.md },
  empty: {
    padding: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    marginVertical: Spacing.md,
  },
  card: {
    width: 130,
    marginRight: Spacing.md,
    gap: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: { borderColor: LiftFlowColors.accent },
  image: {
    width: 130,
    height: 170,
    borderRadius: Radius.sm,
    backgroundColor: LiftFlowColors.surface,
  },
  meta: { gap: 2 },
});
