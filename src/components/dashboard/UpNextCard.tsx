import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol } from '@/components/ui/AppSymbol';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import type { ExerciseMuscleProfile } from '@/lib/exerciseMuscleMap';
import { upNextGlyph } from '@/lib/upNextGlyph';

type UpNextCardProps = {
  /** e.g. "Tomorrow", or a weekday for anything further out. */
  when: string;
  name: string;
  focus?: string;
  /** Chooses the icon, so the tile reflects what the session trains. */
  muscles: ExerciseMuscleProfile;
  onPress: () => void;
};

/**
 * An anatomy figure used to sit here, but the body is drawn at 200×400 and nothing legible survives
 * being squeezed into a thumbnail — it read as a cropped smear. The card already says "Chest Day",
 * so the tile carries a crisp icon instead of a redundant and unreadable diagram.
 */
export function UpNextCard({ when, name, focus, muscles, onPress }: UpNextCardProps) {
  const glyph = upNextGlyph(muscles.primary[0]);

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={glyph.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.thumb}>
        <AppSymbol name={glyph.symbol} fallback={glyph.fallback} size={24} tintColor="#FFFFFF" />
      </LinearGradient>

      <View style={styles.body}>
        <AppText variant="caption" color="accent">
          {when}
        </AppText>
        <AppText variant="bodyBold" numberOfLines={2}>
          {name}
        </AppText>
        {focus ? (
          <AppText variant="caption" color="textTertiary" numberOfLines={1}>
            {focus}
          </AppText>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View plan for ${name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
        <AppText variant="caption" color="accent">
          View Plan ›
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.surface,
  },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  pill: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.accent,
  },
  pressed: {
    opacity: 0.8,
  },
});
