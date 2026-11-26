import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { tSchema } from '../utils/tSchema';
import { useWidgetContext } from '../components/WidgetProvider';
import { useSelector } from 'react-redux';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetFieldLabel } from '../components/WidgetFieldLabel';
import { owtFieldInputClass } from '../theme';
import { MultiCalendarDatePicker } from '../components/MultiCalendarDatePicker';
import { WidgetRootState } from '../store';
import { getValueByPath } from '../utils/pathUtils';
import { useOwtThemeRootProps } from '../hooks/useWidgetTheme';
import { calendarIcon, arrowDownIcon } from '../assets';
import {
  parseDate,
  formatDateToISO,
  formatDateToString,
  parseDateFromFormat,
  getMinDate,
  getMaxDate,
  validateDateConstraints,
  resolveDateBoundFromFieldValue,
  mergeMinDateBounds,
  mergeMaxDateBounds,
} from '../utils/dateInput';
import {
  formatInCalendar,
  isGregorianCalendar,
  parseCalendarInputToGregorianISO,
  resolveCalendar,
} from '../utils/calendarDates';

const pickerDayToIso = (year: number, month: number, day: number): string => {
  const monthText = String(month + 1).padStart(2, '0');
  const dayText = String(day).padStart(2, '0');
  return `${year}-${monthText}-${dayText}`;
};

type DateSegmentKey = 'DD' | 'MM' | 'YYYY';
type DateSegments = Record<DateSegmentKey, string>;

const SEGMENT_LENGTH: Record<DateSegmentKey, number> = { DD: 2, MM: 2, YYYY: 4 };
const SEGMENT_WIDTH: Record<DateSegmentKey, string> = { DD: '1.35em', MM: '1.78em', YYYY: '2.45em' };
const parseSegmentLayout = (format: string): { keys: DateSegmentKey[]; separator: string } => {
  const keys = (format.match(/YYYY|YY|MM|DD/g) ?? []).map((token) =>
    token === 'YY' ? 'YYYY' : (token as DateSegmentKey)
  );
  if (keys.length !== 3 || new Set(keys).size !== 3) {
    return { keys: ['DD', 'MM', 'YYYY'], separator: '/' };
  }
  return { keys, separator: format.match(/[^A-Za-z]/)?.[0] ?? '/' };
};

const isoToSegments = (iso: string): DateSegments => {
  const [year = '', month = '', day = ''] = iso ? iso.split('-') : [];
  return { YYYY: year, MM: month, DD: day };
};

const padSegment = (text: string): string => (text.length === 1 ? `0${text}` : text);

const segmentsToIso = (segments: DateSegments): string | null => {
  if (
    segments.YYYY.length !== 4 ||
    segments.YYYY.startsWith('0') ||
    segments.MM.length !== 2 ||
    segments.DD.length !== 2
  ) {
    return null;
  }
  const year = Number(segments.YYYY);
  const month = Number(segments.MM) - 1;
  const day = Number(segments.DD);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return pickerDayToIso(year, month, day);
};

interface DateSegmentsInputProps {
  format: string;
  iso: string;
  disabled: boolean;
  className: string;
  title?: string;
  segmentLabels: Record<DateSegmentKey, string>;
  openCalendarLabel: string;
  onCommit: (iso: string | null) => void;
  onBlur: () => void;
  onTogglePicker: () => void;
}

