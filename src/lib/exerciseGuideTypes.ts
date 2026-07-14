export type ExerciseMediaAsset = {
  type: 'gif' | 'mp4' | 'image-sequence';
  url: string;
  posterUrl?: string;
  frames?: string[];
};

export type IllustratedMovementStep = {
  label: string;
  description: string;
};

export type ExerciseFormGuide = {
  /** Plain-English overview of what this movement is */
  summary?: string;
  /** What to grab — weight type, attachment, and setup notes */
  equipment?: string;
  /** Foot placement and overall body position before you start */
  setup?: string;
  /** Exact starting position at the beginning of each rep */
  startPosition?: string;
  /** What to do during the rep — the movement path */
  movement?: string;
  /** Where you finish the rep */
  endPosition?: string;
  /** Where to feel the work — muscle contraction and focus cues */
  muscleFocus?: string;
  /** Short coaching cues repeated during the set */
  coachingCues?: string[];
  /** Common mistakes to avoid */
  commonMistakes?: string[];
  musclesWorked?: { primary: string[]; secondary?: string[] };
  equipmentRequired?: string[];
  feelShould?: string[];
  feelShouldNot?: string[];
  media?: ExerciseMediaAsset;
  illustratedSteps?: IllustratedMovementStep[];
  /** Legacy numbered steps (shown only if structured fields are missing) */
  steps?: string[];
  tips?: string[];
  /** Easier variations when scaling down */
  regressions?: string[];
  /** Harder variations when progressing */
  progressions?: string[];
};

export type GuideSection = {
  id: string;
  label: string;
  body: string;
};

export function guideSections(guide: ExerciseFormGuide): GuideSection[] {
  const sections: GuideSection[] = [];
  if (guide.summary) sections.push({ id: 'summary', label: 'What this is', body: guide.summary });
  if (guide.equipment) sections.push({ id: 'equipment', label: 'Equipment', body: guide.equipment });
  if (guide.setup) sections.push({ id: 'setup', label: 'Setup', body: guide.setup });
  if (guide.startPosition && guide.startPosition !== guide.setup) {
    sections.push({ id: 'start', label: 'Starting position', body: guide.startPosition });
  }
  if (guide.movement) sections.push({ id: 'movement', label: 'The movement', body: guide.movement });
  if (guide.endPosition) sections.push({ id: 'end', label: 'End position', body: guide.endPosition });
  if (guide.muscleFocus) sections.push({ id: 'focus', label: 'Coaching focus', body: guide.muscleFocus });
  if (guide.coachingCues?.length) {
    sections.push({ id: 'cues', label: 'Coaching cues', body: guide.coachingCues.map((c) => `· ${c}`).join('\n') });
  }
  return sections;
}

export function guideHasStructure(guide: ExerciseFormGuide): boolean {
  return guideSections(guide).length > 0;
}
