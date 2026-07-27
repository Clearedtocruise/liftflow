/**
 * Turns today's calories eaten and the active goal into what the home tile should display.
 *
 * The tile has to distinguish three states that look similar but mean different things: nothing
 * logged yet, logged with no goal to compare against, and logged against a goal. Showing "0 of
 * 2,400" to somebody who simply has not opened the app yet would be a number the app does not have.
 */

export type CalorieBudget = {
  /** Formatted headline, or undefined when nothing has been logged. */
  value?: string;
  /** Supporting line under the value. */
  caption?: string;
  /** 0–100 for the progress bar; undefined when there is no target to progress toward. */
  percent?: number;
  /** Shown instead of the caption when `value` is undefined. */
  emptyHint?: string;
};

function format(calories: number): string {
  return Math.round(calories).toLocaleString('en-US');
}

export function describeCalorieBudget(consumed?: number, target?: number): CalorieBudget {
  if (consumed == null || consumed <= 0) {
    return {
      emptyHint: target != null && target > 0 ? `Goal ${format(target)} cal` : 'Log a meal',
    };
  }

  if (target == null || target <= 0) {
    // Eaten calories are still worth showing without a goal; there is just nothing to divide by.
    return { value: format(consumed), caption: 'eaten today · set a goal' };
  }

  const percent = Math.round((consumed / target) * 100);
  const remaining = target - consumed;

  if (remaining >= 0) {
    return {
      value: format(consumed),
      caption: `of ${format(target)} · ${format(remaining)} left`,
      percent,
    };
  }

  return {
    value: format(consumed),
    caption: `of ${format(target)} · ${format(Math.abs(remaining))} over`,
    percent,
  };
}
