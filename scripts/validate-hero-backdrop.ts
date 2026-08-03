/**
 * Guards the dashboard hero backdrop: a night scene must only appear at night.
 *
 * Usage: npm run validate:hero-backdrop
 */
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  isDaytimeHour,
  resolveHeroBackdrop,
} from '@/lib/heroBackdrop';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(
    `  ${pass ? 'PASS' : 'FAIL'} — ${label}${pass ? '' : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`,
  );
}

function isNightImage(url: string): boolean {
  return url.includes('1439853949127') || url.includes('1534438327276');
}

console.log('\nDaylight hours are classified as day');
for (const hour of [6, 8, 12, 15, 17]) {
  check(`${hour}:00 is daytime`, isDaytimeHour(hour), true);
}

console.log('\nEvening and small hours are classified as night');
for (const hour of [18, 20, 23, 0, 3, 5]) {
  check(`${hour}:00 is night`, isDaytimeHour(hour), false);
}

console.log('\nThe reported bug: a night scene at 8am');
check('recovery hero at 08:00 is not a night image', isNightImage(resolveHeroBackdrop('recovery', 8)), false);
check('workout hero at 08:00 is not a night image', isNightImage(resolveHeroBackdrop('workout', 8)), false);

console.log('\nNight still gets the night scene');
check('recovery hero at 21:00 is a night image', isNightImage(resolveHeroBackdrop('recovery', 21)), true);
check('workout hero at 21:00 is a night image', isNightImage(resolveHeroBackdrop('workout', 21)), true);

console.log('\nDay and night resolve to different images');
check(
  'recovery day differs from recovery night',
  resolveHeroBackdrop('recovery', 10) !== resolveHeroBackdrop('recovery', 22),
  true,
);
check(
  'workout day differs from workout night',
  resolveHeroBackdrop('workout', 10) !== resolveHeroBackdrop('workout', 22),
  true,
);

console.log('\nEvery hour of the day resolves to a real image URL');
let allResolved = true;
for (let hour = 0; hour < 24; hour++) {
  for (const kind of ['recovery', 'workout'] as const) {
    const url = resolveHeroBackdrop(kind, hour);
    if (!url.startsWith('https://')) allResolved = false;
  }
}
check('all 48 hour/kind combinations produce a URL', allResolved, true);

console.log('\nThe day window matches the greeting boundaries');
check('day starts at 06:00', DAY_START_HOUR, 6);
check('day ends at 18:00', DAY_END_HOUR, 18);
check('17:59 is still day', isDaytimeHour(DAY_END_HOUR - 1), true);
check('18:00 is night', isDaytimeHour(DAY_END_HOUR), false);
check('05:00 is night', isDaytimeHour(DAY_START_HOUR - 1), false);

console.log(`\nHero backdrop: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
