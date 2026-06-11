import { View } from 'react-native';
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';

import type { MuscleId } from '@/constants/muscles';

export type FigureGender = 'male' | 'female';
export type FigureSide = 'front' | 'back';

/** Primary muscles — full saturation red. */
const PRIMARY_COLOR = '#FF3B30';
/** Secondary muscles — softer blue so primary reads first. */
const SECONDARY_COLOR = '#4A9EFF';
const BODY_FILL = '#E8EBF0';
const BODY_STROKE = '#8E97A8';

/** Map the typed muscle taxonomy onto body-highlighter slugs. */
const MUSCLE_SLUG: Record<MuscleId, Slug | Slug[] | null> = {
  chest: 'chest',
  'front-delts': 'deltoids',
  'side-delts': 'deltoids',
  'rear-delts': 'deltoids',
  shoulders: 'deltoids',
  triceps: 'triceps',
  biceps: 'biceps',
  forearms: 'forearm',
  lats: 'upper-back',
  'mid-back': 'upper-back',
  'upper-back': 'upper-back',
  traps: 'trapezius',
  'lower-back': 'lower-back',
  quads: 'quadriceps',
  hamstrings: 'hamstring',
  glutes: 'gluteal',
  calves: 'calves',
  abs: 'abs',
  obliques: 'obliques',
  core: 'abs',
  neck: 'neck',
  'hip-flexors': 'adductors',
  adductors: 'adductors',
  abductors: 'gluteal',
  'full-body': ['chest', 'abs', 'deltoids', 'biceps', 'quadriceps', 'calves', 'upper-back'],
};

function collectSlugs(muscles: MuscleId[]): Slug[] {
  const out = new Set<Slug>();
  for (const m of muscles) {
    const mapped = MUSCLE_SLUG[m];
    if (!mapped) continue;
    if (Array.isArray(mapped)) mapped.forEach((s) => out.add(s));
    else out.add(mapped);
  }
  return Array.from(out);
}

function buildBodyData(primary: MuscleId[], secondary: MuscleId[]): ExtendedBodyPart[] {
  const primarySlugs = new Set(collectSlugs(primary));
  const secondarySlugs = collectSlugs(secondary).filter((s) => !primarySlugs.has(s));
  const data: ExtendedBodyPart[] = [];
  primarySlugs.forEach((slug) => data.push({ slug, intensity: 2 }));
  secondarySlugs.forEach((slug) => data.push({ slug, intensity: 1 }));
  return data;
}

type MuscleMapFigureProps = {
  side: FigureSide;
  gender: FigureGender;
  primaryMuscles: MuscleId[];
  secondaryMuscles: MuscleId[];
  /** Rendered height in px; width is height / 2 (body-highlighter aspect). */
  height: number;
};

export function MuscleMapFigure({
  side,
  gender,
  primaryMuscles,
  secondaryMuscles,
  height,
}: MuscleMapFigureProps) {
  const data = buildBodyData(primaryMuscles, secondaryMuscles);
  const scale = height / 400;

  return (
    <View style={{ width: height / 2, height, alignItems: 'center', justifyContent: 'center' }}>
      <Body
        data={data}
        side={side}
        gender={gender}
        scale={scale}
        border="none"
        colors={[SECONDARY_COLOR, PRIMARY_COLOR]}
        defaultFill={BODY_FILL}
        defaultStroke={BODY_STROKE}
        defaultStrokeWidth={1}
      />
    </View>
  );
}
