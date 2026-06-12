import fs from 'fs';
import path from 'path';

export function readFileIfExists(root, rel) {
  const fp = path.join(root, rel);
  if (!fs.existsSync(fp)) return '';
  return fs.readFileSync(fp, 'utf8');
}

export function readWorkoutTab(root) {
  return (
    readFileIfExists(root, 'src/app/(tabs)/workout/index.tsx') ||
    readFileIfExists(root, 'src/app/(tabs)/workout.tsx')
  );
}

export function readGateSources(root, files) {
  const paths = Array.isArray(files) ? files : [files];
  return paths.map((rel) => readFileIfExists(root, rel)).filter(Boolean).join('\n');
}
