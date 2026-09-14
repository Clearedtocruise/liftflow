/**
 * Guards the layout of the settings list.
 *
 * The reported failure: the "Do it yourself" section looked broken on device. Each row put its
 * label and a trailing `value` on one line, and a trailing string takes whatever width it asks
 * for. So the sentences in that section — "Upload workout and/or nutrition to follow" and friends
 * — squeezed the label beside them into a column one character wide, which rendered as a vertical
 * stack of single letters.
 *
 * Two things keep it fixed: sentences belong in `description`, which sits under the label, and
 * `value` can shrink so it can never crush the label again.
 *
 * Usage: npm run validate:settings-rows
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(
    `  ${pass ? 'PASS' : 'FAIL'} — ${label}${pass ? '' : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`,
  );
}

const repoRoot = join(__dirname, '..');
function source(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

const row = source('src/components/settings/SettingsRow.tsx');
const settings = source('src/app/(tabs)/settings.tsx');

console.log('\nThe reported failure: a row\u2019s label is not crushed into a column of letters');

check('a row can carry a description under its label', /\bdescription\?: string;/.test(row), true);
check('the label column can grow to the width it needs', /text: \{\s*flex: 1,/.test(row), true);
// Without this the trailing string keeps its full intrinsic width and the label absorbs every
// pixel of the shortfall, one character per line.
check('the trailing value shrinks rather than the label', /value: \{[^}]*flexShrink: 1,/s.test(row), true);
check('the trailing value is capped to a minority of the row', /value: \{[^}]*maxWidth: '40%'/s.test(row), true);

console.log('\nSentences are descriptions, not trailing values');

// Anything much past a couple of words is prose, and prose on the trailing edge is what broke the
// section in the first place.
const LONGEST_REASONABLE_VALUE = 22;
const longValues = [...settings.matchAll(/^\s*value="([^"]+)"/gm)]
  .map((match) => match[1])
  .filter((value) => value.length > LONGEST_REASONABLE_VALUE);
check('no row states a sentence through `value`', longValues, []);

console.log('\nThe section the report was about');

for (const [label, description] of [
  ['Custom program', 'Build a 1–30 day looping cycle'],
  ['Import program PDF', 'Upload workout and/or nutrition to follow'],
  ['Load Aggressive Cut plan', '193→180 · 6-day + meals'],
] as const) {
  const literal = description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`label="${label}"\\s*\\n\\s*description="${literal}"`);
  check(`"${label}" explains itself under its label`, pattern.test(settings), true);
}

console.log('\nGrouping');

check('rows are grouped into cards that divide them', /export function SettingsGroup/.test(row), true);
check('a divider separates every row after the first', /separated: index > 0/.test(row), true);
// A single icon in a group indents that row's label; the rest have to keep the column open or the
// group reads as a ragged left edge.
check('iconless rows hold the icon column open', /reserveIcon/.test(row), true);
check('the settings screen uses the grouped card', /<SettingsGroup>/.test(settings), true);
check('no settings card bypasses the grouping', /<Card style=\{styles\.group\}>/.test(settings), false);

console.log(
  failures === 0
    ? '\nAll settings row layout checks passed.\n'
    : `\n${failures} settings row layout check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
