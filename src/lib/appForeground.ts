import { AppState, type AppStateStatus } from 'react-native';

/** True when the app is open and in the foreground (user is actively using it). */
export function isAppForeground(state: AppStateStatus = AppState.currentState): boolean {
  return state === 'active';
}
