const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadTypeScript } = require('./helpers.cjs');
const { recurrenceEndDate } = loadTypeScript('src/utils/recurrence.ts');
const draft = { frequency: 'DAILY', intervalValue: 1, daysOfWeek: [], endType: 'duration', endValue: '5', endDate: null };

test('a weekly duration covers all selected days in the final week', () => {
  assert.equal(recurrenceEndDate({ ...draft, frequency: 'WEEKLY', daysOfWeek: [1, 5], endValue: '1' }, '2026-09-14'), '2026-09-20');
});

test('duration is elapsed days, weeks or months, independent of interval', () => {
  assert.equal(recurrenceEndDate({ ...draft, intervalValue: 2 }, '2026-09-17'), '2026-09-21');
  assert.equal(recurrenceEndDate({ ...draft, frequency: 'MONTHLY', endValue: '1' }, '2028-01-31'), '2028-02-28');
});

test('empty, fractional and reversed recurrence values cannot be saved', () => {
  for (const invalid of [{ intervalValue: 0 }, { endValue: '' }, { endValue: '1.5' }, { endValue: '5x' }, { endType: 'date', endDate: '2026-01-01' }]) {
    assert.throws(() => recurrenceEndDate({ ...draft, ...invalid }, '2026-09-17'));
  }
});

test('no end date is valid only when the user selects no limit', () => {
  assert.equal(recurrenceEndDate({ ...draft, endType: 'none' }, '2026-09-17'), null);
  assert.throws(() => recurrenceEndDate({ ...draft, endType: 'date' }, '2026-09-17'));
});
