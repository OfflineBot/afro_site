// Sizes are kept as a parameter count in billions, so 0.8B sorts below 4B.
export type SubjectSort = "manual" | "asc" | "desc";

export function parseSize(text: string): number | null {
  const match = text.trim().replace(",", ".").match(/^(\d+(\.\d+)?)\s*([bm])?$/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (value <= 0) return null;
  return match[3]?.toLowerCase() === "m" ? value / 1000 : value;
}

export const formatSize = (size: number | null | undefined) =>
  size == null ? "" : `${Number(size.toPrecision(4))}B`;

export function sortSubjects<T extends { size: number | null; position: number }>(
  subjects: T[],
  sort: SubjectSort,
): T[] {
  if (sort === "manual") return subjects;
  const direction = sort === "asc" ? 1 : -1;
  return [...subjects].sort((a, b) => {
    // A subject without a size has no place on the scale, so it goes last either way.
    if ((a.size === null) !== (b.size === null)) return a.size === null ? 1 : -1;
    if (a.size !== null && b.size !== null && a.size !== b.size) {
      return (a.size - b.size) * direction;
    }
    return a.position - b.position;
  });
}
