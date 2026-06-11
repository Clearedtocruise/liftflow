// Preview renderer for the Exercise Card anatomy figure.
// Uses react-native-body-highlighter's real anatomical path data so the export
// matches what renders in-app.
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '.preview');
const CLEAN_OUT = '/Users/timothybarrett/liftflow-previews';
mkdirSync(OUT, { recursive: true });
mkdirSync(CLEAN_OUT, { recursive: true });

function loadAsset(name) {
  const mod = require(`react-native-body-highlighter/dist/assets/${name}.js`);
  return mod.default ?? mod[name] ?? mod;
}

const ASSETS = {
  male: { front: loadAsset('bodyFront'), back: loadAsset('bodyBack') },
  female: { front: loadAsset('bodyFemaleFront'), back: loadAsset('bodyFemaleBack') },
};

/** Matches library viewBoxes — keeps figures centered and uncropped. */
const VIEWBOX = {
  male: { front: '-12 0 748 1448', back: '712 0 748 1448' },
  female: { front: '-50 -40 734 1538', back: '756 0 774 1448' },
};

const PRIMARY = '#FF3B30';
const SECONDARY = '#2E7DF6';
const BODY = '#D8DCE3';
const STROKE = '#3A4250';
const BG = '#FFFFFF';

const MUSCLE_SLUG = {
  chest: ['chest'],
  'front-delts': ['deltoids'],
  'side-delts': ['deltoids'],
  'rear-delts': ['deltoids'],
  triceps: ['triceps'],
  biceps: ['biceps'],
  forearms: ['forearm'],
  lats: ['upper-back'],
  'mid-back': ['upper-back'],
  'upper-back': ['upper-back'],
  traps: ['trapezius'],
  'lower-back': ['lower-back'],
  quads: ['quadriceps'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves'],
  abs: ['abs'],
  obliques: ['obliques'],
  core: ['abs'],
  neck: ['neck'],
};
const slugs = (muscles) => new Set(muscles.flatMap((m) => MUSCLE_SLUG[m] ?? []));

function buildSvg(gender, side, primaryMuscles, secondaryMuscles, title, sub) {
  const asset = ASSETS[gender][side];
  const viewBox = VIEWBOX[gender][side];
  const primary = slugs(primaryMuscles);
  const secondary = slugs(secondaryMuscles);

  let body = '';
  for (const part of asset) {
    const color = primary.has(part.slug) ? PRIMARY : secondary.has(part.slug) ? SECONDARY : BODY;
    const ds = [...(part.path.common ?? []), ...(part.path.left ?? []), ...(part.path.right ?? [])];
    for (const d of ds) body += `<path d="${d}" fill="${color}" stroke="${STROKE}" stroke-width="1.2"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="760" viewBox="${viewBox}">
  <rect x="-9999" y="-9999" width="99999" height="99999" fill="${BG}"/>
  ${body}
  <text x="50%" y="96%" fill="#1A1F28" font-family="Helvetica" font-size="42" font-weight="700" text-anchor="middle">${title}</text>
  <text x="50%" y="99%" fill="#6B7589" font-family="Helvetica" font-size="28" text-anchor="middle">${sub}</text>
</svg>`;
}

const examples = [
  { file: 'pullup-back', side: 'back', p: ['lats'], s: ['biceps', 'mid-back', 'rear-delts'], title: 'PULL-UP', sub: 'Back · Lats (primary)' },
  { file: 'bench-front', side: 'front', p: ['chest'], s: ['triceps', 'front-delts'], title: 'BENCH PRESS', sub: 'Front · Chest (primary)' },
  { file: 'squat-front', side: 'front', p: ['quads'], s: ['core'], title: 'SQUAT', sub: 'Front · Quads (primary)' },
  { file: 'curl-front', side: 'front', p: ['biceps'], s: ['forearms'], title: 'BICEP CURL', sub: 'Front · Biceps (primary)' },
];

const gender = process.argv.includes('--female') ? 'female' : process.argv.includes('--male') ? 'male' : 'both';

for (const g of gender === 'both' ? ['male', 'female'] : [gender]) {
  for (const ex of examples) {
    const prefix = g === 'female' ? `female-${ex.file}` : ex.file;
    const svgPath = join(OUT, `${prefix}.svg`);
    const label = g === 'female' ? `${ex.title} · Female` : ex.title;
    writeFileSync(svgPath, buildSvg(g, ex.side, ex.p, ex.s, label, ex.sub));
    try {
      execSync(`qlmanage -t -s 820 -o "${OUT}" "${svgPath}"`, { stdio: 'ignore' });
      const pngSrc = join(OUT, `${prefix}.svg.png`);
      const pngDst = join(CLEAN_OUT, `${prefix}.png`);
      copyFileSync(pngSrc, pngDst);
    } catch (e) {
      console.error('qlmanage failed for', prefix, e.message);
    }
    console.log('rendered', prefix);
  }
}

console.log('preview dir:', OUT);
console.log('clean dir:', CLEAN_OUT);
