import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { GROCERY_AISLE_ORDER } from '@/lib/groceryAggregation';
import {
  getGroceryRetailer,
  GROCERY_RETAILERS,
  type GroceryRetailerId,
} from '@/lib/grocery/retailers';
import { groceryService } from '@/services/groceryService';
import type { GroceryList, GroceryListItem } from '@/types';

type ShoppingListSectionProps = {
  list: GroceryList | null;
  weekLabel: string;
  mealCount: number;
  preferredRetailerId: GroceryRetailerId;
  refreshing?: boolean;
  onRefresh: () => void;
  onListChange: (list: GroceryList) => void;
};

function formatItemQuantity(item: GroceryListItem): string {
  if (item.quantity == null) return item.unit ?? '';
  return `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`.trim();
}

function groupPersistedItems(items: GroceryListItem[]): Record<string, GroceryListItem[]> {
  const groups: Record<string, GroceryListItem[]> = {};
  for (const item of items) {
    const category = item.category || 'Miscellaneous';
    const bucket = groups[category] ?? [];
    bucket.push(item);
    groups[category] = bucket;
  }
  const ordered: Record<string, GroceryListItem[]> = {};
  for (const aisle of GROCERY_AISLE_ORDER) {
    if (groups[aisle]?.length) ordered[aisle] = groups[aisle];
  }
  for (const [category, bucket] of Object.entries(groups)) {
    if (!(category in ordered)) ordered[category] = bucket;
  }
  return ordered;
}

