/**
 * Onboarding hook redesign — short promise → personalize → reveal, not a 16-step intake.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
function source(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}`);
  if (!ok) {
    failures += 1;
    console.log(`         expected ${JSON.stringify(expected)}`);
    console.log(`         actual   ${JSON.stringify(actual)}`);
  }
}

console.log('Onboarding hook redesign');

const profile = source('src/app/(onboarding)/profile.tsx');
const shell = source('src/components/onboarding/OnboardingShell.tsx');
const reveal = source('src/components/onboarding/OnboardingReveal.tsx');
const why = source('src/constants/whyLiftFlow.ts');
const legal = source('src/app/(onboarding)/legal.tsx');

check('profile wizard is 7 steps', profile.includes('TOTAL_STEPS = 7'), true);
check('no 16-step intake remains', profile.includes('TOTAL_STEPS = 16'), false);
check('activation reveal component is used', profile.includes('OnboardingReveal'), true);
check('reveal shows workout payoff', reveal.includes("TODAY'S WORKOUT"), true);
check('reveal shows protein target', reveal.includes('PROTEIN'), true);
check('shell brands ONE MORE', shell.includes('Brand.name'), true);
check('shell supports full-bleed hero', shell.includes('fullBleedHero'), true);
check('why deck is three slides', (why.match(/id: '/g) ?? []).length, 3);
check('legal leads with ONE MORE brand', legal.includes('Brand.name') || legal.includes('ONE MORE'), true);
check('legal CTA builds the plan', legal.includes('I accept — build my plan'), true);
check('limitations are deferred out of core flow', profile.includes('limitationAreas'), false);
check('equipment detail picker deferred', profile.includes('EquipmentPicker'), false);

console.log(`\nOnboarding hook: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
