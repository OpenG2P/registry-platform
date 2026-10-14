import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDatePicker } from '@dhis2/multi-calendar-dates';
import {
  formatInCalendar,
  fromGregorianISO,
  isGregorianCalendar,
  resolveCalendar,
  toGregorianISO,
} from '../utils/calendarDates';

export interface MultiCalendarDatePickerProps {
  /** Stored Gregorian ISO YYYY-MM-DD */
  value: string;
  calendar: string;
  locale?: string;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  placeholder?: string;
  hasError?: boolean;
  title?: string;
  className?: string;
  onChange: (gregorianISO: string) => void;
  onBlur?: () => void;
}

/**
 * Thin multi-calendar date picker.
 * Always emits / consumes Gregorian ISO for the form value.
 */
export const MultiCalendarDatePicker = ({
  value,
  calendar,
  locale = 'en',
  minDate,
  maxDate,
  disabled = false,
  placeholder,
  hasError = false,
  title,
  className = '',
  onChange,
  onBlur,
}: MultiCalendarDatePickerProps) => {
  const resolvedCalendar = resolveCalendar(calendar);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const calendarDateString = useMemo(() => {
    if (!value) {
      return '';
    }
    const parts = fromGregorianISO(value, resolvedCalendar);
    if (!parts) {
      return '';
    }
    const year = parts.eraYear ?? parts.year;
    return `${year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  }, [value, resolvedCalendar]);

  const displayLabel = useMemo(
    () => (value ? formatInCalendar(value, resolvedCalendar, 'YYYY-MM-DD', locale) : ''),
    [value, resolvedCalendar, locale]
  );

  const handleDateSelect = useCallback(
    (payload: { calendarDateString: string } | null) => {
      if (!payload?.calendarDateString) {
        onChange('');
        setOpen(false);
        return;
      }
      const gregorian = toGregorianISO(payload.calendarDateString, resolvedCalendar);
      if (gregorian) {
        onChange(gregorian);
      }
      setOpen(false);
    },
    [onChange, resolvedCalendar]
  );

  const pickerOptions = useMemo(
    () => ({
      calendar: resolvedCalendar,
      locale,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }),
    [resolvedCalendar, locale]
  );

  const {
    weekDayLabels,
    calendarWeekDays,
    currMonth,
    currYear,
    prevMonth,
    nextMonth,
    prevYear,
    nextYear,
    months,
    years,
    navigateToMonth,
    navigateToYear,
  } = useDatePicker({
    date: calendarDateString,
    options: pickerOptions,
    onDateSelect: handleDateSelect,
    minDate,
    maxDate,
    format: 'YYYY-MM-DD',
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        onBlur?.();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, onBlur]);

  const isDayDisabled = useCallback(
    (dayCalendarDate: string): boolean => {
      const gregorian = toGregorianISO(dayCalendarDate, resolvedCalendar);
      if (!gregorian) {
        return true;
      }
      if (minDate && gregorian < minDate) {
        return true;
      }
      if (maxDate && gregorian > maxDate) {
        return true;
      }
      return false;
    },
    [resolvedCalendar, minDate, maxDate]
  );

  // Gregorian calendars should use the native path in DateInputWidget; this is a safety net.
  if (isGregorianCalendar(resolvedCalendar)) {
    return null;
  }

  return (
    <div ref={rootRef} className={`relative inline-block w-full sm:w-[220px] max-w-full ${className}`}>
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => !prev);
          }
        }}
        onBlur={() => {
          // blur handled on outside click so picker clicks don't fire early
        }}
        className={`w-full h-[30px] px-3 border shadow-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          hasError
            ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
        style={{ borderRadius: '10px' }}
      >
        <span className={displayLabel ? 'text-gray-900' : 'text-gray-400'}>
          {displayLabel || placeholder || 'YYYY-MM-DD'}
        </span>
      </button>

      {open && !disabled && (
        <div
          className="absolute z-50 mt-1 p-3 bg-white border border-gray-200 shadow-lg"
          style={{ borderRadius: '10px', minWidth: '260px' }}
          role="dialog"
          aria-label="Calendar"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <button
              type="button"
              className="px-2 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50"
              onClick={prevYear.navigateTo}
              aria-label="Previous year"
            >
              «
            </button>
            <button
              type="button"
              className="px-2 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50"
              onClick={prevMonth.navigateTo}
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="flex-1 flex items-center justify-center gap-1">
              <select
                className="text-sm border border-gray-200 rounded px-1 py-0.5 max-w-[110px]"
                value={String(
                  months.find((m) => m.label === currMonth.label)?.value ??
                    months[0]?.value ??
                    ''
                )}
                onChange={(e) => navigateToMonth(Number(e.target.value))}
                aria-label="Month"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                className="text-sm border border-gray-200 rounded px-1 py-0.5"
                value={String(currYear.value)}
                onChange={(e) => navigateToYear(Number(e.target.value))}
                aria-label="Year"
              >
                {years.map((y) => (
                  <option key={y.value} value={y.value}>
                    {y.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="px-2 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50"
              onClick={nextMonth.navigateTo}
              aria-label="Next month"
            >
              ›
            </button>
            <button
              type="button"
              className="px-2 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50"
              onClick={nextYear.navigateTo}
              aria-label="Next year"
            >
              »
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-gray-500 mb-1">
            {weekDayLabels.map((label, index) => (
              <div key={`${label}-${index}`} className="py-1 font-medium">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-sm">
            {calendarWeekDays.flat().map((day) => {
              const disabledDay = isDayDisabled(day.dateValue);
              return (
                <button
                  key={day.dateValue}
                  type="button"
                  disabled={disabledDay}
                  onClick={() => {
                    if (!disabledDay) {
                      day.onClick();
                    }
                  }}
                  className={`h-8 rounded ${
                    day.isSelected
                      ? 'bg-blue-600 text-white'
                      : day.isToday
                        ? 'border border-blue-400 text-blue-700'
                        : day.isInCurrentMonth
                          ? 'text-gray-900 hover:bg-gray-100'
                          : 'text-gray-300'
                  } ${disabledDay ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between mt-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              className="text-xs text-gray-600 hover:underline"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="text-xs text-gray-600 hover:underline"
              onClick={() => {
                setOpen(false);
                onBlur?.();
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
