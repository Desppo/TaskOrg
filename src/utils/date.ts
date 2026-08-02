export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(value: string): Date {
  const parts = value.split('-').map(Number);
  return new Date(parts[0] ?? 1970, (parts[1] ?? 1) - 1, parts[2] ?? 1);
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toDateKey(fromDateKey(value)) === value;
}

export function shiftDate(value: string, days: number): string {
  const date = fromDateKey(value);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  return result;
}

export function endOfWeek(date: Date): Date {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  return result;
}

export function monthCalendarRange(date: Date): { start: Date; end: Date } {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
  return { start: startOfWeek(firstDay), end: endOfWeek(lastDay) };
}

export function dateKeysBetween(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12);
  while (current <= end) {
    keys.push(toDateKey(current));
    current.setDate(current.getDate() + 1);
  }
  return keys;
}
