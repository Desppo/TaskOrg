import type { RecurrenceDraft } from '../data/types';
import { fromDateKey, isValidDateKey, shiftDate, toDateKey } from './date';

export function recurrenceEndDate(draft: RecurrenceDraft, startDate: string): string | null {
  if (!isValidDateKey(startDate) || !Number.isInteger(draft.intervalValue) || draft.intervalValue < 1 || draft.intervalValue > 99) {
    throw new Error('Invalid recurrence interval or start date');
  }
  if (draft.endType === 'none') return null;
  if (draft.endType === 'date') {
    if (!draft.endDate || !isValidDateKey(draft.endDate) || draft.endDate < startDate) throw new Error('Invalid recurrence end date');
    return draft.endDate;
  }
  const duration = Number(draft.endValue);
  if (!Number.isInteger(duration) || duration < 1 || duration > 999) throw new Error('Invalid recurrence duration');
  // "Repeat for N weeks" includes the full final week, regardless of the interval.
  if (draft.frequency === 'DAILY') return shiftDate(startDate, duration - 1);
  if (draft.frequency === 'WEEKLY') return shiftDate(startDate, duration * 7 - 1);
  const start = fromDateKey(startDate);
  const nextMonth = new Date(start.getFullYear(), start.getMonth() + duration, 1);
  const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
  nextMonth.setDate(Math.min(start.getDate(), lastDay));
  return shiftDate(toDateKey(nextMonth), -1);
}
