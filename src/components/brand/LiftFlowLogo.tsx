import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

type LiftFlowLogoProps = {
  size?: number;
  variant?: 'primary' | 'white' | 'black' | 'gradient';
};

/**
 * ONE MORE mark — hidden "1" glyph + momentum ring + forward arrow.
 * Premium technology aesthetic; black field, white mark, electric blue accent.
 */
export function LiftFlowLogo({ size = 64, variant = 'primary' }: LiftFlowLogoProps) {
  const showGradient = variant === 'primary' || variant === 'gradient';
  const ringStroke = variant === 'black' ? '#080B10' : variant === 'white' ? '#FFFFFF' : 'url(#omRingGrad)';
  const markFill =
    variant === 'black' ? '#080B10' : variant === 'white' ? '#FFFFFF' : variant === 'gradient' ? 'url(#omMarkGrad)' : '#FFFFFF';
  const arrowFill = variant === 'black' ? '#080B10' : '#00E5FF';
  const ringGlow = showGradient ? 'url(#omRingGlow)' : ringStroke;

  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      {showGradient && (
        <Defs>
          <LinearGradient id="omRingGrad" x1="72" y1="400" x2="440" y2="112" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#1F6BFF" />
            <Stop offset="55%" stopColor="#1F6BFF" />
            <Stop offset="100%" stopColor="#00E5FF" />
          </LinearGradient>
          <LinearGradient id="omRingGlow" x1="72" y1="400" x2="440" y2="112" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#1F6BFF" stopOpacity="0.45" />
            <Stop offset="100%" stopColor="#00E5FF" stopOpacity="0.35" />
          </LinearGradient>
          <LinearGradient id="omMarkGrad" x1="200" y1="140" x2="280" y2="360" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="100%" stopColor="#E8F4FF" />
          </LinearGradient>
        </Defs>
      )}

      {showGradient ? (
        <Path
          d="M 108 388 A 198 198 0 1 1 418 188"
          stroke={ringGlow}
          strokeWidth={44}
          strokeLinecap="round"
          fill="none"
          opacity={0.55}
        />
      ) : null}

      <Path
        d="M 108 388 A 198 198 0 1 1 418 188"
        stroke={ringStroke}
        strokeWidth={26}
        strokeLinecap="round"
        fill="none"
      />

      {showGradient ? (
        <Path
          d="M 118 378 A 188 188 0 1 1 408 198"
          stroke="#00E5FF"
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          opacity={0.25}
        />
      ) : null}

      <G transform="translate(256 256) skewX(-8) translate(-256 -256)">
        <Path fill={markFill} d="M 228 148 L 268 148 L 268 188 L 248 188 L 248 318 L 288 318 L 288 354 L 208 354 L 208 318 L 228 318 Z" />
        <Path fill={arrowFill} d="M 288 134 L 288 172 L 354 154 Z" />
      </G>

      {showGradient ? <Circle cx={418} cy={188} r={6} fill="#00E5FF" opacity={0.85} /> : null}
    </Svg>
  );
}