const DateSegmentsInput = ({
  format,
  iso,
  disabled,
  className,
  title,
  segmentLabels,
  openCalendarLabel,
  onCommit,
  onBlur,
  onTogglePicker,
}: DateSegmentsInputProps) => {
  const { keys, separator } = useMemo(() => parseSegmentLayout(format), [format]);
  const [segments, setSegments] = useState<DateSegments>(() => isoToSegments(iso));
  const containerRef = useRef<HTMLDivElement>(null);
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (containerRef.current?.contains(document.activeElement)) return;
    setSegments(isoToSegments(iso));
  }, [iso]);

  const focusSegment = (index: number) => {
    const input = inputRefs.current[index];
    if (!input) return;
    input.focus();
    input.select();
  };

  const updateSegment = (index: number, raw: string, advance = true) => {
    const key = keys[index];
    const digits = raw.replace(/\D/g, '').slice(0, SEGMENT_LENGTH[key]);
    const next = { ...segments, [key]: digits };
    setSegments(next);
    const nextIso = segmentsToIso(next);
    if (nextIso) onCommit(nextIso);
    if (advance && digits.length === SEGMENT_LENGTH[key]) focusSegment(index + 1);
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd = input.selectionStart === input.value.length;
    const length = SEGMENT_LENGTH[keys[index]];
    const hasSelection = input.selectionStart !== input.selectionEnd;
    if (/^\d$/.test(event.key) && !hasSelection && input.value.length >= length) {
      // Full segment: shift digits left so typing "2003" over "2002" yields "2003".
      event.preventDefault();
      updateSegment(index, (input.value + event.key).slice(-length), false);
    } else if (event.key === separator) {
      event.preventDefault();
      focusSegment(index + 1);
    } else if (event.key === 'Backspace' && input.value === '' && index > 0) {
      event.preventDefault();
      focusSegment(index - 1);
    } else if (event.key === 'ArrowLeft' && atStart && index > 0) {
      event.preventDefault();
      focusSegment(index - 1);
    } else if (event.key === 'ArrowRight' && atEnd && index < keys.length - 1) {
      event.preventDefault();
      focusSegment(index + 1);
    }
  };

  const handleGroupBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (containerRef.current?.contains(event.relatedTarget as Node | null)) return;
    const padded = { ...segments, DD: padSegment(segments.DD), MM: padSegment(segments.MM) };
    if (!padded.DD && !padded.MM && !padded.YYYY) {
      onCommit(null);
    } else {
      const nextIso = segmentsToIso(padded);
      if (nextIso) {
        setSegments(padded);
        onCommit(nextIso);
      } else {
        setSegments(isoToSegments(iso));
      }
    }
    // Run after the committed value renders, so blur validation sees the new date.
    window.setTimeout(() => onBlurRef.current(), 0);
  };

  return (
    <div
      ref={containerRef}
      title={title}
      className={`${className} flex items-center ${disabled ? '' : 'cursor-text'}`}
      style={{ borderRadius: '10px', fontSize: 14, paddingLeft: 6, paddingRight: 6 }}
      onBlur={handleGroupBlur}
      onMouseDown={(event) => {
        if (disabled || event.target !== event.currentTarget) return;
        event.preventDefault();
        const firstEmpty = keys.findIndex((key) => !segments[key]);
        focusSegment(firstEmpty === -1 ? 0 : firstEmpty);
      }}
    >
      {keys.map((key, index) => (
        <React.Fragment key={key}>
          {index > 0 ? (
            <span aria-hidden="true" className="select-none">
              {separator}
            </span>
          ) : null}
          <input
            ref={(element) => {
              inputRefs.current[index] = element;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-label={segmentLabels[key]}
            placeholder={key}
            value={segments[key]}
            disabled={disabled}
            className="bg-transparent p-0 text-center disabled:cursor-not-allowed"
            style={{
              width: segments[key] ? `${SEGMENT_LENGTH[key] + 0.3}ch` : SEGMENT_WIDTH[key],
              flexShrink: 0,
              border: 'none',
              outline: 'none',
              color: 'inherit',
              fontVariantNumeric: 'lining-nums tabular-nums',
            }}
            onFocus={(event) => event.target.select()}
            onChange={(event) => updateSegment(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
          />
        </React.Fragment>
      ))}
      <button
        type="button"
        aria-label={openCalendarLabel}
        disabled={disabled}
        className="ml-auto flex shrink-0 items-center justify-center pl-0.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onTogglePicker}
      >
        <img
          src={calendarIcon}
          alt=""
          width={14}
          height={14}
          draggable={false}
          style={{ filter: 'brightness(0)' }}
        />
      </button>
    </div>
  );
};

const getFixedHeaderBottom = (): number => {
  let bottom = 0;
  document.querySelectorAll<HTMLElement>('header, [role="banner"]').forEach((element) => {
    const { position } = window.getComputedStyle(element);
    if (position !== 'fixed' && position !== 'sticky') return;
    const rect = element.getBoundingClientRect();
    if (rect.top <= 1 && rect.bottom > bottom) bottom = rect.bottom;
  });
  return bottom;
};

const PICKER_POPUP_WIDTH = 300;
const PICKER_POPUP_HEIGHT = 360;

const CHEVRON_ROTATION = { left: 90, right: -90, down: 0 };

const ChevronIcon = ({ direction }: { direction: 'left' | 'right' | 'down' }) => (
  <img
    src={arrowDownIcon}
    alt=""
    aria-hidden="true"
    width={direction === 'down' ? 10 : 12}
    height={direction === 'down' ? 10 : 12}
    draggable={false}
    className="shrink-0 object-contain"
    style={{ transform: `rotate(${CHEVRON_ROTATION[direction]}deg)` }}
  />
);

interface CalendarNavProps {
  label: string;
  valueLabel: string;
  open: boolean;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  prevAriaLabel: string;
  nextAriaLabel: string;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  menuRef?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}

const CalendarNav = ({
  label,
  valueLabel,
  open,
  onToggle,
  onPrev,
  onNext,
  prevAriaLabel,
  nextAriaLabel,
  prevDisabled,
  nextDisabled,
  menuRef,
  children,
}: CalendarNavProps) => (
  <div className="relative flex items-center">
    <button
      type="button"
      aria-label={prevAriaLabel}
      className="owt-date-nav inline-flex h-7 w-7 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-30"
      style={{ color: 'var(--owt-color-text)' }}
      disabled={prevDisabled}
      onClick={onPrev}
    >
      <ChevronIcon direction="left" />
    </button>
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      aria-haspopup="listbox"
      className="owt-date-nav inline-flex h-7 items-center gap-0.5 rounded-full px-1.5 text-sm font-medium"
      style={{ color: 'var(--owt-color-text)' }}
      onClick={onToggle}
    >
      <span>{valueLabel}</span>
      <ChevronIcon direction="down" />
    </button>
    <button
      type="button"
      aria-label={nextAriaLabel}
      className="owt-date-nav inline-flex h-7 w-7 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-30"
      style={{ color: 'var(--owt-color-text)' }}
      disabled={nextDisabled}
      onClick={onNext}
    >
      <ChevronIcon direction="right" />
    </button>
    {open ? (
      <div
        ref={menuRef}
        role="listbox"
        aria-label={label}
        className="absolute left-1/2 top-full z-20 mt-1 w-max min-w-[7.5rem] max-w-[11rem] -translate-x-1/2 overflow-y-auto owt-shadow-lg"
        style={{
          maxHeight: '18rem',
          boxSizing: 'border-box',
          overscrollBehavior: 'contain',
          borderRadius: '10px',
          backgroundColor: '#ffffff',
          border: '1px solid var(--owt-color-border-light)',
          padding: 4,
        }}
      >
        {children}
      </div>
    ) : null}
  </div>
);

interface DateInputWidgetProps {
  config: BaseWidgetConfig;
}

export const DateInputWidget = ({ config }: DateInputWidgetProps) => {
  const {
    value,
    error,
    touched,
    isEnabled,
    isRequired,
    onChange,
    onBlur,
    setError,
    config: widgetConfig,
  } = useBaseWidget({ config });

  const formValues = useSelector((state: WidgetRootState) => state.widget.values);
  const { t } = useWidgetContext();
  const themeRoot = useOwtThemeRootProps();

  const formatConfig = widgetConfig['widget-data-format'];
  const optionsConfig = widgetConfig['widget-data-options'];
  const dateFormat = formatConfig?.dateFormat || 'YYYY-MM-DD';
  const inputMethod = formatConfig?.inputMethod || 'picker';
  const dateConstraint = formatConfig?.dateConstraint || 'any';
  const calendar = resolveCalendar(formatConfig?.calendar);
  const useMultiCalendar = !isGregorianCalendar(calendar);
  const locale = formatConfig?.locale || 'en';
  const minDate = optionsConfig?.minDate;
  const maxDate = optionsConfig?.maxDate;
  const minDateField = optionsConfig?.minDateField as string | undefined;
  const maxDateField = optionsConfig?.maxDateField as string | undefined;
  const minDateMessage = optionsConfig?.minDateMessage
    ? tSchema(t, optionsConfig.minDateMessage)
    : undefined;
  const maxDateMessage = optionsConfig?.maxDateMessage
    ? tSchema(t, optionsConfig.maxDateMessage)
    : undefined;
  const defaultToToday = widgetConfig['widget-data-default'] === 'today';

  const [manualInputValue, setManualInputValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMenu, setPickerMenu] = useState<'month' | 'year' | null>(null);
  const [draftIso, setDraftIso] = useState<string | null>(null);
  const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const pickerTriggerRef = useRef<HTMLDivElement>(null);
  const pickerPopupRef = useRef<HTMLDivElement>(null);
  const monthMenuRef = useRef<HTMLDivElement>(null);
  const yearMenuRef = useRef<HTMLDivElement>(null);
  const pickerIso = value ? formatDateToISO(value) : '';
  const pickerSelected = pickerIso ? parseDate(pickerIso) : null;
  const [viewYear, setViewYear] = useState(() => (pickerSelected ?? new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (pickerSelected ?? new Date()).getMonth());

  const fieldMinDate = useMemo(() => {
    if (!minDateField) {
      return undefined;
    }
    return resolveDateBoundFromFieldValue(getValueByPath(formValues, minDateField));
  }, [formValues, minDateField]);

  const fieldMaxDate = useMemo(() => {
    if (!maxDateField) {
      return undefined;
    }
    return resolveDateBoundFromFieldValue(getValueByPath(formValues, maxDateField));
  }, [formValues, maxDateField]);

  const effectiveMinDate = useMemo(() => {
    const staticMin = getMinDate(dateConstraint, minDate);
    return mergeMinDateBounds(staticMin, fieldMinDate);
  }, [dateConstraint, minDate, fieldMinDate]);

  const effectiveMaxDate = useMemo(() => {
    const staticMax = getMaxDate(dateConstraint, maxDate);
    return mergeMaxDateBounds(staticMax, fieldMaxDate);
  }, [dateConstraint, maxDate, fieldMaxDate]);

  const constraintMessages = useMemo(
    () => ({
      minDateMessage,
      maxDateMessage,
      pastOnlyMessage:
        t?.('common.dateMustBeInPast', { defaultValue: 'Date must be in the past' }) ||
        'Date must be in the past',
      futureOnlyMessage:
        t?.('common.dateMustBeInFuture', { defaultValue: 'Date must be in the future' }) ||
        'Date must be in the future',
    }),
    [minDateMessage, maxDateMessage, t]
  );

  const dayLabel = t?.('common.day', { defaultValue: 'Day' }) || 'Day';
  const monthLabel = t?.('common.month', { defaultValue: 'Month' }) || 'Month';
  const yearLabel = t?.('common.year', { defaultValue: 'Year' }) || 'Year';
  const openCalendarLabel =
    t?.('common.openCalendar', { defaultValue: 'Open calendar' }) || 'Open calendar';
  const clearLabel = t?.('common.clear', { defaultValue: 'Clear' }) || 'Clear';
  const cancelLabel = t?.('common.cancel', { defaultValue: 'Cancel' }) || 'Cancel';
  const okLabel = t?.('common.ok', { defaultValue: 'OK' }) || 'OK';
  const segmentLabels = useMemo(
    () => ({ DD: dayLabel, MM: monthLabel, YYYY: yearLabel }),
    [dayLabel, monthLabel, yearLabel]
  );

  const runDateConstraintValidation = useCallback(
    (dateValue: string | Date | null | undefined): string | null => {
      if (!dateValue) {
        return null;
      }
      return validateDateConstraints(
        dateValue,
        effectiveMinDate,
        effectiveMaxDate,
        dateConstraint,
        constraintMessages
      );
    },
    [effectiveMinDate, effectiveMaxDate, dateConstraint, constraintMessages]
  );

  const reapplyConstraintError = useCallback(
    (dateValue: string | Date | null | undefined = value) => {
      if (!dateValue) {
        return;
      }
      const constraintError = runDateConstraintValidation(dateValue);
      setError(constraintError ? [constraintError] : []);
    },
    [value, runDateConstraintValidation, setError]
  );

  const pickerMonths = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) =>
        new Date(2020, index, 1).toLocaleDateString(locale, { month: 'long' })
      ),
    [locale]
  );

  const pickerMonthShort = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) =>
        new Date(2020, index, 1).toLocaleDateString(locale, { month: 'short' })
      ),
    [locale]
  );

  const pickerWeekdays = useMemo(() => {
    const sunday = new Date(2020, 5, 7);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + index);
      return date.toLocaleDateString(locale, { weekday: 'narrow' });
    });
  }, [locale]);

  const pickerSelectedYear = pickerSelected?.getFullYear();
  const { pickerYearStart, pickerYearEnd } = useMemo(() => {
    const now = new Date().getFullYear();
    let start = effectiveMinDate ? Number(effectiveMinDate.slice(0, 4)) : now - 120;
    let end = effectiveMaxDate ? Number(effectiveMaxDate.slice(0, 4)) : now + 20;
    if (pickerSelectedYear != null) {
      start = Math.min(start, pickerSelectedYear);
      end = Math.max(end, pickerSelectedYear);
    }
    if (!Number.isFinite(start)) start = now - 120;
    if (!Number.isFinite(end)) end = now + 20;
    if (end < start) end = start;
    return { pickerYearStart: start, pickerYearEnd: end };
  }, [effectiveMinDate, effectiveMaxDate, pickerSelectedYear]);

  const pickerYears = useMemo(() => {
    const list: number[] = [];
    for (let year = pickerYearStart; year <= pickerYearEnd; year += 1) {
      list.push(year);
    }
    return list;
  }, [pickerYearStart, pickerYearEnd]);

  const updatePickerPosition = useCallback(() => {
    const trigger = pickerTriggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = PICKER_POPUP_WIDTH;
    const height = PICKER_POPUP_HEIGHT;
    const gap = 4;
    const topBoundary = getFixedHeaderBottom() + 8;
    const bottomBoundary = window.innerHeight - 8;
    const below = rect.bottom + gap;
    const above = rect.top - height - gap;
    let top: number;
    if (below + height <= bottomBoundary) {
      top = below;
    } else if (above >= topBoundary) {
      top = above;
    } else {
      top = Math.max(topBoundary, Math.min(below, bottomBoundary - height));
    }
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setPickerPosition({ top, left });
  }, []);

  const openPickerCalendar = useCallback(() => {
    const base = (pickerIso ? parseDate(pickerIso) : null) ?? new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setDraftIso(pickerIso || null);
    setPickerOpen(true);
  }, [pickerIso]);

  const moveCalendar = useCallback(
    (monthDelta: number) => {
      const next = new Date(viewYear, viewMonth + monthDelta, 1);
      const year = next.getFullYear();
      if (year < pickerYearStart || year > pickerYearEnd) return;
      setPickerMenu(null);
      setViewYear(year);
      setViewMonth(next.getMonth());
    },
    [viewYear, viewMonth, pickerYearStart, pickerYearEnd]
  );

  useEffect(() => {
    if (!pickerOpen) return;
    updatePickerPosition();
  }, [pickerOpen, updatePickerPosition]);

  useEffect(() => {
    if (!pickerOpen) {
      setPickerMenu(null);
    }
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen || !pickerIso) return;
    const typed = parseDate(pickerIso);
    if (!typed) return;
    setDraftIso(pickerIso);
    setViewYear(typed.getFullYear());
    setViewMonth(typed.getMonth());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerIso]);

  useEffect(() => {
    if (!pickerMenu) return;
    const menu = pickerMenu === 'year' ? yearMenuRef.current : monthMenuRef.current;
    const selected = menu?.querySelector<HTMLElement>('[data-selected="true"]');
    if (!menu || !selected) return;
    menu.scrollTop = selected.offsetTop - menu.clientHeight / 2 + selected.offsetHeight / 2;
  }, [pickerMenu, viewYear, viewMonth]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onResize = () => updatePickerPosition();
    const closePicker = () => {
      setPickerOpen(false);
      onBlur();
      reapplyConstraintError(value);
    };
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && pickerPopupRef.current?.contains(target)) {
        return;
      }
      closePicker();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePicker();
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (pickerPopupRef.current?.contains(target) || pickerTriggerRef.current?.contains(target)) {
        return;
      }
      closePicker();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen, onBlur, updatePickerPosition, reapplyConstraintError, value]);

  const isPickerDayDisabled = useCallback(
    (iso: string) => {
      if (effectiveMinDate && iso < effectiveMinDate) return true;
      if (effectiveMaxDate && iso > effectiveMaxDate) return true;
      return false;
    },
    [effectiveMinDate, effectiveMaxDate]
  );

  useEffect(() => {
    if (defaultToToday && (value === null || value === undefined || value === '')) {
      const todayISO = formatDateToISO(new Date());
      onChange(todayISO);
    }
  }, [defaultToToday, value, onChange]);

  useEffect(() => {
    reapplyConstraintError(value);
  }, [fieldMinDate, fieldMaxDate, value, reapplyConstraintError]);

  const getDisplayValue = useCallback((): string => {
    if (isFocused && manualInputValue) {
      return manualInputValue;
    }

    if (!value) return '';

    if (useMultiCalendar) {
      return formatInCalendar(value, calendar, dateFormat, locale);
    }

    if (dateFormat === 'YYYY-MM-DD') {
      return formatDateToISO(value);
    }

    return formatDateToString(value, dateFormat);
  }, [value, dateFormat, isFocused, manualInputValue, useMultiCalendar, calendar, locale]);

  useEffect(() => {
    if (!isFocused && value) {
      if (useMultiCalendar) {
        setManualInputValue(formatInCalendar(value, calendar, dateFormat, locale));
      } else if (dateFormat === 'YYYY-MM-DD') {
        setManualInputValue(formatDateToISO(value));
      } else {
        setManualInputValue(formatDateToString(value, dateFormat));
      }
    }
  }, [value, dateFormat, isFocused, useMultiCalendar, calendar, locale]);

  const applyConstraintError = useCallback(
    (dateValue: string) => {
      const constraintError = runDateConstraintValidation(dateValue);
      setError(constraintError ? [constraintError] : []);
    },
    [runDateConstraintValidation, setError]
  );

  const blurAfterPickerChange = useRef(false);

  const commitPickerDate = useCallback(
    (iso: string | null) => {
      const currentIso = value ? formatDateToISO(value) : '';
      if ((iso ?? '') === currentIso) {
        setPickerOpen(false);
        onBlur();
        return;
      }
      blurAfterPickerChange.current = true;
      if (iso) {
        onChange(iso);
        applyConstraintError(iso);
      } else {
        onChange(null);
        setError([]);
      }
      setPickerOpen(false);
    },
    [value, onChange, onBlur, applyConstraintError, setError]
  );

  useEffect(() => {
    if (!blurAfterPickerChange.current) {
      return;
    }
    blurAfterPickerChange.current = false;
    onBlur();
    reapplyConstraintError(value);
  }, [value, onBlur, reapplyConstraintError]);

  const commitSegmentsDate = useCallback(
    (iso: string | null) => {
      if ((iso ?? '') === pickerIso) return;
      if (iso) {
        onChange(iso);
        applyConstraintError(iso);
      } else {
        onChange(null);
        setError([]);
      }
    },
    [pickerIso, onChange, applyConstraintError, setError]
  );

  const handleMultiCalendarChange = useCallback(
    (gregorianISO: string) => {
      onChange(gregorianISO === '' ? null : gregorianISO);
      if (gregorianISO) {
        applyConstraintError(gregorianISO);
      } else {
        setError([]);
      }
    },
    [onChange, applyConstraintError, setError]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      setManualInputValue(inputValue);

      if (inputValue) {
        const iso = useMultiCalendar
          ? parseCalendarInputToGregorianISO(inputValue, calendar, dateFormat)
          : (() => {
              const date = parseDateFromFormat(inputValue, dateFormat);
              return date ? formatDateToISO(date) : null;
            })();
        if (iso) {
          onChange(iso);
          applyConstraintError(iso);
        }
      } else {
        onChange(null);
        setError([]);
      }
    },
    [dateFormat, onChange, applyConstraintError, setError, useMultiCalendar, calendar]
  );

  const handleBlur = useCallback(() => {
    setIsFocused(false);

    if (useMultiCalendar && manualInputValue) {
      const iso = parseCalendarInputToGregorianISO(manualInputValue, calendar, dateFormat);
      if (iso) {
        setManualInputValue(formatInCalendar(iso, calendar, dateFormat, locale));
        onChange(iso);
        applyConstraintError(iso);
      } else {
        setManualInputValue('');
        onChange(null);
        setError([]);
      }
    } else if (manualInputValue) {
      const date = parseDateFromFormat(manualInputValue, dateFormat);
      if (date) {
        const formatted = formatDateToString(date, dateFormat);
        setManualInputValue(formatted);
        const iso = formatDateToISO(date);
        onChange(iso);
        applyConstraintError(iso);
      } else {
        setManualInputValue('');
        onChange(null);
        setError([]);
      }
    }

    // useBaseWidget onBlur overwrites errors with format/required checks only —
    // re-apply date constraints after it so past-only / bounds errors stay visible.
    onBlur();
    reapplyConstraintError(value);
  }, [
    manualInputValue,
    dateFormat,
    onChange,
    onBlur,
    applyConstraintError,
    value,
    reapplyConstraintError,
    setError,
    useMultiCalendar,
    calendar,
    locale,
  ]);

  const handleSegmentsBlur = useCallback(() => {
    onBlur();
    reapplyConstraintError(value);
  }, [onBlur, reapplyConstraintError, value]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (value) {
      if (useMultiCalendar) {
        setManualInputValue(formatInCalendar(value, calendar, dateFormat, locale));
      } else if (dateFormat === 'YYYY-MM-DD') {
        setManualInputValue(formatDateToISO(value));
      } else {
        setManualInputValue(formatDateToString(value, dateFormat));
      }
    }
  }, [value, dateFormat, useMultiCalendar, calendar, locale]);

  const placeholder = useMemo(() => {
    const display = getDisplayValue();
    const hasValue = display && display.trim().length > 0;
    const placeholderText = tSchema(t, widgetConfig['widget-data-placeholder']);
    return hasValue ? undefined : placeholderText || dateFormat;
  }, [getDisplayValue, widgetConfig, t, dateFormat]);

  const showRequiredError =
    widgetConfig['widget-required'] && (!value || value === '');
  const showValidationError = touched && error.length > 0;

  const pickerInputClass = owtFieldInputClass({
    error: showValidationError || showRequiredError,
    disabled: !isEnabled,
    className: 'w-full sm:w-[180px] max-w-full h-[30px] px-3 owt-shadow-sm',
  });

  const pickerFirstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const pickerDaysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const pickerTodayIso = pickerDayToIso(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate()
  );

  const atFirstMonth = viewYear === pickerYearStart && viewMonth === 0;
  const atLastMonth = viewYear === pickerYearEnd && viewMonth === 11;
  const menuOptionStyle = (selected: boolean): React.CSSProperties | undefined =>
    selected
      ? {
          backgroundColor: 'var(--owt-color-primary)',
          color: 'var(--owt-color-bg)',
          fontWeight: 600,
        }
      : { color: 'var(--owt-color-text)' };

  const pickerPopup =
    pickerOpen && pickerPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={pickerPopupRef}
            className={`${themeRoot.className} fixed z-[200] owt-shadow-lg p-4`}
            style={{
              ...themeRoot.style,
              top: pickerPosition.top,
              left: pickerPosition.left,
              width: PICKER_POPUP_WIDTH,
              borderRadius: '16px',
              backgroundColor: '#ffffff',
              color: 'var(--owt-color-text)',
              fontFamily: 'Roboto, sans-serif',
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <CalendarNav
                label={monthLabel}
                valueLabel={pickerMonthShort[viewMonth] ?? ''}
                open={pickerMenu === 'month'}
                onToggle={() => setPickerMenu((current) => (current === 'month' ? null : 'month'))}
                onPrev={() => moveCalendar(-1)}
                onNext={() => moveCalendar(1)}
                prevAriaLabel={
                  t?.('common.previousLabel', {
                    label: monthLabel,
                    defaultValue: `Previous ${monthLabel}`,
                  }) || `Previous ${monthLabel}`
                }
                nextAriaLabel={
                  t?.('common.nextLabel', {
                    label: monthLabel,
                    defaultValue: `Next ${monthLabel}`,
                  }) || `Next ${monthLabel}`
                }
                prevDisabled={atFirstMonth}
                nextDisabled={atLastMonth}
                menuRef={monthMenuRef}
              >
                {pickerMonths.map((label, index) => {
                  const selected = index === viewMonth;
                  return (
                    <button
                      key={label}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      data-selected={selected ? 'true' : undefined}
                      className="owt-date-option block h-7 w-full whitespace-nowrap rounded-md px-2 text-left text-sm"
                      style={menuOptionStyle(selected)}
                      onClick={() => {
                        setViewMonth(index);
                        setPickerMenu(null);
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </CalendarNav>
              <CalendarNav
                label={yearLabel}
                valueLabel={String(viewYear)}
                open={pickerMenu === 'year'}
                onToggle={() => setPickerMenu((current) => (current === 'year' ? null : 'year'))}
                onPrev={() => moveCalendar(-12)}
                onNext={() => moveCalendar(12)}
                prevAriaLabel={
                  t?.('common.previousLabel', {
                    label: yearLabel,
                    defaultValue: `Previous ${yearLabel}`,
                  }) || `Previous ${yearLabel}`
                }
                nextAriaLabel={
                  t?.('common.nextLabel', {
                    label: yearLabel,
                    defaultValue: `Next ${yearLabel}`,
                  }) || `Next ${yearLabel}`
                }
                prevDisabled={viewYear <= pickerYearStart}
                nextDisabled={viewYear >= pickerYearEnd}
                menuRef={yearMenuRef}
              >
                {pickerYears.map((year) => {
                  const selected = year === viewYear;
                  return (
                    <button
                      key={year}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      data-selected={selected ? 'true' : undefined}
                      className="owt-date-option block h-7 w-full rounded-md px-2 text-left text-sm"
                      style={menuOptionStyle(selected)}
                      onClick={() => {
                        setViewYear(year);
                        setPickerMenu(null);
                      }}
                    >
                      {year}
                    </button>
                  );
                })}
              </CalendarNav>
            </div>
            <div className="mb-1 grid grid-cols-7">
              {pickerWeekdays.map((label, index) => (
                <div
                  key={`${label}-${index}`}
                  className="h-8 text-center text-xs font-medium leading-8 owt-text-muted"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: pickerFirstWeekday }, (_, index) => (
                <span key={`pad-${index}`} className="h-9" />
              ))}
              {Array.from({ length: pickerDaysInMonth }, (_, index) => {
                const day = index + 1;
                const iso = pickerDayToIso(viewYear, viewMonth, day);
                const isSelected = iso === draftIso;
                const isToday = iso === pickerTodayIso;
                const dayDisabled = isPickerDayDisabled(iso);
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={dayDisabled}
                    data-selected={isSelected ? 'true' : undefined}
                    aria-pressed={isSelected}
                    className="owt-date-day mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm disabled:cursor-not-allowed disabled:opacity-30"
                    style={
                      isSelected
                        ? {
                            backgroundColor: 'var(--owt-color-primary)',
                            color: 'var(--owt-color-bg)',
                            fontWeight: 600,
                          }
                        : isToday
                          ? {
                              color: 'var(--owt-color-text)',
                              boxShadow: 'inset 0 0 0 1px var(--owt-color-primary)',
                            }
                          : { color: 'var(--owt-color-text)' }
                    }
                    onClick={() => setDraftIso(iso)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-end gap-1">
              {draftIso ? (
                <button
                  type="button"
                  className="owt-date-action mr-auto rounded-full px-3 py-1.5 text-sm"
                  style={{ color: 'var(--owt-color-text-muted)' }}
                  onClick={() => setDraftIso(null)}
                >
                  {clearLabel}
                </button>
              ) : null}
              <button
                type="button"
                className="owt-date-action rounded-full px-3 py-1.5 text-sm font-medium"
                style={{ color: 'var(--owt-color-primary)' }}
                onClick={() => {
                  setPickerOpen(false);
                  handleSegmentsBlur();
                }}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className="owt-date-action rounded-full px-3 py-1.5 text-sm font-semibold"
                style={{ color: 'var(--owt-color-primary)' }}
                onClick={() => commitPickerDate(draftIso)}
              >
                {okLabel}
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  if (widgetConfig['widget-readonly']) {
    const label = tSchema(t, widgetConfig['widget-label']);
    let displayValue = '';

    if (value) {
      if (useMultiCalendar) {
        displayValue = formatInCalendar(value, calendar, dateFormat, locale);
      } else if (dateFormat === 'YYYY-MM-DD') {
        displayValue = formatDateToISO(value);
      } else {
        displayValue = formatDateToString(value, dateFormat);
      }
    } else {
      displayValue = '-';
    }

    return (
      <div className="mb-[10px] DateDisplayWidget flex flex-col sm:flex-row sm:items-start">
        {label && (
          <div
            className="text-base owt-field-label font-medium md:min-w-[120px] sm:pr-4 mb-1 sm:mb-0"
            style={{ fontFamily: 'Roboto, sans-serif' }}
            title={label}
          >
            {label}:
          </div>
        )}
        <div className="flex-1">
          <div className="text-base owt-text font-medium" title={String(displayValue ?? '')}>
            {displayValue}
          </div>
          {useMultiCalendar && value ? (
            <div className="text-xs text-gray-500 mt-0.5">
              {t?.('common.gregorianValue', {
                date: typeof value === 'string' ? value.split('T')[0] : formatDateToISO(value),
                defaultValue: `(Gregorian): ${typeof value === 'string' ? value.split('T')[0] : formatDateToISO(value)}`,
              }) ||
                `(Gregorian): ${typeof value === 'string' ? value.split('T')[0] : formatDateToISO(value)}`}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const showPicker =
    useMultiCalendar && (inputMethod === 'picker' || inputMethod === 'hybrid');
  const showManual =
    !useMultiCalendar
      ? true
      : inputMethod === 'manual' || inputMethod === 'hybrid';

  return (
    <div className="mb-[10px]">
      <div className="flex flex-col sm:flex-row sm:items-start">
        <WidgetFieldLabel
          className="text-base font-medium owt-field-label md:min-w-[120px] sm:pr-4 sm:pt-1 mb-1 sm:mb-0"
          label={tSchema(t, widgetConfig['widget-label'])}
          required={isRequired}
        />
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {useMultiCalendar ? (
            <>
              {showPicker && (
                <MultiCalendarDatePicker
                  value={value ? formatDateToISO(value) : ''}
                  calendar={calendar}
                  locale={locale}
                  minDate={effectiveMinDate}
                  maxDate={effectiveMaxDate}
                  disabled={!isEnabled}
                  placeholder={placeholder}
                  hasError={showValidationError || showRequiredError}
                  title={tSchema(t, widgetConfig['widget-data-tooltip'])}
                  onChange={handleMultiCalendarChange}
                  onBlur={handleBlur}
                />
              )}
              {showManual && inputMethod !== 'picker' && (
                <input
                  type="text"
                  value={getDisplayValue()}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  onFocus={handleFocus}
                  disabled={!isEnabled}
                  placeholder={placeholder}
                  className={owtFieldInputClass({
                    error: showValidationError || showRequiredError,
                    disabled: !isEnabled,
                    className: 'w-full sm:w-[180px] max-w-full h-[30px] px-3 owt-shadow-sm',
                  })}
                  style={{ borderRadius: '10px' }}
                  title={tSchema(t, widgetConfig['widget-data-tooltip'])}
                />
              )}
              {value ? (
                <p className="text-xs text-gray-500 mt-0.5">
                  {t?.('common.gregorianValue', {
                    date: formatDateToISO(value),
                    defaultValue: `(Gregorian): ${formatDateToISO(value)}`,
                  }) || `(Gregorian): ${formatDateToISO(value)}`}
                </p>
              ) : null}
            </>
          ) : inputMethod === 'picker' ? (
            <>
              <div
                ref={pickerTriggerRef}
                className="relative w-full sm:w-[180px] max-w-full"
              >
                <DateSegmentsInput
                  format={dateFormat}
                  iso={pickerIso}
                  disabled={!isEnabled}
                  title={tSchema(t, widgetConfig['widget-data-tooltip'])}
                  className={pickerInputClass}
                  segmentLabels={segmentLabels}
                  openCalendarLabel={openCalendarLabel}
                  onCommit={commitSegmentsDate}
                  onBlur={handleSegmentsBlur}
                  onTogglePicker={() => {
                    if (pickerOpen) {
                      setPickerOpen(false);
                      handleSegmentsBlur();
                      return;
                    }
                    openPickerCalendar();
                  }}
                />
              </div>
              {pickerPopup}
            </>
          ) : (
            <input
              type="text"
              value={getDisplayValue()}
              onChange={handleChange}
              onBlur={handleBlur}
              onFocus={handleFocus}
              disabled={!isEnabled || widgetConfig['widget-readonly']}
              placeholder={placeholder}
              className={owtFieldInputClass({
                error: showValidationError || showRequiredError,
                disabled: !isEnabled || widgetConfig['widget-readonly'],
                className: 'w-full sm:w-[180px] max-w-full h-[30px] px-3 owt-shadow-sm',
              })}
              style={{ borderRadius: '10px' }}
              title={tSchema(t, widgetConfig['widget-data-tooltip'])}
            />
          )}
          {showValidationError && <p className="owt-field-error text-sm mt-1">{error[0]}</p>}
        </div>
      </div>
    </div>
  );
};