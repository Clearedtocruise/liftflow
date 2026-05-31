import { useSubscriptionContext } from '@/contexts/SubscriptionContext';
import type { ProFeatureId } from '@/constants/subscription';

/**
 * Check Pro entitlement for a specific feature surface.
 */
export function useEntitlement(featureId: ProFeatureId) {
  const ctx = useSubscriptionContext();
  const allowed = ctx.hasFeature(featureId);

  return {
    ...ctx,
    featureId,
    allowed,
    blocked: !ctx.loading && !allowed,
    featureName: ctx.featureLabel(featureId),
  };
}
