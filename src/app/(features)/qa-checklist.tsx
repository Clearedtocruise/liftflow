import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import {
    createDefaultQaChecklistState,
    formatQaChecklistReport,
    loadQaChecklistState,
    QA_CHECKLIST_ITEMS,
    saveQaChecklistState,
    type QaChecklistItemId,
    type QaChecklistState,
    type QaChecklistStatus,
} from '@/lib/qaChecklist';

const STATUS_OPTIONS: Array<{ id: QaChecklistStatus; label: string }> = [
  { id: 'pass', label: 'PASS' },
  { id: 'fail', label: 'FAIL' },
  { id: 'untested', label: '—' },
];

export default function QaChecklistScreen() {
  const { user } = useAuth();
  const { isFounder } = useSubscription();
  const [state, setState] = useState<QaChecklistState | null>(null);
  const [saving, setSaving] = useState(false);

  const persist = useCallback(async (next: QaChecklistState) => {
    setState(next);
    setSaving(true);
    await saveQaChecklistState(next);
    setSaving(false);
  }, []);

  useEffect(() => {
    void loadQaChecklistState().then(setState);
  }, []);

  useEffect(() => {
    if (user && !isFounder) {
      router.replace('/(tabs)/settings');
    }
  }, [user, isFounder]);

  function updateItem(id: QaChecklistItemId, patch: Partial<{ status: QaChecklistStatus; notes: string }>) {
    if (!state) return;
    const current = state[id];
    const next: QaChecklistState = {
      ...state,
      [id]: {
        status: patch.status ?? current.status,
        notes: patch.notes ?? current.notes,
        updatedAt: new Date().toISOString(),
      },
    };
    void persist(next);
  }

  async function handleExport() {
    if (!state) return;
    const report = formatQaChecklistReport(state);
    try {
      await Share.share({ message: report, title: 'ONE MORE QA Report' });
    } catch {
      Alert.alert('Export failed', 'Could not open the share sheet.');
    }
  }

  function handleReset() {
    Alert.alert('Clear QA checklist?', 'All PASS/FAIL entries and notes will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          const cleared = createDefaultQaChecklistState();
          void persist(cleared);
        },
      },
    ]);
  }

  if (!isFounder) {
    return null;
  }

  if (!state) {
    return (
      <ScreenContainer testID="qa-checklist-screen">
        <AppText variant="body" color="textSecondary">
          Loading QA checklist…
        </AppText>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer testID="qa-checklist-screen" contentContainerStyle={styles.content}>
      <AppText variant="headline">QA Checklist</AppText>
      <AppText variant="footnote" color="textSecondary">
        Founder-only device verification. Mark each flow after testing on a real build — not from code review.
      </AppText>

      {QA_CHECKLIST_ITEMS.map((item) => {
        const entry = state[item.id];
        return (
          <Card key={item.id} style={styles.itemCard}>
            <AppText variant="bodyBold">{item.title}</AppText>
            <AppText variant="caption" color="textSecondary">
              {item.steps}
            </AppText>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((option) => {
                const selected = entry.status === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.statusChip, selected && styles.statusChipSelected]}
                    onPress={() => updateItem(item.id, { status: option.id })}>
                    <AppText variant="caption" color={selected ? 'accent' : 'textSecondary'}>
                      {option.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={styles.notesInput}
              placeholder="Notes (screen, action, error…)"
              placeholderTextColor={LiftFlowColors.textTertiary}
              value={entry.notes}
              onChangeText={(text) => updateItem(item.id, { notes: text })}
              multiline
            />
          </Card>
        );
      })}

      <PrimaryButton label="Export Report" onPress={() => void handleExport()} />
      <PrimaryButton label="Clear All" variant="secondary" onPress={handleReset} />
      {saving ? (
        <AppText variant="caption" color="textTertiary" align="center">
          Saving…
        </AppText>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  itemCard: {
    gap: Spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  statusChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  statusChipSelected: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  notesInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    textAlignVertical: 'top',
  },
});
