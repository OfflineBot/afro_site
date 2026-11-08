export const format = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);
