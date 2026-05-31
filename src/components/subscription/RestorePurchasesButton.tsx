import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { subscriptionService } from '@/services/subscriptionService';

type RestorePurchasesButtonProps = {
  variant?: 'primary' | 'secondary';
  label?: string;
};

export function RestorePurchasesButton({
  variant = 'secondary',
  label = 'Restore Purchases',
}: RestorePurchasesButtonProps) {
  const { user } = useAuth();
  const { refresh } = useSubscription();
  const [busy, setBusy] = useState(false);

  const handleRestore = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const result = await subscriptionService.restorePurchases(user.id);
    setBusy(false);

    if (result.success && subscriptionService.isPremium(result.data)) {
      await refresh();
      Alert.alert('Restored', 'Your Pro subscription has been restored.');
      return;
    }

    Alert.alert('No subscription found', !result.success ? result.error : 'Use the Apple ID that purchased LiftFlow Pro.');
  }, [user, refresh]);

  return (
    <PrimaryButton label={busy ? 'Restoring…' : label} onPress={handleRestore} variant={variant} disabled={busy} />
  );
}
