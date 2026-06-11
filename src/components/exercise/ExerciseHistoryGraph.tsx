import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { LiftFlowColors } from '@/constants/theme';

type ExerciseHistoryGraphProps = {
  values: number[];
  width: number;
  height?: number;
};

export function ExerciseHistoryGraph({ values, width, height = 80 }: ExerciseHistoryGraphProps) {
  if (values.length < 2) {
    return <View style={{ width, height }} />;
  }

  const padX = 6;
  const padY = 10;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (width - padX * 2) / (values.length - 1);

  const points = values.map((v, i) => {
    const x = padX + i * stepX;
    const y = padY + (height - padY * 2) * (1 - (v - min) / range);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${height - padY} L${points[0].x},${height - padY} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={LiftFlowColors.primary} stopOpacity={0.28} />
          <Stop offset="1" stopColor={LiftFlowColors.primary} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={areaPath} fill="url(#trendArea)" />
      <Path d={linePath} stroke={LiftFlowColors.primary} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <Circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === points.length - 1 ? 4 : 2.5}
          fill={i === points.length - 1 ? LiftFlowColors.restTimer : LiftFlowColors.primary}
        />
      ))}
    </Svg>
  );
}
