/**
 * Core rule-engine internals.
 *
 * The design choice here is deliberately narrow: rather than trying to encode
 * every holiday law on the planet, we implement three primitive rules
 * (nth weekday, last weekday, nearest weekday) and one observance wrapper
 * (fixed month/day that shifts when it falls on a weekend). The caller composes
 * these primitives into whatever holiday set they need. Keeping the surface
 * small means the edge cases are actually covered, not pretended to be.
 */

/**
 * @typedef {0|1|2|3|4|5|6} DayOfWeek
 */

/**
 * @typedef {0|1|2|3|4|5|6|7|8|9|10|11} MonthNumber
 */

/**
 * @typedef {Object} Rule
 * @property {string} type - One of: 'nth', 'last', 'nearest', 'fixed-observed'
 * @property {DayOfWeek} [weekday] - Required for 'nth', 'last', 'nearest'
 * @property {MonthNumber} [month] - Required for 'nth', 'last', 'fixed-observed'
 * @property {1|2|3|4|5} [n] - Required for 'nth'
 * @property {number} [day] - Required for 'fixed-observed'
 */

/**
 * @typedef {Object} HolidaySpec
 * @property {string} name
 * @property {Rule} rule
 */

/**
 * JavaScript's getDay() returns 0 for Sunday, 1 for Monday, etc. We surface
 * these as named constants so callers don't have to remember that ordering
 * and so the rule definitions are self-documenting.
 */
export const Weekday = Object.freeze({
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
});

/**
 * JavaScript's getMonth() is zero-based. Using named constants here prevents
 * the classic off-by-one bug (passing 11 for November when you mean December)
 * that has historically tripped up holiday calculations.
 */
export const Month = Object.freeze({
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
});

/**
 * The one piece of defensive validation we perform. Rule objects are plain
 * data and callers can build them dynamically; a single bad value would
 * otherwise produce a silent wrong answer days later. We fail loudly so the
 * caller sees the typo in their rule definition, not a mysterious bad date.
 *
 * @param {Rule} rule
 * @returns {void}
 * @throws {TypeError} if the rule is malformed
 */
export function evaluateRule(rule) {
  if (!rule || typeof rule !== 'object') {
    throw new TypeError('rule must be an object');
  }
  if (!('type' in rule) || typeof rule.type !== 'string') {
    throw new TypeError('rule.type must be a string');
  }
  switch (rule.type) {
    case 'nth':
      if (typeof rule.weekday !== 'number' || rule.weekday < 0 || rule.weekday > 6) {
        throw new TypeError('nth rule requires numeric weekday 0-6');
      }
      if (typeof rule.month !== 'number' || rule.month < 0 || rule.month > 11) {
        throw new TypeError('nth rule requires numeric month 0-11');
      }
      if (typeof rule.n !== 'number' || rule.n < 1 || rule.n > 5) {
        throw new TypeError('nth rule requires n in 1..5');
      }
      break;
    case 'last':
      if (typeof rule.weekday !== 'number' || rule.weekday < 0 || rule.weekday > 6) {
        throw new TypeError('last rule requires numeric weekday 0-6');
      }
      if (typeof rule.month !== 'number' || rule.month < 0 || rule.month > 11) {
        throw new TypeError('last rule requires numeric month 0-11');
      }
      break;
    case 'nearest':
      if (typeof rule.weekday !== 'number' || rule.weekday < 0 || rule.weekday > 6) {
        throw new TypeError('nearest rule requires numeric weekday 0-6');
      }
      if (typeof rule.month !== 'number' || rule.month < 0 || rule.month > 11) {
        throw new TypeError('nearest rule requires numeric month 0-11');
      }
      if (typeof rule.day !== 'number' || rule.day < 1 || rule.day > 31) {
        throw new TypeError('nearest rule requires numeric day 1-31');
      }
      break;
    case 'fixed-observed':
      if (typeof rule.month !== 'number' || rule.month < 0 || rule.month > 11) {
        throw new TypeError('fixed-observed rule requires numeric month 0-11');
      }
      if (typeof rule.day !== 'number' || rule.day < 1 || rule.day > 31) {
        throw new TypeError('fixed-observed rule requires numeric day 1-31');
      }
      break;
    default:
      throw new TypeError(`Unknown rule type: ${rule.type}`);
  }
}

