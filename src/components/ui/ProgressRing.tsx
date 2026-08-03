import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

type ProgressRingProps = {
  /** 0–100. */
  percent: number;
  size?: number;
  thickness?: number;
  from?: string;
  to?: string;
  trackColor?: string;
  /** Rendered inside the ring. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ProgressRing({
  percent,
  size = 132,
  thickness = 9,
  from = '#00E5A8',
  to = '#00E5FF',
  trackColor = 'rgba(255,255,255,0.09)',
  children,
  style,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  // A hair of arc even at 0 reads as "measured, and low" rather than as a missing ring.
  const filled = clamped === 0 ? 0 : Math.max(circumference * (clamped / 100), thickness);

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="ringSweep" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={thickness}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringSweep)"
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${filled} ${circumference}`}
          // Start at twelve o'clock instead of three.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}
