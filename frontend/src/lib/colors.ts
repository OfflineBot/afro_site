// Fixed categorical order, never cycled. Index is the entity's stable position in
// the full list, so filtering never repaints the remaining series.
export const SERIES = [
  "#a778db",
  "#d87429",
  "#00a999",
  "#b68b00",
  "#00a0d1",
  "#54a950",
  "#5991ed",
  "#db668a",
];

export const MAX_SERIES = SERIES.length;

export const seriesColor = (index: number) => SERIES[index] ?? "var(--overlay0)";
