export const parseDate = (dateString: string): Date | null => {
  if (!dateString) return null;

  const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const date = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  const date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    return date;
  }

  return null;
};

export const formatDateToISO = (date: Date | string | null | undefined): string => {
  if (!date) return '';

  let dateObj: Date;
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    const parsed = parseDate(date);
    if (!parsed) return '';
    dateObj = parsed;
  } else {
    return '';
  }

  if (isNaN(dateObj.getTime())) return '';

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const formatDateToString = (date: Date | string | null | undefined, format: string): string => {
  if (!date || !format) return '';

  let dateObj: Date;
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    const parsed = parseDate(date);
    if (!parsed) return '';
    dateObj = parsed;
  } else {
    return '';
  }

  if (isNaN(dateObj.getTime())) return '';

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const yearShort = year.toString().slice(-2);

  return format
    .replace(/DD/g, day)
    .replace(/MM/g, month)
    .replace(/YYYY/g, year.toString())
    .replace(/YY/g, yearShort);
};

export const parseDateFromFormat = (dateString: string, format: string): Date | null => {
  if (!dateString || !format) return null;

  const dayIndex = format.indexOf('DD');
  const monthIndex = format.indexOf('MM');
  const yearIndex = format.indexOf('YYYY');
  const yearShortIndex = format.indexOf('YY');

  if (dayIndex === -1 || monthIndex === -1 || (yearIndex === -1 && yearShortIndex === -1)) {
    return parseDate(dateString);
  }

  try {
    let day = '';
    let month = '';
    let year = '';

    if (dayIndex !== -1) {
      day = dateString.substring(dayIndex, dayIndex + 2);
    }

    if (monthIndex !== -1) {
      month = dateString.substring(monthIndex, monthIndex + 2);
    }

    if (yearIndex !== -1) {
      year = dateString.substring(yearIndex, yearIndex + 4);
    } else if (yearShortIndex !== -1) {
      const yearShort = dateString.substring(yearShortIndex, yearShortIndex + 2);
      const currentYear = new Date().getFullYear();
      const currentCentury = Math.floor(currentYear / 100) * 100;
      const parsedYear = parseInt(yearShort);
      // 00-50 → 20xx; 51-99 → 19xx
      year = parsedYear <= 50
        ? (currentCentury + parsedYear).toString()
        : (currentCentury - 100 + parsedYear).toString();
    }

    if (day && month && year) {
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  } catch {
  }

  return parseDate(dateString);
};

export const resolveDateBoundFromFieldValue = (
  fieldValue: unknown
): string | undefined => {
  if (fieldValue == null || fieldValue === '') {
    return undefined;
  }
  const iso = formatDateToISO(fieldValue as Date | string);
  return iso || undefined;
};

export const mergeMinDateBounds = (
  boundA: string | undefined,
  boundB: string | undefined
): string | undefined => {
  if (!boundA) {
    return boundB;
  }
  if (!boundB) {
    return boundA;
  }
  return boundA > boundB ? boundA : boundB;
};

export const mergeMaxDateBounds = (
  boundA: string | undefined,
  boundB: string | undefined
): string | undefined => {
  if (!boundA) {
    return boundB;
  }
  if (!boundB) {
    return boundA;
  }
  return boundA < boundB ? boundA : boundB;
};

export const getMinDate = (
  constraint: string | undefined,
  minDate: string | undefined
): string | undefined => {
  if (minDate) {
    if (minDate === 'today') {
      return formatDateToISO(new Date());
    }
    return minDate;
  }

  if (constraint === 'past-only') {
    return undefined;
  }

  if (constraint === 'future-only') {
    return formatDateToISO(new Date());
  }

  return undefined;
};

export const getMaxDate = (
  constraint: string | undefined,
  maxDate: string | undefined
): string | undefined => {
  if (maxDate) {
    if (maxDate === 'today') {
      return formatDateToISO(new Date());
    }
    return maxDate;
  }

  if (constraint === 'past-only') {
    return formatDateToISO(new Date());
  }

  if (constraint === 'future-only') {
    return undefined;
  }

  return undefined;
};

export interface DateConstraintMessages {
  minDateMessage?: string;
  maxDateMessage?: string;
}

export const validateDateConstraints = (
  date: Date | string | null | undefined,
  minDate: string | undefined,
  maxDate: string | undefined,
  constraint: string | undefined,
  messages?: DateConstraintMessages
): string | null => {
  if (!date) return null;

  const dateObj = date instanceof Date ? date : parseDate(date);
  if (!dateObj) return null;

  const dateISO = formatDateToISO(dateObj);
  const todayISO = formatDateToISO(new Date());

  if (constraint === 'past-only') {
    if (dateISO > todayISO) {
      return 'Date must be in the past';
    }
  } else if (constraint === 'future-only') {
    if (dateISO < todayISO) {
      return 'Date must be in the future';
    }
  }

  if (minDate && dateISO < minDate) {
    return messages?.minDateMessage ?? `Date must be on or after ${minDate}`;
  }

  if (maxDate && dateISO > maxDate) {
    return messages?.maxDateMessage ?? `Date must be on or before ${maxDate}`;
  }

  return null;
};
