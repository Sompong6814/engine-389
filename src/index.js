/**
 * Holiday Rule Engine.
 *
 * Computes the exact date of observed holidays for a given year using
 * rules like "fourth Thursday of November" and "nearest weekday to January 1".
 *
 * Zero third-party dependencies. ESM only.
 */

export {
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
} from './core.js';
