import { describe, expect, it } from 'vitest';
import {
  formatInCalendar,
  fromGregorianISO,
  isGregorianCalendar,
  parseCalendarInputToGregorianISO,
  resolveCalendar,
  toGregorianISO,
} from './calendarDates';

describe('calendarDates', () => {
  it('resolves common calendar aliases', () => {
    expect(resolveCalendar('ethiopian')).toBe('ethiopic');
    expect(resolveCalendar('gregorian')).toBe('gregory');
    expect(resolveCalendar(undefined)).toBe('gregory');
  });

  it('treats gregory/iso8601 as Gregorian', () => {
    expect(isGregorianCalendar(undefined)).toBe(true);
    expect(isGregorianCalendar('gregory')).toBe(true);
    expect(isGregorianCalendar('iso8601')).toBe(true);
    expect(isGregorianCalendar('ethiopic')).toBe(false);
  });

  it('converts Ethiopic Meskerem 1 2017 to Gregorian 2024-09-11', () => {
    expect(toGregorianISO('2017-01-01', 'ethiopic')).toBe('2024-09-11');
  });

  it('converts Gregorian 2024-09-11 to Ethiopic 2017-01-01', () => {
    const parts = fromGregorianISO('2024-09-11', 'ethiopic');
    expect(parts).not.toBeNull();
    expect(parts!.eraYear ?? parts!.year).toBe(2017);
    expect(parts!.month).toBe(1);
    expect(parts!.day).toBe(1);
  });

  it('round-trips Ethiopic through Gregorian ISO', () => {
    const iso = toGregorianISO('2016-05-15', 'ethiopic');
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const formatted = formatInCalendar(iso, 'ethiopic', 'YYYY-MM-DD');
    expect(formatted).toBe('2016-05-15');
  });

  it('round-trips Islamic through Gregorian ISO', () => {
    const parts = fromGregorianISO('2024-03-10', 'islamic');
    expect(parts).not.toBeNull();
    const local = `${parts!.eraYear ?? parts!.year}-${String(parts!.month).padStart(2, '0')}-${String(parts!.day).padStart(2, '0')}`;
    expect(toGregorianISO(local, 'islamic')).toBe('2024-03-10');
  });

  it('round-trips Nepali through Gregorian ISO', () => {
    const parts = fromGregorianISO('2024-04-14', 'nepali');
    expect(parts).not.toBeNull();
    const local = `${parts!.eraYear ?? parts!.year}-${String(parts!.month).padStart(2, '0')}-${String(parts!.day).padStart(2, '0')}`;
    expect(toGregorianISO(local, 'nepali')).toBe('2024-04-14');
  });

  it('parses typed Ethiopic input to Gregorian ISO', () => {
    expect(parseCalendarInputToGregorianISO('01/01/2017', 'ethiopic', 'DD/MM/YYYY')).toBe(
      '2024-09-11'
    );
  });

  it('parses unpadded day/month for non-ISO patterns', () => {
    expect(parseCalendarInputToGregorianISO('1/1/2017', 'ethiopic', 'DD/MM/YYYY')).toBe(
      '2024-09-11'
    );
    expect(parseCalendarInputToGregorianISO('1/01/2017', 'ethiopic', 'DD/MM/YYYY')).toBe(
      '2024-09-11'
    );
  });

  it('parses YYYY-MM-DD with unpadded month/day', () => {
    expect(parseCalendarInputToGregorianISO('2017-1-1', 'ethiopic', 'YYYY-MM-DD')).toBe(
      '2024-09-11'
    );
  });

  it('trims whitespace around typed calendar dates', () => {
    expect(parseCalendarInputToGregorianISO('  01/01/2017  ', 'ethiopic', 'DD/MM/YYYY')).toBe(
      '2024-09-11'
    );
  });

  it('returns empty for garbage manual input that does not match the pattern', () => {
    expect(parseCalendarInputToGregorianISO('not-a-date', 'ethiopic', 'DD/MM/YYYY')).toBe('');
    expect(parseCalendarInputToGregorianISO('01-01-2017', 'ethiopic', 'DD/MM/YYYY')).toBe('');
  });

  it('leaves Gregorian ISO unchanged for gregory calendar', () => {
    expect(toGregorianISO('2024-09-11', 'gregory')).toBe('2024-09-11');
    expect(formatInCalendar('2024-09-11', 'gregory', 'YYYY-MM-DD')).toBe('2024-09-11');
  });
});