/**
 * Compute the nth occurrence of a given weekday within a month.
 *
 * We walk forward from the 1st of the month to the first occurrence of the
 * target weekday, then add (n - 1) * 7 days. This is simpler and less error-
 * prone than trying to compute the date arithmetically from the day-of-week
 * of the 1st. If the nth occurrence doesn't exist in this month (e.g. the
 * 5th Monday of February), we throw — it's a rule definition bug, not a
 * meaningful calendar event.
 *
 * @param {number} year
 * @param {MonthNumber} month
 * @param {DayOfWeek} weekday
 * @param {1|2|3|4|5} n
 * @returns {Date}
 * @throws {RangeError} if the nth weekday doesn't exist in this month
 */
export function nthWeekdayOfMonth(year, month, weekday, n) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(weekday) || !Number.isInteger(n)) {
    throw new TypeError('all arguments must be integers');
  }
  if (month < 0 || month > 11) throw new RangeError('month must be 0-11');
  if (weekday < 0 || weekday > 6) throw new RangeError('weekday must be 0-6');
  if (n < 1 || n > 5) throw new RangeError('n must be 1-5');

  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  // Validate the date landed within the month. Date is lenient about overflow
  // (it rolls into the next month), so we check the month matches.
  const candidate = new Date(Date.UTC(year, month, day));
  if (candidate.getUTCMonth() !== month) {
    throw new RangeError(`there is no ${ordinal(n)} ${weekdayName(weekday)} in ${monthName(month)} ${year}`);
  }
  return candidate;
}

/**
 * Compute the last occurrence of a given weekday within a month.
 *
 * Walk backward from the last day of the month. We compute the length of the
n * month by constructing a date on day 0 of the *next* month — a long-standing
 * JavaScript idiom that avoids a lookup table for month lengths.
 *
 * @param {number} year
 * @param {MonthNumber} month
 * @param {DayOfWeek} weekday
 * @returns {Date}
 */
export function lastWeekdayOfMonth(year, month, weekday) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(weekday)) {
    throw new TypeError('all arguments must be integers');
  }
  if (month < 0 || month > 11) throw new RangeError('month must be 0-11');
  if (weekday < 0 || weekday > 6) throw new RangeError('weekday must be 0-6');

  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const last = new Date(Date.UTC(year, month, lastDayOfMonth));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month, lastDayOfMonth - offset));
}

/**
 * Compute the date closest to a target date that falls on the given weekday.
 *
 * "Nearest" is ambiguous when the target is exactly between two weekdays
 * (e.g. January 1st on a Saturday is 1 day from both Friday and Monday).
 * The common convention in US Federal holiday observance rules — and the
 * one we adopt here — is to go *forward* to the next weekday in ties.
 * This is documented in the README so there's no guessing.
 *
 * @param {number} year
 * @param {MonthNumber} month
 * @param {number} day
 * @param {DayOfWeek} weekday
 * @returns {Date}
 */
export function nearestWeekday(year, month, day, weekday) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || !Number.isInteger(weekday)) {
    throw new TypeError('all arguments must be integers');
  }
  if (month < 0 || month > 11) throw new RangeError('month must be 0-11');
  if (day < 1 || day > 31) throw new RangeError('day must be 1-31');
  if (weekday < 0 || weekday > 6) throw new RangeError('weekday must be 0-6');

  const target = new Date(Date.UTC(year, month, day));
  const targetDow = target.getUTCDay();
  if (targetDow === weekday) return target;

  // Distance forward and backward to the target weekday.
  const fwd = (weekday - targetDow + 7) % 7;
  const bwd = (targetDow - weekday + 7) % 7;
  // Tie goes forward. Changing this is a one-line edit but it's a deliberate
  // documented choice, not an oversight.
  const useForward = fwd <= bwd;
  const delta = useForward ? fwd : -bwd;
  return new Date(Date.UTC(year, month, day + delta));
}

/**
 * Compute the observed date for a fixed month/day holiday, shifting weekends
 * to the nearest weekday (Saturday -> Friday, Sunday -> Monday).
 *
 * This is the most common observance rule for fixed-date holidays
 * (New Year's, Independence Day, Christmas). It deliberately handles only the
 * Saturday->Friday and Sunday->Monday shifts because that's the Federal
 * observance convention. A holiday that shifts differently would need a
 * different rule type — we don't try to be a general law engine.
 *
 * @param {number} year
 * @param {MonthNumber} month
 * @param {number} day
 * @returns {Date}
 */
