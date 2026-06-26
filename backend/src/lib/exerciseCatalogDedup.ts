/** Scaffold slugs from the 1000-exercise import (e.g. pallof-press-ch0046). */
const CATALOG_VARIANT_SUFFIX =
  /-(?:ch|ba|la|sh|tr|qd|hm|gl|cv|co|fa|nc|ca|fu|bi)[0-9]{2,4}$/i;

export function normalizeExerciseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function slugifyExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isCatalogVariantSlug(slug: string): boolean {
  return CATALOG_VARIANT_SUFFIX.test(slug);
}

export function pickCanonicalExerciseSlug(
  name: string,
  slugs: string[],
  preferredSlugs: ReadonlySet<string> = new Set(),
): string {
  const unique = [...new Set(slugs)];
  if (unique.length === 1) return unique[0]!;

  const preferred = unique.filter((slug) => preferredSlugs.has(slug));
  if (preferred.length === 1) return preferred[0]!;
  if (preferred.length > 1) {
    return preferred.sort((a, b) => a.length - b.length)[0]!;
  }

  const base = slugifyExerciseName(name);
  if (unique.includes(base)) return base;

  const nonVariant = unique.filter((slug) => !isCatalogVariantSlug(slug));
  if (nonVariant.length > 0) {
    return nonVariant.sort((a, b) => a.length - b.length)[0]!;
  }

  return unique.sort((a, b) => a.length - b.length)[0]!;
}

export function partitionDuplicateExerciseSlugs(
  rows: Array<{ name: string; slug: string }>,
  preferredSlugs: ReadonlySet<string> = new Set(),
): { keep: string[]; remove: string[] } {
  const byName = new Map<string, string[]>();
  for (const row of rows) {
    const key = normalizeExerciseName(row.name);
    const list = byName.get(key) ?? [];
    list.push(row.slug);
    byName.set(key, list);
  }

  const keep = new Set<string>();
  const remove: string[] = [];

  for (const [nameKey, slugs] of byName) {
    if (slugs.length === 1) {
      keep.add(slugs[0]!);
      continue;
    }
    const displayName = rows.find((row) => normalizeExerciseName(row.name) === nameKey)?.name ?? nameKey;
    const canonical = pickCanonicalExerciseSlug(displayName, slugs, preferredSlugs);
    keep.add(canonical);
    for (const slug of slugs) {
      if (slug !== canonical) remove.push(slug);
    }
  }

  return { keep: [...keep], remove };
}
