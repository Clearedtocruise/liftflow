/** Primary bottom tabs — left to right swipe order. */
export const MAIN_TAB_ROUTES = [
  'dashboard',
  'workout',
  'nutrition',
  'progress',
  'history',
  'settings',
] as const;

export type MainTabRoute = (typeof MAIN_TAB_ROUTES)[number];

export function isMainTabRoute(name: string | undefined): name is MainTabRoute {
  return MAIN_TAB_ROUTES.includes(name as MainTabRoute);
}

export function adjacentMainTab(route: MainTabRoute, direction: -1 | 1): MainTabRoute | null {
  const index = MAIN_TAB_ROUTES.indexOf(route);
  if (index < 0) return null;
  const next = index + direction;
  if (next < 0 || next >= MAIN_TAB_ROUTES.length) return null;
  return MAIN_TAB_ROUTES[next];
}

/** Swipe only on tab roots — not nested stacks like workout/day. */
export function isTabSwipeEnabled(segments: string[]): boolean {
  if (segments[0] !== '(tabs)') return false;
  const tab = segments[1];
  if (!isMainTabRoute(tab)) return false;
  return segments.length === 2;
}
