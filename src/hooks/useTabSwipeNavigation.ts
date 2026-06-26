import { router, useSegments } from 'expo-router';
import { useCallback } from 'react';

import {
    adjacentMainTab,
    isMainTabRoute,
    isTabSwipeEnabled,
    type MainTabRoute,
} from '@/lib/tabNavigation';

export function useTabSwipeNavigation() {
  const segments = useSegments();

  const enabled = isTabSwipeEnabled(segments);
  const currentTab = isMainTabRoute(segments[1]) ? segments[1] : null;

  const goToAdjacentTab = useCallback(
    (direction: -1 | 1) => {
      if (!currentTab) return;
      const next = adjacentMainTab(currentTab, direction);
      if (!next) return;
      router.navigate(`/(tabs)/${next}` as `/(tabs)/${MainTabRoute}`);
    },
    [currentTab],
  );

  return { enabled, goToAdjacentTab };
}
