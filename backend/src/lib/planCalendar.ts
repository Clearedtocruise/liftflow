/**
 * Where in its cycle a plan says today falls.
 *
 * Plans that are written for a calendar usually print it: one row per session, one column per week,
 * each cell a date ("A: Chest/triceps  Oct 10  Oct 17  Oct 24 ..."). Importing such a plan with
 * "Day 1 is today" lines every later day up wrongly whenever the lifter imports mid-cycle — today is
 * the plan's rest day, but the app hands them Day 1 and the whole week shifts by one.
 *
 * Reading the plan's own calendar says which row today is in. When it does not say — no table, no
 * row for today, or a table that does not match the days that were read — the answer is "unknown"
 * and the caller keeps the plain default rather than guessing.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const DATE_TOKEN = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/gi;

type CalendarRow = { label: string; dates: Set<string> };

function key(monthIndex: number, day: number): string {
  return `${monthIndex}-${day}`;
}

function parseRow(line: string): CalendarRow | null {
  const matches = [...line.matchAll(DATE_TOKEN)];
  if (matches.length < 2) return null;

  const first = matches[0];
  const label = line.slice(0, first.index).trim();
  // Anything after the last date is only a trailing dash for an empty cell.
  const last = matches[matches.length - 1];
  const tail = line.slice((last.index ?? 0) + last[0].length).replace(/[\s\-–—]/g, '');
  if (tail.length > 0) return null;
  // Ranges and prose put words between the dates; a table cell is a date and nothing else.
  const between = line.slice(first.index, (last.index ?? 0) + last[0].length).replace(DATE_TOKEN, '').replace(/[\s,\-–—]/g, '');
  if (between.length > 0) return null;

  const dates = new Set<string>();
  for (const match of matches) {
    const monthIndex = MONTHS.indexOf(match[1].toLowerCase().slice(0, 3));
    const day = Number(match[2]);
    if (monthIndex >= 0 && day >= 1 && day <= 31) dates.add(key(monthIndex, day));
  }
  return { label, dates };
}

/** The longest run of back-to-back calendar rows in the text. */
function longestCalendarRun(text: string): CalendarRow[] {
  let best: CalendarRow[] = [];
  let run: CalendarRow[] = [];
  for (const line of text.split('\n')) {
    const row = parseRow(line.trim());
    if (row && row.label) {
      run.push(row);
      if (run.length > best.length) best = [...run];
    } else if (line.trim()) {
      run = [];
    }
  }
  return best;
}

export type PlanStartDay = { day: number; label: string };

/**
 * The cycle day (1-based, in the order the plan lists its sessions) that `today` falls on, or null.
 *
 * `dayCount` is how many cycle days were read from the document. The table has to have exactly that
 * many rows, otherwise its rows and the days that were read cannot be told apart by position.
 */
export function detectPlanStartDay(text: string, today: string, dayCount: number): PlanStartDay | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!parts || dayCount < 1) return null;
  const todayKey = key(Number(parts[2]) - 1, Number(parts[3]));

  const rows = longestCalendarRun(text);
  if (rows.length !== dayCount) return null;

  const index = rows.findIndex((row) => row.dates.has(todayKey));
  if (index < 0) return null;
  return { day: index + 1, label: rows[index].label };
}
