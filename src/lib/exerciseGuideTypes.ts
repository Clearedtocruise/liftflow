export type ExerciseFormGuide = {
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
  /** Legacy numbered steps (shown only if structured fields are missing) */
  steps?: string[];
  tips?: string[];
};

export type GuideSection = {
  id: string;
  label: string;
  body: string;
};

export function guideSections(guide: ExerciseFormGuide): GuideSection[] {
  const sections: GuideSection[] = [];
  if (guide.equipment) sections.push({ id: 'equipment', label: 'What to use', body: guide.equipment });
  if (guide.setup) sections.push({ id: 'setup', label: 'Foot & body position', body: guide.setup });
  if (guide.startPosition) sections.push({ id: 'start', label: 'Starting position', body: guide.startPosition });
  if (guide.movement) sections.push({ id: 'movement', label: 'The movement', body: guide.movement });
  if (guide.endPosition) sections.push({ id: 'end', label: 'End position', body: guide.endPosition });
  if (guide.muscleFocus) sections.push({ id: 'focus', label: 'Feel it here', body: guide.muscleFocus });
  return sections;
}

export function guideHasStructure(guide: ExerciseFormGuide): boolean {
  return guideSections(guide).length > 0;
}
