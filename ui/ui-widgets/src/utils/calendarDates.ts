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

type DatePatternToken =
  | { kind: 'YYYY' }
  | { kind: 'YY' }
  | { kind: 'MM' }
  | { kind: 'DD' }
  | { kind: 'lit'; value: string };

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Tokenize a date format pattern into YYYY/YY/MM/DD and literal separators.
 * Longer year token (YYYY) is matched before YY.
 */
export const tokenizeDatePattern = (pattern: string): DatePatternToken[] => {
  const tokens: DatePatternToken[] = [];
  let i = 0;
  while (i < pattern.length) {
    if (pattern.startsWith('YYYY', i)) {
      tokens.push({ kind: 'YYYY' });
      i += 4;
      continue;
    }
    if (pattern.startsWith('YY', i)) {
      tokens.push({ kind: 'YY' });
      i += 2;
      continue;
    }
    if (pattern.startsWith('MM', i)) {
      tokens.push({ kind: 'MM' });
      i += 2;
      continue;
    }
    if (pattern.startsWith('DD', i)) {
      tokens.push({ kind: 'DD' });
      i += 2;
      continue;
    }
    let literal = '';
    while (
      i < pattern.length &&
      !pattern.startsWith('YYYY', i) &&
      !pattern.startsWith('YY', i) &&
      !pattern.startsWith('MM', i) &&
      !pattern.startsWith('DD', i)
    ) {
      literal += pattern[i];
      i += 1;
    }
    if (literal) {
      tokens.push({ kind: 'lit', value: literal });
    }
  }
  return tokens;
};

/**
 * Extract day/month/year from a user-typed string using pattern tokens.
 * Day/month accept 1–2 digits; YYYY is 4 digits; YY is 2 digits.
 */
export const extractDatePartsFromPattern = (
  input: string,
  pattern: string
): { day: number; month: number; year: number; yearIsShort: boolean } | null => {
  const trimmed = input.trim();
  if (!trimmed || !pattern) {
    return null;
  }

  const tokens = tokenizeDatePattern(pattern);
  const fieldKinds = tokens
    .filter(
      (t): t is Exclude<DatePatternToken, { kind: 'lit' }> => t.kind !== 'lit'
    )
    .map((t) => t.kind);

  if (
    !fieldKinds.includes('DD') ||
    !fieldKinds.includes('MM') ||
    !(fieldKinds.includes('YYYY') || fieldKinds.includes('YY'))
  ) {
    return null;
  }

  let source = '';
  for (const token of tokens) {
    if (token.kind === 'YYYY') {
      source += '(\\d{4})';
    } else if (token.kind === 'YY') {
      source += '(\\d{2})';
    } else if (token.kind === 'MM' || token.kind === 'DD') {
      source += '(\\d{1,2})';
    } else {
      // Allow flexible whitespace around/within literal separators.
      const lit = escapeRegExp(token.value).replace(/\\\s+/g, '\\s+');
      source += lit.replace(/ +/g, '\\s+');
    }
  }

  const match = trimmed.match(new RegExp(`^${source}$`));
  if (!match) {
    return null;
  }

  let day: number | undefined;
  let month: number | undefined;
  let year: number | undefined;
  let yearIsShort = false;
  let groupIndex = 1;
  for (const kind of fieldKinds) {
    const raw = match[groupIndex++];
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {
      return null;
    }
    if (kind === 'DD') {
      day = n;
    } else if (kind === 'MM') {
      month = n;
    } else if (kind === 'YYYY') {
      year = n;
    } else if (kind === 'YY') {
      year = n;
      yearIsShort = true;
    }
  }

  if (day == null || month == null || year == null) {
    return null;
  }
  if (day < 1 || day > 31 || month < 1 || month > 13) {
    return null;
  }

  return { day, month, year, yearIsShort };
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

  const parts = extractDatePartsFromPattern(input, pattern);
  if (!parts) {
    // Fall back to ISO-shaped input (YYYY-MM-DD)
    return toGregorianISO(input.trim(), calendar);
  }

  try {
    let year = parts.year;
    if (parts.yearIsShort) {
      const currentParts = fromGregorianISO(
        new Date().toISOString().slice(0, 10),
        calendar
      );
      const currentYear = currentParts
        ? currentParts.eraYear ?? currentParts.year
        : new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      // 00-50 → current century; 51-99 → previous century
      year = parts.year <= 50 ? century + parts.year : century - 100 + parts.year;
    }

    return toGregorianISO(
      `${year}-${pad2(parts.month)}-${pad2(parts.day)}`,
      calendar
    );
  } catch {
    return '';
  }
};
