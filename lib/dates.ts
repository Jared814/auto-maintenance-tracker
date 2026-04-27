export function getNow(): string {
  return new Date().toISOString();
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}
