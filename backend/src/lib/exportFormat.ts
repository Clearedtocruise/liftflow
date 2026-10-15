export type ExportWeightUnit = 'lb' | 'kg';

const LB_PER_KG = 2.2046226218;

export function resolveExportWeightUnit(value: unknown): ExportWeightUnit {
  return value === 'kg' ? 'kg' : 'lb';
}

/** Weights are stored in kilograms; exports show them in the unit the lifter chose. */
export function formatExportWeight(kg: number | null | undefined, unit: ExportWeightUnit): string {
  if (kg == null || !Number.isFinite(Number(kg))) return '-';
  const value = Number(kg);
  if (unit === 'kg') {
    const rounded = Math.round(value * 10) / 10;
    return `${rounded} kg`;
  }
  return `${Math.round(value * LB_PER_KG)} lb`;
}

export function formatExportDateTime(iso: string, timeZone?: string | null): string {
  const date = new Date(iso);
  try {
    return date.toLocaleString('en-US', { timeZone: timeZone || undefined });
  } catch {
    return date.toLocaleString('en-US');
  }
}
