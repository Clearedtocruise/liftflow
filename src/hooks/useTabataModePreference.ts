import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { isTabataModeEnabled } from '@/lib/trainingPreferences';
import { userService } from '@/services/userService';

export function useTabataModePreference() {
  const { user } = useAuth();
  const [tabataModeEnabled, setTabataModeEnabled] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setTabataModeEnabled(false);
      return;
    }
    const result = await userService.getPreferences(user.id);
    setTabataModeEnabled(result.success ? isTabataModeEnabled(result.data) : false);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { tabataModeEnabled, refreshTabataPreference: refresh };
}
