/**
 * Curated science sources shown in Settings → Science & sources.
 * Keep aligned with age/nutrition/HR-zone behavior in the app — not a dump of every paper.
 */
export type ScienceSource = {
  id: string;
  title: string;
  organization: string;
  usedFor: string;
  url: string;
};

export const SCIENCE_SOURCES: ScienceSource[] = [
  {
    id: 'acsm-older-adults',
    title: 'Physical Activity Guidelines for Older Adults',
    organization: 'ACSM / U.S. Physical Activity Guidelines',
    usedFor: 'Age-aware training volume, rest, and lower-impact exercise selection for midlife and older adults.',
    url: 'https://www.acsm.org/',
  },
  {
    id: 'issn-protein',
    title: 'Protein and exercise for healthy aging',
    organization: 'International Society of Sports Nutrition (ISSN)',
    usedFor: 'Higher protein targets and gentler calorie deficits when date of birth indicates 55+ / 65+.',
    url: 'https://jissn.biomedcentral.com/',
  },
  {
    id: 'nsca-resistance',
    title: 'Resistance training for healthy aging',
    organization: 'NSCA',
    usedFor: 'Joint-friendly resistance progressions and avoiding unnecessary plyometric/high-impact work.',
    url: 'https://www.nsca.com/',
  },
  {
    id: 'hr-zones',
    title: 'Heart-rate training zones (%HRmax)',
    organization: 'ACSM-style intensity bands',
    usedFor: 'Cardio zone bars (Recovery → Max) when heart-rate samples are available.',
    url: 'https://www.acsm.org/',
  },
  {
    id: 'tanaka-hrmax',
    title: 'Age-predicted maximal heart rate',
    organization: 'Tanaka et al. (J Am Coll Cardiol)',
    usedFor: 'Estimating max HR from age when wearable max HR is unavailable.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/11153730/',
  },
];

export const SCIENCE_DISCLAIMER =
  'ONE MORE uses published exercise-science guidance to personalize training and nutrition. This is not medical advice. Talk with a clinician before changing exercise or diet if you have health conditions.';
