import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

type SparklineProps = {
  /** Oldest to newest. Gaps are allowed: a missing day is undefined, not zero. */
  values: (number | undefined)[];
  tint: string;
  width?: number;
  height?: number;
  /** `bars` suits a count per day (workouts, streak); `line` suits a continuous measure. */
  variant?: 'line' | 'bars';
};

/**
 * A trend shown at a glance, with no axes or labels. Deliberately refuses to draw anything from a
 * single data point — one value is not a trend, and a flat line implies a week of history that is
 * not there.
 */
export function Sparkline({
  values,
  tint,
  width = 120,
  height = 34,
  variant = 'line',
}: SparklineProps) {
  const points = values.map((value) => (Number.isFinite(value) ? (value as number) : undefined));
  const present = points.filter((value): value is number => value != null);
  if (present.length < 2) return <View style={{ width, height }} />;

  const min = Math.min(...present);
  const max = Math.max(...present);
  // A flat series would divide by zero and draw at the very top; centre it instead.
  const span = max - min || Math.max(Math.abs(max), 1);
  const stepX = points.length > 1 ? width / (points.length - 1) : width;
  const y = (value: number) => height - 3 - ((value - min) / span) * (height - 6);

  if (variant === 'bars') {
    const barWidth = Math.max((width / points.length) * 0.55, 2);
    return (
      <Svg width={width} height={height}>
        {points.map((value, index) =>
          value == null ? null : (
            <Rect
              key={index}
              x={index * stepX + (stepX - barWidth) / 2}
              y={y(value)}
              width={barWidth}
              height={Math.max(height - 3 - y(value), 2)}
              rx={barWidth / 2}
              fill={tint}
              opacity={index === points.length - 1 ? 1 : 0.55}
            />
          ),
        )}
      </Svg>
    );
  }

  // Missing days break the line rather than being interpolated across, so a gap reads as a gap.
  const segments: string[] = [];
  let current = '';
  points.forEach((value, index) => {
    if (value == null) {
      if (current) segments.push(current);
      current = '';
      return;
    }
    const command = current ? 'L' : 'M';
    current += `${current ? ' ' : ''}${command}${index * stepX},${y(value)}`;
  });
  if (current) segments.push(current);

  const firstIndex = points.findIndex((value) => value != null);
  const lastIndex = points.length - 1 - [...points].reverse().findIndex((value) => value != null);
  const fillPath =
    segments.length === 1
      ? `${segments[0]} L${lastIndex * stepX},${height} L${firstIndex * stepX},${height} Z`
      : null;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tint} stopOpacity={0.28} />
          <Stop offset="1" stopColor={tint} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {fillPath ? <Path d={fillPath} fill="url(#sparkFill)" /> : null}
      {segments.map((segment, index) => (
        <Path
          key={index}
          d={segment}
          stroke={tint}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}
