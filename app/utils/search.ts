/**
 * Case-insensitive "contains" match used by the model/plugin/discovery pickers.
 * An empty or whitespace-only query matches everything, so callers can use this
 * as a filter without special-casing the untouched input.
 */
export function matchesSearch(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return true;
  return text.toLowerCase().includes(q);
}

export function filterSelectorItems<
  T extends { title: string; subTitle?: string },
>(items: T[], query: string): T[] {
  if (query.trim().length === 0) return items;
  return items.filter((item) =>
    matchesSearch(`${item.title} ${item.subTitle ?? ""}`, query),
  );
}
