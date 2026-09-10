export const MB = 1024 * 1024;

export const toMB = (bytes: number): number => bytes / MB;

/** Percentage of a total, guarding the divide-by-zero a missing device gives. */
export const percentOf = (used: number, total: number): number =>
  total > 0 ? (used / total) * 100 : 0;
