/**
 * Turns a nutrient logged today plus the active goal into what a home tile should display.
 *
 * The tile has to distinguish three states that look similar but mean different things: nothing
 * logged yet, logged with no goal to compare against, and logged against a goal. Showing "0 of
 * 2,400" to somebody who simply has not opened the app yet would be a number the app does not have.
 */

export type NutrientBudget = {
  /** Formatted headline, or undefined when nothing has been logged. */
  value?: string;
  /** Supporting line under the value. */
  caption?: string;
  /** 0–100 for the progress bar; undefined when there is no target to progress toward. */
  percent?: number;
  /** Shown instead of the caption when `value` is undefined. */
  emptyHint?: string;
};

/** @deprecated Prefer {@link NutrientBudget}; kept so existing imports keep resolving. */
export type CalorieBudget = NutrientBudget;

type BudgetFormat = {
  /** Appended to every number in the tile, e.g. "g". Calories carry theirs in the label instead. */
  suffix: string;
  /** Unit word for the "no intake yet" prompt, e.g. "Goal 2,400 cal". */
  goalUnit: string;
};

function describeBudget(
  consumed: number | undefined,
  target: number | undefined,
  { suffix, goalUnit }: BudgetFormat,
): NutrientBudget {
  const format = (amount: number) => `${Math.round(amount).toLocaleString('en-US')}${suffix}`;

  if (consumed == null || consumed <= 0) {
    return {
      emptyHint:
        target != null && target > 0
          ? `Goal ${Math.round(target).toLocaleString('en-US')}${goalUnit}`
          : 'Log a meal',
    };
  }

  if (target == null || target <= 0) {
    // Intake is still worth showing without a goal; there is just nothing to divide by.
    return { value: format(consumed), caption: 'eaten today · set a goal' };
  }

  const percent = Math.round((consumed / target) * 100);
  const remaining = target - consumed;

  return {
    value: format(consumed),
    caption:
      remaining >= 0
        ? `of ${format(target)} · ${format(remaining)} left`
        : `of ${format(target)} · ${format(Math.abs(remaining))} over`,
    percent,
  };
}

export function describeCalorieBudget(consumed?: number, target?: number): NutrientBudget {
  return describeBudget(consumed, target, { suffix: '', goalUnit: ' cal' });
}

export function describeProteinBudget(consumed?: number, target?: number): NutrientBudget {
  return describeBudget(consumed, target, { suffix: 'g', goalUnit: 'g' });
}
