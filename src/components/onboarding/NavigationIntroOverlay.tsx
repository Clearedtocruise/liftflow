import { useCallback, useEffect, useState } from 'react';
import { InteractionManager, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SFSymbol } from 'sf-symbols-typescript';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';
import { AppText } from '@/components/ui/AppText';
import { Brand, LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { hasSeenNavigationIntro, markNavigationIntroSeen } from '@/lib/firstRunFlags';

type NavIntroStep = {
  title: string;
  body: string;
  icon: SFSymbol;
  tabLabel: string;
};

const STEPS: NavIntroStep[] = [
  {
    title: 'Home',
    body: 'Your dashboard — recovery, today\'s workout, nutrition snapshot, and AI coach guidance.',
    icon: 'house.fill',
    tabLabel: 'Home',
  },
  {
    title: 'Workout',
    body: 'Start strength or cardio sessions. Push-to-talk voice logging lives here.',
    icon: 'figure.strengthtraining.traditional',
    tabLabel: 'Workout',
  },
  {
    title: 'Nutrition',
    body: 'Track meals, macros, and hydration. Targets adapt to your training load.',
    icon: 'leaf.fill',
    tabLabel: 'Nutrition',
  },
  {
    title: 'Progress',
    body: 'Photos, weight trends, and transformation projections over time.',
    icon: 'camera.fill',
    tabLabel: 'Progress',
  },
  {
    title: 'History',
    body: 'Every workout, set, and cardio session — your complete training log.',
    icon: 'clock.arrow.circlepath',
    tabLabel: 'History',
  },
  {
    title: 'Settings',
    body: 'Apple Health, units, locations, subscription, and coaching preferences.',
    icon: 'gearshape.fill',
    tabLabel: 'Settings',
  },
];

type NavigationIntroOverlayProps = {
  enabled: boolean;
};

export function NavigationIntroOverlay({ enabled }: NavigationIntroOverlayProps) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void hasSeenNavigationIntro().then((seen) => {
        if (!cancelled && !seen) {
          setVisible(true);
          setStepIndex(0);
        }
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [enabled]);

  const finish = useCallback(async () => {
    await markNavigationIntroSeen();
    setVisible(false);
  }, []);

  const step = STEPS[stepIndex];
  const isLast = stepIndex >= STEPS.length - 1;

  if (!visible || !step) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => void finish()}>
      <View style={[styles.backdrop, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.sheet}>
          <AppText variant="caption" color="accent" align="center">
            Welcome to {Brand.name}
          </AppText>
          <AppText variant="headline" align="center">
            App tour · {stepIndex + 1} of {STEPS.length}
          </AppText>

          <View style={styles.iconWrap}>
            <AppSymbol name={step.icon} fallback={SYMBOL_FALLBACKS[step.icon] ?? '•'} size={36} tintColor={LiftFlowColors.accent} />
          </View>

          <AppText variant="title" align="center">
            {step.title}
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            {step.body}
          </AppText>

          <View style={styles.tabPreview}>
            {STEPS.map((item, index) => (
              <View key={item.tabLabel} style={[styles.tabDot, index === stepIndex && styles.tabDotActive]}>
                <AppSymbol
                  name={item.icon}
                  fallback={SYMBOL_FALLBACKS[item.icon] ?? '•'}
                  size={index === stepIndex ? 18 : 14}
                  tintColor={index === stepIndex ? LiftFlowColors.accent : LiftFlowColors.tabInactive}
                />
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            {stepIndex > 0 ? (
              <Pressable onPress={() => setStepIndex((i) => i - 1)} style={styles.secondaryAction}>
                <AppText variant="bodyBold" color="textSecondary">
                  Back
                </AppText>
              </Pressable>
            ) : (
              <Pressable onPress={() => void finish()} style={styles.secondaryAction}>
                <AppText variant="bodyBold" color="textSecondary">
                  Skip
                </AppText>
              </Pressable>
            )}
            <View style={styles.primaryAction}>
              <PrimaryButton
                label={isLast ? 'Start training' : 'Next'}
                onPress={() => {
                  if (isLast) void finish();
                  else setStepIndex((i) => i + 1);
                }}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  sheet: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.sm,
  },
  tabPreview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LiftFlowColors.border,
  },
  tabDot: {
    padding: Spacing.xs,
    borderRadius: Radius.full,
  },
  tabDotActive: {
    backgroundColor: LiftFlowColors.accentGlow,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  secondaryAction: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  primaryAction: {
    flex: 1,
  },
});
