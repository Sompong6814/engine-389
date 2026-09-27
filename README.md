# Holiday Rule Engine

Computes the exact observed date of holidays for a given year from small, composable rules (nth weekday of a month, last weekday of a month, nearest weekday to a fixed date, fixed-date-with-weekend-observance). ESM, zero dependencies, UTC-based.

## Usage

```js
import {
  Weekday, Month,
  nthWeekdayOfMonth, lastWeekdayOfMonth, nearestWeekday,
  fixedMonthDayWithObservance, computeHoliday, defineHoliday, holiday,
  observedNewYear, observedIndependenceDay, observedChristmas,
  thanksgiving, laborDay, memorialDay,
} from 'holiday-rule-engine';

// Thanksgiving 2024: fourth Thursday of November
const d = nthWeekdayOfMonth(2024, Month.November, Weekday.Thursday, 4);
// -> 2024-11-28 (UTC)

// New Year's Day observed: Jan 1 2022 is Saturday, shifts to Fri Dec 31 2021
const nyd = observedNewYear(2022);
// -> 2021-12-31 (UTC)

// Define a custom holiday and evaluate it
const spec = defineHoliday('Labor Day', {
  type: 'nth', month: Month.September, weekday: Weekday.Monday, n: 1,
});
const result = holiday(spec, 2024);
// -> { name: 'Labor Day', date: 2024-09-02 (UTC) }
```

All returned dates are `Date` objects constructed with `Date.UTC(...)` and should be read via their `getUTC*` methods. This is deliberate: using local-time getters will give wrong results in timezones behind UTC when the date falls near midnight.

## Why this exists

The problem is narrow but error-prone: "fourth Thursday of November" and "July 4th observed on the nearest weekday" are rules people quote casually but implement badly. Off-by-one bugs creep in from JavaScript's zero-based months, from weekend-shift direction, and from timezone rollover when someone uses `new Date(year, month, day)` in a negative-offset zone and gets the previous day.

This library makes one set of decisions and stops there. It is not a general law engine; it encodes the three most common rule patterns in US holiday observance and a wrapper for fixed-date holidays that shift on weekends. If your holiday uses a different rule ("Tuesday after the first Monday", for instance, or a rule based on Easter), you compose it from the primitives or write your own — the library does not pretend to cover it.

## The awkward edges

- **Nearest-weekday ties.** When the target date is exactly between two weekdays (e.g. January 1st on a Saturday is one day from both Friday and Monday), this library goes **forward**. That matches the US Federal observance convention. If your jurisdiction goes backward on ties, this is the line to change.
- **Weekend observance direction.** `fixedMonthDayWithObservance` shifts Saturday→Friday and Sunday→Monday. Some employers observe Saturday→Monday instead. This library does not; if you need that, write a custom rule.
- **Fifth-occurrence requests.** Asking for the "5th Monday of February" throws a `RangeError`, because February rarely has five Mondays. This is intentional — a silent wrong answer would be worse.
- **Years before 100.** JavaScript's `Date` interprets `new Date(99, ...)` as the year 1999. This library passes years directly to `Date.UTC`; pass four-digit years.

## Rule types

- `nth` — `{ type, month, weekday, n }` where `n` is 1–5. The nth occurrence of `weekday` in `month`.
- `last` — `{ type, month, weekday }`. The last occurrence of `weekday` in `month`.
- `nearest` — `{ type, month, day, weekday }`. The date closest to (`month`, `day`) that falls on `weekday`; ties go forward.
- `fixed-observed` — `{ type, month, day }`. The fixed date, shifted to Friday if it's Saturday or Monday if it's Sunday.

## Running the tests

```sh
node --test
```
