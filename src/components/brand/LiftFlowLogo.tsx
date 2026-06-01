import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

type LiftFlowLogoProps = {
  size?: number;
  variant?: 'primary' | 'white' | 'black' | 'gradient';
};

/** ONE MORE 1M monogram — approved brand board (Sprint 8.8.1). */
export function LiftFlowLogo({ size = 64, variant = 'primary' }: LiftFlowLogoProps) {
  const fill =
    variant === 'black'
      ? '#000000'
      : variant === 'white'
        ? '#FFFFFF'
        : variant === 'gradient' || variant === 'primary'
          ? 'url(#omGrad)'
          : 'url(#omGrad)';

  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      {(variant === 'primary' || variant === 'gradient') && (
        <Defs>
          <LinearGradient id="omGrad" x1="256" y1="96" x2="256" y2="416" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#0E90FF" />
            <Stop offset="45%" stopColor="#0E90FF" />
            <Stop offset="100%" stopColor="#0456B8" />
          </LinearGradient>
        </Defs>
      )}
      <Path
        fill={fill}
        d="M 186 400 L 186 176 L 154 176 L 218 96 L 252 176 L 252 232 L 274 176 L 306 256 L 338 176 L 370 232 L 370 400 L 322 400 L 322 288 L 290 348 L 264 288 L 252 400 Z"
      />
    </Svg>
  );
}
