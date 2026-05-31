import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

type LiftFlowLogoProps = {
  size?: number;
  variant?: 'primary' | 'white' | 'black' | 'gradient';
};

/**
 * Approved LiftFlow mark — LF monogram + momentum ring + forward arrow.
 * White italic LF; F crossbar extends into cyan progress arrow; blue→cyan ring.
 */
export function LiftFlowLogo({ size = 64, variant = 'primary' }: LiftFlowLogoProps) {
  const showGradient = variant === 'primary' || variant === 'gradient';
  const ringStroke = variant === 'black' ? '#080B10' : variant === 'white' ? '#FFFFFF' : 'url(#lfRingGrad)';
  const markFill =
    variant === 'black' ? '#080B10' : variant === 'white' ? '#FFFFFF' : variant === 'gradient' ? 'url(#lfMarkGrad)' : '#FFFFFF';
  const arrowFill = variant === 'black' ? '#080B10' : '#00E5FF';
  const ringGlow = showGradient ? 'url(#lfRingGlow)' : ringStroke;

  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      {showGradient && (
        <Defs>
          <LinearGradient id="lfRingGrad" x1="72" y1="400" x2="440" y2="112" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#1F6BFF" />
            <Stop offset="55%" stopColor="#1F6BFF" />
            <Stop offset="100%" stopColor="#00E5FF" />
          </LinearGradient>
          <LinearGradient id="lfRingGlow" x1="72" y1="400" x2="440" y2="112" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#1F6BFF" stopOpacity="0.45" />
            <Stop offset="100%" stopColor="#00E5FF" stopOpacity="0.35" />
          </LinearGradient>
          <LinearGradient id="lfMarkGrad" x1="140" y1="160" x2="320" y2="360" gradientUnits="userSpaceOnUse">
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

      <G transform="translate(256 256) skewX(-11) translate(-256 -256)">
        {/* L — bold stem + base */}
        <Path fill={markFill} d="M 136 166 L 136 354 L 218 354 L 218 314 L 178 314 L 178 166 Z" />

        {/* F — crossbar extends as motion shaft; middle bar + stem */}
        <Path
          fill={markFill}
          d="M 218 166 L 346 166 L 346 198 L 252 198 L 252 242 L 292 242 L 292 270 L 252 270 L 252 354 L 218 354 Z"
        />

        {/* Cyan arrowhead — progress through the ring gap */}
        <Path fill={arrowFill} d="M 346 152 L 346 190 L 412 172 Z" />
      </G>

      {showGradient ? <Circle cx={418} cy={188} r={6} fill="#00E5FF" opacity={0.85} /> : null}
    </Svg>
  );
}
