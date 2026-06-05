import type { ReactNode } from 'react';

type FontProviderProps = {
  children: ReactNode;
};

/** Passthrough — custom fonts removed; expo-font native module is not linked in EAS builds. */
export function FontProvider({ children }: FontProviderProps) {
  return children;
}
