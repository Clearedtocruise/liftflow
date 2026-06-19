import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** Run callback when the app returns to the foreground. */
export function useAppResume(onResume: () => void): void {
  const onResumeRef = useRef(onResume);
  onResumeRef.current = onResume;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') onResumeRef.current();
    });
    return () => subscription.remove();
  }, []);
}
