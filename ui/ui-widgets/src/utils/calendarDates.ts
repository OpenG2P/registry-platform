import {
  convertFromIso8601,
  convertToIso8601,
  constants,
} from '@dhis2/multi-calendar-dates';

/** Calendars supported by the multi-calendar Temporal engine. */
export const SUPPORTED_CALENDARS = constants.calendars;

export type RegistryCalendar = (typeof SUPPORTED_CALENDARS)[number];
type SupportedCalendar = RegistryCalendar;

/** Common alternate names mapped to Temporal calendar ids. */
const CALENDAR_ALIAS_MAP: Record<string, SupportedCalendar> = {
  ethiopian: 'ethiopic',
  gregorian: 'gregory',
  thai: 'buddhist',
};

const GREGORIAN_LIKE = new Set<string>(['gregory', 'iso8601', 'gregorian']);

export const isGregorianCalendar = (
  calendar: string | undefined | null
): boolean => {
  if (!calendar) {
    return true;
  }
  return GREGORIAN_LIKE.has(calendar);
};

/**
 * Resolve a schema calendar id or common alias to a SupportedCalendar id.
 * Unknown values fall back to gregory.
 */
export const resolveCalendar = (
  calendar: string | undefined | null
): SupportedCalendar => {
  if (!calendar) {
    return 'gregory';
  }
  const lower = calendar.toLowerCase();
  if (CALENDAR_ALIAS_MAP[lower]) {
    return CALENDAR_ALIAS_MAP[lower];
  }
  if ((SUPPORTED_CALENDARS as readonly string[]).includes(lower)) {
    return lower as SupportedCalendar;
  }
  return 'gregory';
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** CalendarDate → yyyy-MM-dd using eraYear when present (Ethiopic). */
export const calendarDateToString = (parts: {
  year: number;
  month: number;
  day: number;
  eraYear?: number;
}): string => {
  const year = parts.eraYear ?? parts.year;
  return `${year}-${pad2(parts.month)}-${pad2(parts.day)}`;
};

/**
 * Convert a Gregorian ISO date (YYYY-MM-DD) into calendar-local parts.
 */
export const fromGregorianISO = (
  iso: string,
  calendar: string | undefined | null
): { year: number; month: number; day: number; eraYear?: number } | null => {
  if (!iso) {
    return null;
  }
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }
  const gregorianIso = `${match[1]}-${match[2]}-${match[3]}`;
  const cal = resolveCalendar(calendar);
  if (isGregorianCalendar(cal)) {
    return {
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      day: parseInt(match[3], 10),
    };
  }
  try {
    return convertFromIso8601(gregorianIso, cal);
  } catch {
    return null;
  }
};

/**
 * Convert a calendar-local date string (yyyy-MM-dd in that calendar) to Gregorian ISO.
 */
export const toGregorianISO = (
  calendarDate: string,
  calendar: string | undefined | null
): string => {
  if (!calendarDate) {
    return '';
  }
  const match = calendarDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return '';
  }
  const local = `${match[1]}-${match[2]}-${match[3]}`;
  const cal = resolveCalendar(calendar);
  if (isGregorianCalendar(cal)) {
    return local;
  }
  try {
    const gregorian = convertToIso8601(local, cal);
    return calendarDateToString({
      year: gregorian.year,
      month: gregorian.month,
      day: gregorian.day,
    });
  } catch {
    return '';
  }
};

/**
 * Format a stored Gregorian ISO value for display in the given calendar.
 * Default pattern uses YYYY-MM-DD with calendar-local year/month/day.
 */
export const formatInCalendar = (
  iso: string | null | undefined,
  calendar: string | undefined | null,
  pattern = 'YYYY-MM-DD',
  _locale?: string
): string => {
  if (!iso) {
    return '';
  }
  const parts = fromGregorianISO(iso, calendar);
  if (!parts) {
    return '';
  }
  const year = parts.eraYear ?? parts.year;
  const yearStr = String(year);
  const month = pad2(parts.month);
  const day = pad2(parts.day);

  return pattern
    .replace(/YYYY/g, yearStr)
    .replace(/YY/g, yearStr.slice(-2))
    .replace(/MM/g, month)
    .replace(/DD/g, day);
};

/**
 * Parse a user-typed calendar-local string (using pattern tokens) to Gregorian ISO.
 */
export const parseCalendarInputToGregorianISO = (
  input: string,
  calendar: string | undefined | null,
  pattern = 'YYYY-MM-DD'
): string => {
  if (!input || !pattern) {
    return '';
  }

  const dayIndex = pattern.indexOf('DD');
  const monthIndex = pattern.indexOf('MM');
  const yearIndex = pattern.indexOf('YYYY');
  const yearShortIndex = pattern.indexOf('YY');

  if (dayIndex === -1 || monthIndex === -1 || (yearIndex === -1 && yearShortIndex === -1)) {
    // Fall back to ISO-shaped input
    return toGregorianISO(input, calendar);
  }

  try {
    let day = '';
    let month = '';
    let year = '';

    if (dayIndex !== -1) {
      day = input.substring(dayIndex, dayIndex + 2);
    }
    if (monthIndex !== -1) {
      month = input.substring(monthIndex, monthIndex + 2);
    }
    if (yearIndex !== -1) {
      year = input.substring(yearIndex, yearIndex + 4);
    } else if (yearShortIndex !== -1) {
      const yearShort = input.substring(yearShortIndex, yearShortIndex + 2);
      const currentParts = fromGregorianISO(
        new Date().toISOString().slice(0, 10),
        calendar
      );
      const currentYear = currentParts
        ? currentParts.eraYear ?? currentParts.year
        : new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      const parsedYear = parseInt(yearShort, 10);
      year = String(
        parsedYear <= 50 ? century + parsedYear : century - 100 + parsedYear
      );
    }

    if (!day || !month || !year) {
      return '';
    }
    return toGregorianISO(`${year}-${month}-${day}`, calendar);
  } catch {
    return '';
  }
};
