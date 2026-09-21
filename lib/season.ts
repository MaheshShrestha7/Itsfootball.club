// Fallback season label ("2026/27") for when a club hasn't defined a current season yet.
// Football seasons are assumed to start in August.
export function defaultSeasonLabel(date: Date = new Date()): string {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 7 ? year : year - 1;
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;
}
