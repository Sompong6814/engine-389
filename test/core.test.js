import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Weekday,
  Month,
  nthWeekdayOfMonth,
  lastWeekdayOfMonth,
  nearestWeekday,
  fixedMonthDayWithObservance,
  evaluateRule,
  computeHoliday,
  defineHoliday,
  holiday,
  observedNewYear,
  observedIndependenceDay,
  observedChristmas,
  thanksgiving,
  laborDay,
  memorialDay,
} from '../src/core.js';

// All assertions use UTC explicitly. Date math in this library is UTC-based
// to avoid timezone-induced off-by-one errors — a real and common bug when
// a midnight local time rolls backward into the previous day in a negative-
// offset timezone. UTC midnight is deterministic everywhere.

function ymd(date) {
  return {
    year: date.getUTCFullYear(),
    // month is zero-based, matching JS conventions and our Month constant
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
    dow: date.getUTCDay(),
  };
}

// --- nthWeekdayOfMonth ---

test('nthWeekdayOfMonth: Thanksgiving 2024 is Nov 28', () => {
  const d = nthWeekdayOfMonth(2024, Month.November, Weekday.Thursday, 4);
  assert.deepEqual(ymd(d), { year: 2024, month: 10, day: 28, dow: 4 });
});

test('nthWeekdayOfMonth: Labor Day 2024 is Sep 2 (first Monday)', () => {
  const d = nthWeekdayOfMonth(2024, Month.September, Weekday.Monday, 1);
  assert.deepEqual(ymd(d), { year: 2024, month: 8, day: 2, dow: 1 });
});

test('nthWeekdayOfMonth: first Monday of Sep 2015 is Sep 7 (month starts on Tuesday)', () => {
  // Sep 1 2015 is a Tuesday, so first Monday is the 7th
  const d = nthWeekdayOfMonth(2015, Month.September, Weekday.Monday, 1);
  assert.deepEqual(ymd(d), { year: 2015, month: 8, day: 7, dow: 1 });
});

test('nthWeekdayOfMonth: throws when the nth weekday does not exist', () => {
  // Feb 2025 has only 4 Saturdays; the 5th doesn't exist.
  assert.throws(
    () => nthWeekdayOfMonth(2025, Month.February, Weekday.Saturday, 5),
    RangeError,
  );
});

test('nthWeekdayOfMonth: second Tuesday of March 2024 is Mar 12', () => {
  const d = nthWeekdayOfMonth(2024, Month.March, Weekday.Tuesday, 2);
  assert.deepEqual(ymd(d), { year: 2024, month: 2, day: 12, dow: 2 });
});

// --- lastWeekdayOfMonth ---

test('lastWeekdayOfMonth: Memorial Day 2024 is May 27 (last Monday of May)', () => {
  const d = lastWeekdayOfMonth(2024, Month.May, Weekday.Monday);
  assert.deepEqual(ymd(d), { year: 2024, month: 4, day: 27, dow: 1 });
});

test('lastWeekdayOfMonth: last Friday of February 2025 (leap year) is Feb 28', () => {
  const d = lastWeekdayOfMonth(2025, Month.February, Weekday.Friday);
  assert.deepEqual(ymd(d), { year: 2025, month: 1, day: 28, dow: 5 });
});

test('lastWeekdayOfMonth: last Wednesday of February 2024 (leap year, 29 days) is Feb 28', () => {
  const d = lastWeekdayOfMonth(2024, Month.February, Weekday.Wednesday);
  assert.deepEqual(ymd(d), { year: 2024, month: 1, day: 28, dow: 3 });
});

// --- nearestWeekday ---

test('nearestWeekday: when target is already the weekday, returns target unchanged', () => {
  // Jan 1 2025 is a Wednesday
  const d = nearestWeekday(2025, Month.January, 1, Weekday.Wednesday);
  assert.deepEqual(ymd(d), { year: 2025, month: 0, day: 1, dow: 3 });
});

test('nearestWeekday: Jan 1 2022 (Saturday) ties forward to Monday Jan 3', () => {
  // Sat is 1 from Fri and 1 from Mon. Tie goes forward.
  const d = nearestWeekday(2022, Month.January, 1, Weekday.Monday);
  assert.deepEqual(ymd(d), { year: 2022, month: 0, day: 3, dow: 1 });
});

test('nearestWeekday: when backward is strictly closer, goes backward', () => {
  // Jan 1 2025 is Wednesday. Nearest Monday is Dec 30 2024 (1 back)
  // vs nearest Friday is Jan 3 (2 forward). Should go back.
  const d = nearestWeekday(2025, Month.January, 1, Weekday.Monday);
  assert.deepEqual(ymd(d), { year: 2024, month: 11, day: 30, dow: 1 });
});

// --- fixedMonthDayWithObservance ---

test('fixedMonthDayWithObservance: weekday date returns itself', () => {
  // July 4 2024 is a Thursday
  const d = fixedMonthDayWithObservance(2024, Month.July, 4);
  assert.deepEqual(ymd(d), { year: 2024, month: 6, day: 4, dow: 4 });
});

test('fixedMonthDayWithObservance: Saturday shifts to Friday', () => {
  // July 4 2020 is a Saturday -> observed Friday July 3
  const d = fixedMonthDayWithObservance(2020, Month.July, 4);
  assert.deepEqual(ymd(d), { year: 2020, month: 6, day: 3, dow: 5 });
});