export function fixedMonthDayWithObservance(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new TypeError('all arguments must be integers');
  }
  if (month < 0 || month > 11) throw new RangeError('month must be 0-11');
  if (day < 1 || day > 31) throw new RangeError('day must be 1-31');

  const target = new Date(Date.UTC(year, month, day));
  const dow = target.getUTCDay();
  if (dow === Weekday.Saturday) {
    return new Date(Date.UTC(year, month, day - 1));
  }
  if (dow === Weekday.Sunday) {
    return new Date(Date.UTC(year, month, day + 1));
  }
  return target;
}

/**
 * Evaluate a rule object for a given year.
 *
 * @param {Rule} rule
 * @param {number} year
 * @returns {Date}
 */
export function computeHoliday(rule, year) {
  evaluateRule(rule);
  if (!Number.isInteger(year)) {
    throw new TypeError('year must be an integer');
  }
  switch (rule.type) {
    case 'nth':
      return nthWeekdayOfMonth(year, rule.month, rule.weekday, rule.n);
    case 'last':
      return lastWeekdayOfMonth(year, rule.month, rule.weekday);
    case 'nearest':
      return nearestWeekday(year, rule.month, rule.day, rule.weekday);
    case 'fixed-observed':
      return fixedMonthDayWithObservance(year, rule.month, rule.day);
    default:
      // evaluateRule already validated, but TS exhaustion checks like this.
      throw new TypeError(`Unknown rule type: ${rule.type}`);
  }
}

/**
 * Build a holiday spec object from a name and rule.
 *
 * @param {string} name
 * @param {Rule} rule
 * @returns {HolidaySpec}
 */
export function defineHoliday(name, rule) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError('name must be a non-empty string');
  }
  evaluateRule(rule);
  return { name, rule };
}

/**
 * Convenience: evaluate a holiday spec for a year, returning {name, date}.
 *
 * @param {HolidaySpec} spec
 * @param {number} year
 * @returns {{name: string, date: Date}}
 */
export function holiday(spec, year) {
  if (!spec || typeof spec !== 'object' || typeof spec.name !== 'string' || !spec.rule) {
    throw new TypeError('spec must be a HolidaySpec with name and rule');
  }
  return { name: spec.name, date: computeHoliday(spec.rule, year) };
}

// --- Predefined US Federal holiday specs ---
// These cover the common case and serve as examples of how to compose the
// primitives. They are not a claim of completeness.

/**
 * New Year's Day, observed on the nearest weekday when Jan 1 is a weekend.
 * @param {number} year
 * @returns {Date}
 */
export function observedNewYear(year) {
  return fixedMonthDayWithObservance(year, Month.January, 1);
}

/**
 * Independence Day (July 4), observed on the nearest weekday.
 * @param {number} year
 * @returns {Date}
 */
export function observedIndependenceDay(year) {
  return fixedMonthDayWithObservance(year, Month.July, 4);
}

/**
 * Christmas Day (Dec 25), observed on the nearest weekday.
 * @param {number} year
 * @returns {Date}
 */
export function observedChristmas(year) {
  return fixedMonthDayWithObservance(year, Month.December, 25);
}

/**
 * Thanksgiving: fourth Thursday of November.
 * @param {number} year
 * @returns {Date}
 */
export function thanksgiving(year) {
  return nthWeekdayOfMonth(year, Month.November, Weekday.Thursday, 4);
}

/**
 * Labor Day: first Monday of September.
 * @param {number} year
 * @returns {Date}
 */
export function laborDay(year) {
  return nthWeekdayOfMonth(year, Month.September, Weekday.Monday, 1);
}

/**
 * Memorial Day: last Monday of May.
 * @param {number} year
 * @returns {Date}
 */
export function memorialDay(year) {
  return lastWeekdayOfMonth(year, Month.May, Weekday.Monday);
}

// --- Small internal helpers for error messages only ---

function ordinal(n) {
  const words = ['', 'first', 'second', 'third', 'fourth', 'fifth'];
  return words[n] || `${n}th`;
}

function weekdayName(d) {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[d] || `day ${d}`;
}

function monthName(m) {
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return names[m] || `month ${m}`;
}
