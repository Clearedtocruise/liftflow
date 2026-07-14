#!/usr/bin/env node
/**
 * Exercise Database QA — audits catalog metadata and education coverage.
 * Output: reports/exercise-database-qa.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { detectMetadataMismatches, guidePatternForName, inferExerciseMetadata } from './lib/infer-exercise-metadata.mjs';
import { loadExerciseCatalog } from './lib/parse-exercise-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const reportDir = path.join(root, 'reports');
const reportPath = path.join(reportDir, 'exercise-database-qa.md');

const CRITICAL_SLUGS = [
  'reverse-fly',
  'dumbbell-thruster-intervals',
  'neck-extension-press',
  'neck-isometric-hold',
  'running',
  'lat-pulldown',
  'goblet-squat',
  'face-pull',
];

function hasEducationCoverage(row) {
  const inferred = inferExerciseMetadata(row);
  return inferred.primaryMuscles.length > 0 && guidePatternForName(row.name) !== 'general';
}

function main() {
  const catalog = loadExerciseCatalog();
  const muscleIssues = [];
  const equipmentIssues = [];
  const classificationIssues = [];
  const missingInstructions = [];
  const missingMedia = [];
  const criticalFailures = [];

  for (const row of catalog) {
    const mismatches = detectMetadataMismatches(row);
    for (const m of mismatches) {
      const entry = { slug: row.slug, name: row.name, ...m };
      if (m.field === 'muscle_groups') muscleIssues.push(entry);
      if (m.field === 'equipment') equipmentIssues.push(entry);
      if (m.field === 'category' || m.field === 'exercise_type') classificationIssues.push(entry);
    }

    if (!hasEducationCoverage(row)) {
      missingInstructions.push({ slug: row.slug, name: row.name });
    }

    missingMedia.push({ slug: row.slug, name: row.name });

    if (CRITICAL_SLUGS.includes(row.slug)) {
      const pattern = guidePatternForName(row.name);
      const badPattern =
        (row.slug.startsWith('reverse-fly') && pattern === 'chest_fly') ||
        (row.slug.includes('neck') && pattern === 'press') ||
        (row.slug === 'dumbbell-thruster-intervals' && row.exerciseType === 'cardio' && pattern !== 'thruster_or_cardio');
      if (badPattern || mismatches.length > 0) {
        criticalFailures.push({ slug: row.slug, name: row.name, pattern, mismatches });
      }
    }
  }

  const lines = [
    '# Exercise Database QA Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `|--------|------:|`,
    `| Exercises audited | ${catalog.length} |`,
    `| Incorrect muscle mappings (DB vs name) | ${muscleIssues.length} |`,
    `| Incorrect equipment mappings | ${equipmentIssues.length} |`,
    `| Incorrect classification (category/type) | ${classificationIssues.length} |`,
    `| Exercises with generic-only education | ${missingInstructions.length} |`,
    `| Exercises missing media assets | ${missingMedia.length} |`,
    `| Critical spotlight failures | ${criticalFailures.length} |`,
    '',
    '> Runtime education uses name-based inference to correct catalog errors in the app.',
    '> DB fixes should be applied via a future metadata migration.',
    '',
  ];

  function section(title, items, formatter) {
    lines.push(`## ${title}`, '');
    if (items.length === 0) {
      lines.push('_None_', '');
      return;
    }
    lines.push(`_Showing up to 40 of ${items.length}_`, '');
    for (const item of items.slice(0, 40)) {
      lines.push(formatter(item));
    }
    lines.push('');
  }

  section('Incorrect muscle mappings', muscleIssues, (i) =>
    `- **${i.name}** (\`${i.slug}\`): stored \`${i.stored}\` → expected \`${i.expected}\``,
  );
  section('Incorrect equipment mappings', equipmentIssues, (i) =>
    `- **${i.name}** (\`${i.slug}\`): stored \`${i.stored}\` → expected \`${i.expected}\``,
  );
  section('Incorrect classification', classificationIssues, (i) =>
    `- **${i.name}** (\`${i.slug}\`): \`${i.field}\` stored \`${i.stored}\` → expected \`${i.expected}\``,
  );
  section('Generic education only', missingInstructions, (i) => `- ${i.name} (\`${i.slug}\`)`);
  section('Critical spotlight exercises', criticalFailures, (i) =>
    `- **${i.name}** (\`${i.slug}\`) — pattern: ${i.pattern}, mismatches: ${i.mismatches.length}`,
  );

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, lines.join('\n'));
  console.log(`Wrote ${reportPath}`);
  console.log(`Audited ${catalog.length} exercises`);
  console.log(`Muscle issues: ${muscleIssues.length}`);
  console.log(`Equipment issues: ${equipmentIssues.length}`);
  console.log(`Classification issues: ${classificationIssues.length}`);
}

main();
