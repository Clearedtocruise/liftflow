import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { areCoachChallengesEnabled } from '@/lib/trainingPreferences';
import { userService } from '@/services/userService';

/**
 * Starts off until the preference is read, so a lifter who turned challenges off never sees one
 * flash up while it loads.
 */
export function useCoachChallengesPreference() {
  const { user } = useAuth();
  const [coachChallengesEnabled, setCoachChallengesEnabled] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setCoachChallengesEnabled(false);
      return;
    }
    const result = await userService.getPreferences(user.id);
    setCoachChallengesEnabled(result.success ? areCoachChallengesEnabled(result.data) : false);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { coachChallengesEnabled };
}