export function ShoppingListSection({
  list,
  weekLabel,
  mealCount,
  preferredRetailerId,
  refreshing,
  onRefresh,
  onListChange,
}: ShoppingListSectionProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<GroceryListItem | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [qtyDraft, setQtyDraft] = useState('1');
  const [unitDraft, setUnitDraft] = useState('serving');
  const [categoryDraft, setCategoryDraft] = useState<string>('Miscellaneous');
  const [busy, setBusy] = useState(false);

  const retailer = getGroceryRetailer(preferredRetailerId);
  const grouped = useMemo(() => groupPersistedItems(list?.items ?? []), [list?.items]);
  const itemCount = list?.items?.length ?? 0;

  const openAdd = useCallback(() => {
    setEditItem(null);
    setNameDraft('');
    setQtyDraft('1');
    setUnitDraft('serving');
    setCategoryDraft('Miscellaneous');
    setAddOpen(true);
  }, []);

  const openEdit = useCallback((item: GroceryListItem) => {
    setEditItem(item);
    setNameDraft(item.name);
    setQtyDraft(String(item.quantity ?? 1));
    setUnitDraft(item.unit ?? 'serving');
    setCategoryDraft(item.category ?? 'Miscellaneous');
    setAddOpen(true);
  }, []);

  const handleToggle = useCallback(
    async (item: GroceryListItem) => {
      const result = await groceryService.toggleItem(item.id, !item.isChecked);
      if (result.success) onListChange(result.data);
      else Alert.alert('Error', result.error);
    },
    [onListChange],
  );

  const handleDelete = useCallback(
    async (item: GroceryListItem) => {
      Alert.alert('Remove item', `Remove ${item.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await groceryService.deleteItem(item.id);
            if (result.success) onListChange(result.data);
            else Alert.alert('Error', result.error);
          },
        },
      ]);
    },
    [onListChange],
  );

  const handleSaveModal = useCallback(async () => {
    if (!list) return;
    const name = nameDraft.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter an item name.');
      return;
    }
    const quantity = Number(qtyDraft);
    setBusy(true);
    try {
      if (editItem) {
        const result = await groceryService.updateItemQuantity(
          editItem.id,
          Number.isFinite(quantity) ? quantity : 1,
          unitDraft.trim() || 'serving',
        );
        if (!result.success) {
          Alert.alert('Error', result.error);
          return;
        }
        onListChange(result.data);
      } else {
        const result = await groceryService.addManualItem(list.id, {
          name,
          quantity: Number.isFinite(quantity) ? quantity : 1,
          unit: unitDraft.trim() || 'serving',
          category: categoryDraft,
        });
        if (!result.success) {
          Alert.alert('Error', result.error);
          return;
        }
        onListChange(result.data);
      }
      setAddOpen(false);
    } finally {
      setBusy(false);
    }
  }, [categoryDraft, editItem, list, nameDraft, onListChange, qtyDraft, unitDraft]);

  const handleOpenRetailer = useCallback(async () => {
    if (!list || list.items.length === 0) {
      Alert.alert('Empty list', 'Refresh or generate a meal plan first.');
      return;
    }
    await retailer.openShoppingExperience(list);
  }, [list, retailer]);

  const handleShare = useCallback(async () => {
    if (!list || list.items.length === 0) return;
    const lines = list.items.map((item) => {
      const qty = formatItemQuantity(item);
      return `• ${item.name}${qty ? ` — ${qty}` : ''}`;
    });
    await Share.share({
      message: `${list.name}\n\n${lines.join('\n')}`,
      title: list.name,
    });
  }, [list]);

  return (
    <>
      <Card style={styles.headerCard}>
        <AppText variant="label" color="accent">
          Weekly shopping
        </AppText>
        <AppText variant="footnote" color="textSecondary">
          {weekLabel} · {mealCount} planned meals · {itemCount} items
        </AppText>
      </Card>

      <PrimaryButton
        label={refreshing ? 'Refreshing…' : 'Refresh Shopping List'}
        variant="secondary"
        onPress={onRefresh}
        disabled={refreshing}
      />

      <View style={styles.actionRow}>
        <View style={styles.actionFlex}>
          <PrimaryButton label="Add item" variant="secondary" onPress={openAdd} disabled={!list} />
        </View>
        <View style={styles.actionFlex}>
          <PrimaryButton label="Share list" variant="ghost" onPress={() => void handleShare()} disabled={!list} />
        </View>
      </View>

      <PrimaryButton
        label={`Open in ${retailer.displayName}`}
        onPress={() => void handleOpenRetailer()}
        disabled={!list || itemCount === 0}
      />
      <AppText variant="caption" color="textTertiary">
        Preferred store: {GROCERY_RETAILERS.find((r) => r.id === preferredRetailerId)?.displayName ?? retailer.displayName}. Change in Settings.
      </AppText>

      {!list || itemCount === 0 ? (
        <Card style={styles.shoppingCard}>
          <AppText variant="body" color="textSecondary">
            Generate a meal plan first, then refresh your shopping list.
          </AppText>
        </Card>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <Card key={category} style={styles.shoppingCard}>
            <AppText variant="label" color="accent">
              {category}
            </AppText>
            {items.map((item) => (
              <View key={item.id} style={styles.shoppingRow}>
                <Pressable
                  onPress={() => void handleToggle(item)}
                  style={styles.checkHit}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.isChecked }}>
                  <View style={[styles.checkbox, item.isChecked && styles.checkboxOn]}>
                    {item.isChecked ? (
                      <AppText variant="caption" color="textPrimary">
                        ✓
                      </AppText>
                    ) : null}
                  </View>
                </Pressable>
                <Pressable style={styles.nameCol} onPress={() => openEdit(item)}>
                  <AppText
                    variant="bodyBold"
                    numberOfLines={2}
                    style={item.isChecked ? styles.checkedName : undefined}>
                    {item.name}
                  </AppText>
                  <AppText variant="caption" color="textTertiary">
                    Tap to edit qty
                  </AppText>
                </Pressable>
                <AppText variant="footnote" color="textSecondary" style={styles.qty}>
                  {formatItemQuantity(item)}
                </AppText>
                <Pressable onPress={() => void handleDelete(item)} hitSlop={8} style={styles.deleteHit}>
                  <AppText variant="caption" color="error">
                    Del
                  </AppText>
                </Pressable>
              </View>
            ))}
          </Card>
        ))
      )}

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <AppText variant="headline">{editItem ? 'Edit quantity' : 'Add item'}</AppText>
            {!editItem ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Item name"
                  placeholderTextColor={LiftFlowColors.textTertiary}
                  value={nameDraft}
                  onChangeText={setNameDraft}
                />
                <View style={styles.categoryRow}>
                  {GROCERY_AISLE_ORDER.map((aisle) => (
                    <Pressable
                      key={aisle}
                      onPress={() => setCategoryDraft(aisle)}
                      style={[styles.categoryChip, categoryDraft === aisle && styles.categoryChipOn]}>
                      <AppText variant="caption" color={categoryDraft === aisle ? 'accent' : 'textSecondary'}>
                        {aisle}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <AppText variant="bodyBold">{nameDraft}</AppText>
            )}
            <View style={styles.qtyRow}>
              <TextInput
                style={[styles.input, styles.qtyInput]}
                keyboardType="decimal-pad"
                value={qtyDraft}
                onChangeText={setQtyDraft}
              />
              <TextInput
                style={[styles.input, styles.unitInput]}
                placeholder="unit"
                placeholderTextColor={LiftFlowColors.textTertiary}
                value={unitDraft}
                onChangeText={setUnitDraft}
              />
            </View>
            <PrimaryButton label={busy ? 'Saving…' : 'Save'} onPress={() => void handleSaveModal()} disabled={busy} />
            <PrimaryButton label="Cancel" variant="ghost" onPress={() => setAddOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    gap: Spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionFlex: {
    flex: 1,
  },
  shoppingCard: {
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  shoppingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LiftFlowColors.border,
  },
  checkHit: {
    padding: Spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: LiftFlowColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: LiftFlowColors.accent,
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  checkedName: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  qty: {
    flexShrink: 0,
    maxWidth: 88,
    textAlign: 'right',
  },
  deleteHit: {
    paddingHorizontal: Spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  input: {
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: LiftFlowColors.textPrimary,
  },
  qtyRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  qtyInput: {
    flex: 1,
  },
  unitInput: {
    flex: 1,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  categoryChipOn: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.primaryGlow,
  },
});
