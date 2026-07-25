import { SymbolView } from 'expo-symbols';
import { Platform, Text, type ColorValue } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

type AppSymbolProps = {
  /** SF Symbol name (iOS). Must be a valid SFSymbol string. */
  name: SFSymbol;
  size?: number;
  tintColor?: ColorValue;
  /** Shown on Android and web where SF Symbols are unavailable */
  fallback?: string;
};

/**
 * Cross-platform symbol wrapper for SDK 54 expo-symbols API.
 * SDK 54 uses `name: SFSymbol` + optional `fallback` (not platform-specific name objects).
 */
export function AppSymbol({ name, size = 24, tintColor, fallback = '●' }: AppSymbolProps) {
  if (Platform.OS === 'ios') {
    return <SymbolView name={name} size={size} tintColor={tintColor} />;
  }

  // Symbols sit next to a real text label, so unhidden they make a screen reader announce the
  // emoji fallback as its own element and repeat what the surrounding control already says.
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ fontSize: size * 0.85, color: tintColor, lineHeight: size }}>
      {fallback}
    </Text>
  );
}

/** Map common SF Symbol names to fallback glyphs for Android/web */
export const SYMBOL_FALLBACKS: Partial<Record<SFSymbol, string>> = {
  'mic.fill': '🎤',
  'figure.strengthtraining.traditional': '🏋',
  'clock.arrow.circlepath': '🕐',
  'gearshape.fill': '⚙',
  'square.grid.2x2.fill': '▦',
  'chevron.right': '›',
  'chevron.left': '‹',
  'person.fill': '👤',
  'target': '🎯',
  'figure.stand': '🧍',
  'doc.text': '📄',
  'lock.shield': '🔒',
  'exclamationmark.triangle': '⚠',
  'sparkles': '✨',
  'chevron.down': '▼',
  'chevron.up': '▲',
  'house.fill': '🏠',
  'leaf.fill': '🥗',
  'camera.fill': '📷',
  'chart.line.uptrend.xyaxis': '📈',
  'creditcard.fill': '💳',
  'heart.text.square.fill': '❤',
  'hand.raised.fill': '✋',
  'envelope.fill': '✉',
};
