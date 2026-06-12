#!/usr/bin/env node
/**
 * Renders static HTML previews of the corrected Workout + Nutrition UX
 * and captures iPhone-sized PNG screenshots to .preview/ux-correction/
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, '.preview', 'ux-correction');

const theme = {
  bg: '#080B10',
  surface: '#171B22',
  surfaceElevated: '#1E2430',
  border: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF',
  textSecondary: '#A6B0C3',
  textTertiary: '#6B7589',
  accent: '#0E90FF',
  success: '#00E5A8',
};

function shell(title, body, tab = 'Workout') {
  const tabs = ['Home', 'Workout', 'Nutrition', 'Progress', 'History', 'Settings'];
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif; background: ${theme.bg}; color: ${theme.text}; width: 390px; min-height: 844px; }
.status { height: 44px; }
.content { padding: 16px 20px 100px; display: flex; flex-direction: column; gap: 14px; }
.h1 { font-size: 28px; font-weight: 700; }
.sub { font-size: 14px; color: ${theme.textSecondary}; }
.card { background: ${theme.surface}; border: 1px solid ${theme.border}; border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
.card.today { border-color: ${theme.accent}; }
.card-title { font-size: 16px; font-weight: 600; }
.meta { font-size: 13px; color: ${theme.textSecondary}; line-height: 1.4; }
.caption { font-size: 12px; color: ${theme.textTertiary}; }
.label { font-size: 12px; color: ${theme.accent}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.btn { background: ${theme.accent}; color: white; border: none; border-radius: 12px; padding: 14px; font-size: 16px; font-weight: 600; text-align: center; }
.btn.secondary { background: ${theme.surfaceElevated}; color: ${theme.text}; border: 1px solid ${theme.border}; }
.exercise-row { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid ${theme.border}; }
.exercise-row:last-child { border-bottom: none; }
.idx { color: ${theme.textTertiary}; font-size: 12px; width: 16px; }
.tabs { position: fixed; bottom: 0; left: 0; width: 390px; height: 82px; background: #111318; border-top: 1px solid ${theme.border}; display: flex; justify-content: space-around; align-items: center; padding-bottom: 16px; }
.tab { font-size: 10px; color: ${theme.textTertiary}; text-align: center; }
.tab.active { color: ${theme.accent}; }
.section-tabs { display: flex; gap: 8px; }
.section-tab { flex: 1; text-align: center; padding: 10px; border-radius: 10px; background: ${theme.surfaceElevated}; font-size: 13px; color: ${theme.textSecondary}; }
.section-tab.active { background: rgba(14,144,255,0.15); color: ${theme.accent}; font-weight: 600; }
.link { color: ${theme.accent}; font-size: 13px; }
.ingredient { font-size: 13px; color: ${theme.textSecondary}; }
.actions { display: flex; gap: 16px; margin-top: 4px; }
.action-link { font-size: 12px; color: ${theme.textSecondary}; }
.action-link.accent { color: ${theme.accent}; }
.modal { background: ${theme.bg}; min-height: 844px; padding: 24px 20px; display: flex; flex-direction: column; gap: 14px; }
.chip { display: inline-block; padding: 8px 14px; border-radius: 999px; background: ${theme.surfaceElevated}; border: 1px solid ${theme.border}; font-size: 12px; margin-right: 8px; white-space: nowrap; }
.option { padding: 14px; border-radius: 10px; background: ${theme.surface}; border: 1px solid ${theme.border}; font-size: 15px; }
.hero { background: linear-gradient(135deg, #1a2740, #171B22); border-radius: 16px; padding: 20px; }
.timer { font-size: 32px; font-weight: 700; color: #00E5FF; }
</style></head><body>
<div class="status"></div>
<div class="content">
${body}
</div>
<div class="tabs">${tabs.map((t) => `<div class="tab${t === tab ? ' active' : ''}">${t}</div>`).join('')}</div>
</body></html>`;
}

const screens = {
  '01-workout-weekly-plan': shell(
    'Workout',
    `<div class="h1">Workout</div><div class="sub">Your weekly training plan</div>
${[
  ['Monday · Today', 'Push', 'Chest · Shoulders · Triceps', '6 exercises · 52 min', 'Bench Press, Overhead Press, Incline DB Press, +3 more', true],
  ['Tuesday', 'Pull', 'Back · Biceps', '6 exercises · 50 min', 'Barbell Row, Pull-ups, Lat Pulldown, +3 more', false],
  ['Wednesday', 'Legs', 'Quads · Hamstrings · Glutes', '5 exercises · 48 min', 'Squat, Romanian Deadlift, Leg Press, +2 more', false],
  ['Thursday', 'Upper', 'Chest · Back · Shoulders', '6 exercises · 51 min', 'Bench Press, Barbell Row, OHP, +3 more', false],
  ['Friday', 'Lower', 'Quads · Hamstrings · Calves', '5 exercises · 47 min', 'Squat, RDL, Leg Curl, +2 more', false],
  ['Saturday', 'Conditioning or Recovery', '', '', 'Recovery, mobility, or optional conditioning', false, true],
  ['Sunday', 'Rest or Mobility', '', '', 'Recovery, mobility, or optional conditioning', false, true],
]
  .map(
    ([day, name, groups, count, summary, today, rest]) => `<div class="card${today ? ' today' : ''}">
  <div class="row"><div><div class="label">${day}</div><div class="card-title">${name}</div></div>${rest ? '' : `<div class="meta">${count?.split(' · ')[1] ?? ''}</div>`}</div>
  ${rest ? `<div class="meta">${summary}</div>` : `<div class="meta">${groups} · ${count?.split(' · ')[0] ?? count}</div><div class="caption">${summary}</div>`}
</div>`,
  )
  .join('')}
<div class="link" style="text-align:center;margin-top:8px;">Manual Log (fallback)</div>`,
  ),

  '02-workout-day-overview': shell(
    'Workout',
    `<div class="link">← Weekly Plan</div>
<div class="card"><div class="card-title" style="font-size:22px;">Push</div><div class="meta">Chest · Shoulders · Triceps · 6 exercises · ~52 min</div></div>
<div class="label" style="color:${theme.textSecondary};">Exercises</div>
<div class="card" style="padding:4px 12px;">
${[
  ['Bench Press', '4 sets · 6-8 reps · Rest 2 min'],
  ['Overhead Press', '3 sets · 8-10 reps · Rest 90 sec'],
  ['Incline DB Press', '3 sets · 10-12 reps · Rest 90 sec'],
  ['Cable Fly', '3 sets · 12-15 reps · Rest 60 sec'],
  ['Tricep Pushdown', '3 sets · 10-12 reps · Rest 60 sec'],
  ['Lateral Raise', '3 sets · 12-15 reps · Rest 60 sec'],
]
  .map(
    ([name, detail], i) => `<div class="exercise-row"><div class="idx">${i + 1}</div><div><div class="card-title" style="font-size:15px;">${name}</div><div class="meta">${detail}</div></div></div>`,
  )
  .join('')}
</div>
<div class="btn">Start Workout</div>
<div class="btn secondary">Edit Workout</div>`,
  ),

  '03-active-exercise': shell(
    'Workout',
    `<div class="row"><div class="label">Exercise 1 of 6</div><div class="meta">Push · 18 min elapsed</div></div>
<div class="hero">
  <div class="card-title" style="font-size:26px;margin-bottom:8px;">Bench Press</div>
  <div class="meta">Target: 4 sets · 6-8 reps</div>
  <div class="meta" style="margin-top:6px;">Last: 185 lb × 8 · 185 lb × 7</div>
</div>
<div class="card"><div class="meta">Weight (lb)</div><div class="card-title" style="font-size:24px;">185</div></div>
<div class="card"><div class="meta">Reps</div><div class="card-title" style="font-size:24px;">8</div></div>
<div class="btn">Log Set · Set 2 of 4</div>
<div class="card"><div class="meta">Completed sets</div><div class="meta">Set 1 — 185 lb × 8 ✓</div></div>
<div class="card"><div class="meta">Rest timer</div><div class="timer">1:28</div></div>
<div class="card"><div class="meta">Next up</div><div class="card-title">Overhead Press</div><div class="caption">3 sets · 8-10 reps</div></div>`,
  ),

  '04-edit-workout': shell(
    'Workout',
    `<div class="link">← Back</div><div class="h1" style="font-size:22px;">Edit Push</div>
${[
  ['Bench Press', '4 sets · 6-8 reps · Rest 2 min'],
  ['Overhead Press', '3 sets · 8-10 reps · Rest 90 sec'],
  ['Incline DB Press', '3 sets · 10-12 reps · Rest 90 sec'],
]
  .map(
    ([name, detail]) => `<div class="card"><div class="card-title">${name}</div><div class="meta">${detail}</div><div class="actions"><span class="action-link accent">Replace</span><span class="action-link">Remove</span><span class="action-link">Move up</span><span class="action-link">Move down</span></div></div>`,
  )
  .join('')}
<div class="card" style="border-style:dashed;text-align:center;color:${theme.textSecondary};">+ Add exercise</div>
<div class="btn">Done editing</div>`,
  ),

  '05-nutrition-today': shell(
    'Nutrition',
    `<div class="h1">Nutrition</div><div class="sub">Wake ~4:00 AM · Workout ~5:00 AM · Sleep ~9:00 PM</div>
<div class="section-tabs"><div class="section-tab active">Today</div><div class="section-tab">Week</div><div class="section-tab">Shopping List</div></div>
<div class="card"><div class="meta">1,840 / 2,400 cal · 142 / 180g protein · 3 / 6 meals</div></div>
<div class="label">Today's Plan</div>
${[
  ['4:15 AM · Pre-workout fuel', 'Pre-workout banana and oats', ['Banana · 1 medium', 'Rolled oats · 1/2 cup', 'Honey · 1 tbsp'], '280 cal · 12P · 48C · 5F'],
  ['6:30 AM · Post-workout recovery', 'Protein shake with banana', ['Whey protein · 1 scoop', 'Banana · 1 medium', 'Almond milk · 8 oz'], '300 cal · 30P · 30C · 5F'],
  ['10:00 AM · Breakfast', 'Greek yogurt bowl with berries', ['Greek yogurt · 1 cup', 'Mixed berries · 1/2 cup', 'Honey · 1 tbsp'], '450 cal · 35P · 45C · 12F'],
]
  .map(
    ([time, name, ings, macros]) => `<div class="card"><div class="label">${time}</div><div class="card-title">${name}</div>${ings.map((i) => `<div class="ingredient">${i}</div>`).join('')}<div class="meta">${macros}</div><div class="btn" style="margin-top:8px;font-size:14px;padding:12px;">Ate as planned</div><div class="actions"><span class="action-link">Modified</span><span class="action-link">Skipped</span><span class="action-link accent">Replace</span></div></div>`,
  )
  .join('')}`,
    'Nutrition',
  ),

  '06-nutrition-week': shell(
    'Nutrition',
    `<div class="h1">Nutrition</div>
<div class="section-tabs"><div class="section-tab">Today</div><div class="section-tab active">Week</div><div class="section-tab">Shopping List</div></div>
${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  .map((day, i) => {
    const expanded = day === 'Wednesday';
    return `<div class="card"><div class="row"><div class="card-title">${day}</div><div class="meta">6 meals</div></div>${
      expanded
        ? [
            ['4:15 AM', 'Pre-workout banana and oats', '280 cal · 12P'],
            ['6:30 AM', 'Protein shake with banana', '300 cal · 30P'],
            ['10:00 AM', 'Greek yogurt bowl with berries', '450 cal · 35P'],
            ['1:00 PM', 'Grilled chicken rice bowl', '650 cal · 50P'],
            ['4:00 PM', 'Apple with almond butter', '220 cal · 6P'],
            ['7:00 PM', 'Salmon with roasted vegetables', '700 cal · 45P'],
          ]
            .map(([t, n, m]) => `<div style="padding:8px 0;border-top:1px solid ${theme.border};"><div class="label">${t}</div><div class="meta">${n}</div><div class="caption">${m}</div></div>`)
            .join('')
        : ''
    }</div>`;
  })
  .join('')}`,
    'Nutrition',
  ),

  '07-shopping-list': shell(
    'Nutrition',
    `<div class="h1">Nutrition</div>
<div class="section-tabs"><div class="section-tab">Today</div><div class="section-tab">Week</div><div class="section-tab active">Shopping List</div></div>
<div class="btn secondary">Generate Shopping List</div>
<div class="card">
${[
  ['Almond butter', '14 tbsp'],
  ['Almond milk', '56 oz'],
  ['Apple', '7 medium'],
  ['Banana', '14 medium'],
  ['Broccoli', '7 cup'],
  ['Chicken breast', '42 oz'],
  ['Greek yogurt', '7 cup'],
  ['Honey', '14 tbsp'],
  ['Mixed berries', '3.5 cup'],
  ['Mixed vegetables', '14 cups'],
  ['Olive oil', '7 tbsp'],
  ['Rolled oats', '3.5 cup'],
  ['Salmon fillet', '42 oz'],
  ['Whey protein', '7 scoop'],
  ['White rice', '7 cup cooked'],
]
  .map(([name, qty]) => `<div class="row" style="padding:8px 0;border-bottom:1px solid ${theme.border};"><div class="card-title" style="font-size:15px;">${name}</div><div class="meta">${qty}</div></div>`)
  .join('')}
</div>`,
    'Nutrition',
  ),

  '08-meal-replacement': `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
body { font-family: -apple-system, sans-serif; background: ${theme.bg}; color: ${theme.text}; width: 390px; min-height: 844px; padding: 24px 20px; }
.h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
.sub { font-size: 13px; color: ${theme.textSecondary}; margin-bottom: 4px; }
.title { font-size: 17px; font-weight: 600; margin-bottom: 16px; }
.chip { display: inline-block; padding: 8px 14px; border-radius: 999px; background: ${theme.surfaceElevated}; border: 1px solid ${theme.border}; font-size: 12px; margin: 0 8px 8px 0; }
.option { padding: 14px; border-radius: 10px; background: ${theme.surface}; border: 1px solid ${theme.border}; font-size: 15px; margin-bottom: 8px; }
.label { font-size: 12px; color: ${theme.textSecondary}; text-transform: uppercase; margin: 16px 0 8px; }
</style></head><body>
<div class="h1">Replace Meal</div>
<div class="sub">10:00 AM · Breakfast</div>
<div class="title">Greek yogurt bowl with berries</div>
<div>
<span class="chip">I don't want this</span>
<span class="chip">Need faster option</span>
<span class="chip">Restaurant option</span>
<span class="chip">Higher protein</span>
<span class="chip">Lower calories</span>
</div>
<div class="option">Egg white omelette with turkey</div>
<div class="option">Grilled chicken and quinoa</div>
<div class="option">Protein-forward Greek bowl</div>
<div class="label">Replace ingredient</div>
<div class="option" style="font-size:13px;color:${theme.textSecondary};">Greek yogurt → Skyr</div>
<div class="option" style="font-size:13px;color:${theme.textSecondary};">Mixed berries → Banana slices</div>
</body></html>`,
};

async function loadPuppeteer() {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    return require('puppeteer');
  } catch {
    console.log('Installing puppeteer for screenshots…');
    const { execSync } = await import('node:child_process');
    execSync('npm install --no-save puppeteer', { cwd: root, stdio: 'inherit' });
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    return require('puppeteer');
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  for (const [name, html] of Object.entries(screens)) {
    const htmlPath = join(outDir, `${name}.html`);
    const pngPath = join(outDir, `${name}.png`);
    await writeFile(htmlPath, html);
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 5000 });
    await page.screenshot({ path: pngPath, fullPage: true });
    console.log(`✓ ${pngPath}`);
  }

  await browser.close();
  console.log(`\nScreenshots saved to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