test('fixedMonthDayWithObservance: Sunday shifts to Monday', () => {
  // July 4 2021 is a Sunday -> observed Monday July 5
  const d = fixedMonthDayWithObservance(2021, Month.July, 4);
  assert.deepEqual(ymd(d), { year: 2021, month: 6, day: 5, dow: 1 });
});

test('fixedMonthDayWithObservance: New Year 2023 (Sun Jan 1) shifts to Mon Jan 2', () => {
  const d = observedNewYear(2023);
  assert.deepEqual(ymd(d), { year: 2023, month: 0, day: 2, dow: 1 });
});

test('fixedMonthDayWithObservance: New Year 2022 (Sat Jan 1) shifts to Fri Dec 31 2021', () => {
  const d = observedNewYear(2022);
  assert.deepEqual(ymd(d), { year: 2021, month: 11, day: 31, dow: 5 });
});

// --- evaluateRule validation ---

test('evaluateRule: rejects unknown rule type', () => {
  assert.throws(
    () => evaluateRule({ type: 'bogus' }),
    { name: 'TypeError' },
  );
});

test('evaluateRule: rejects nth rule with n=0', () => {
  assert.throws(
    () => evaluateRule({ type: 'nth', month: 10, weekday: 4, n: 0 }),
    { name: 'TypeError' },
  );
});

// --- computeHoliday ---

test('computeHoliday: evaluates nth rule correctly', () => {
  const rule = { type: 'nth', month: Month.November, weekday: Weekday.Thursday, n: 4 };
  const d = computeHoliday(rule, 2024);
  assert.deepEqual(ymd(d), { year: 2024, month: 10, day: 28, dow: 4 });
});

test('computeHoliday: evaluates last rule correctly', () => {
  const rule = { type: 'last', month: Month.May, weekday: Weekday.Monday };
  const d = computeHoliday(rule, 2024);
  assert.deepEqual(ymd(d), { year: 2024, month: 4, day: 27, dow: 1 });
});

test('computeHoliday: evaluates fixed-observed rule correctly', () => {
  const rule = { type: 'fixed-observed', month: Month.July, day: 4 };
  // 2020: Saturday -> Friday
  const d = computeHoliday(rule, 2020);
  assert.deepEqual(ymd(d), { year: 2020, month: 6, day: 3, dow: 5 });
});

// --- defineHoliday and holiday ---

test('defineHoliday + holiday: round-trips a spec through evaluation', () => {
  const spec = defineHoliday('Thanksgiving', {
    type: 'nth',
    month: Month.November,
    weekday: Weekday.Thursday,
    n: 4,
  });
  const result = holiday(spec, 2024);
  assert.equal(result.name, 'Thanksgiving');
  assert.deepEqual(ymd(result.date), { year: 2024, month: 10, day: 28, dow: 4 });
});

test('defineHoliday: rejects empty name', () => {
  assert.throws(
    () => defineHoliday('', { type: 'nth', month: 0, weekday: 0, n: 1 }),
    { name: 'TypeError' },
  );
});

// --- Predefined holiday functions across multiple years ---

test('thanksgiving: correct for 2023, 2024, 2025', () => {
  const cases = [
    { year: 2023, day: 23 },
    { year: 2024, day: 28 },
    { year: 2025, day: 27 },
  ];
  for (const { year, day } of cases) {
    const d = thanksgiving(year);
    assert.equal(d.getUTCMonth(), Month.November);
    assert.equal(d.getUTCDate(), day);
    assert.equal(d.getUTCDay(), Weekday.Thursday);
  }
});

test('laborDay: correct for 2023, 2024, 2025', () => {
  const cases = [
    { year: 2023, day: 4 },
    { year: 2024, day: 2 },
    { year: 2025, day: 1 },
  ];
  for (const { year, day } of cases) {
    const d = laborDay(year);
    assert.equal(d.getUTCMonth(), Month.September);
    assert.equal(d.getUTCDate(), day);
    assert.equal(d.getUTCDay(), Weekday.Monday);
  }
});

test('memorialDay: correct for 2023, 2024, 2025', () => {
  const cases = [
    { year: 2023, day: 29 },
    { year: 2024, day: 27 },
    { year: 2025, day: 26 },
  ];
  for (const { year, day } of cases) {
    const d = memorialDay(year);
    assert.equal(d.getUTCMonth(), Month.May);
    assert.equal(d.getUTCDate(), day);
    assert.equal(d.getUTCDay(), Weekday.Monday);
  }
});

test('observedIndependenceDay: Saturday shift in 2020, Sunday shift in 2021', () => {
  assert.deepEqual(ymd(observedIndependenceDay(2020)), { year: 2020, month: 6, day: 3, dow: 5 });
  assert.deepEqual(ymd(observedIndependenceDay(2021)), { year: 2021, month: 6, day: 5, dow: 1 });
  // 2024 is Thursday, no shift
  assert.deepEqual(ymd(observedIndependenceDay(2024)), { year: 2024, month: 6, day: 4, dow: 4 });
});

test('observedChristmas: Dec 25 2022 is Sunday -> Monday Dec 26', () => {
  const d = observedChristmas(2022);
  assert.deepEqual(ymd(d), { year: 2022, month: 11, day: 26, dow: 1 });
});

test('observedChristmas: Dec 25 2021 is Saturday -> Friday Dec 24', () => {
  const d = observedChristmas(2021);
  assert.deepEqual(ymd(d), { year: 2021, month: 11, day: 24, dow: 5 });
});
