export const parseDateTime = (dateTimeString: string): Date | null => {
  if (!dateTimeString) return null;

  const isoMatch = dateTimeString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{3}))?(?:Z|([+-]\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]) - 1;
    const day = parseInt(isoMatch[3]);
    const hour = parseInt(isoMatch[4] || '0');
    const minute = parseInt(isoMatch[5] || '0');
    const second = parseInt(isoMatch[6] || '0');

    const date = new Date(year, month, day, hour, minute, second);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  const localMatch = dateTimeString.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (localMatch) {
    const year = parseInt(localMatch[1]);
    const month = parseInt(localMatch[2]) - 1;
    const day = parseInt(localMatch[3]);
    const hour = parseInt(localMatch[4] || '0');
    const minute = parseInt(localMatch[5] || '0');
    const second = parseInt(localMatch[6] || '0');

    const date = new Date(year, month, day, hour, minute, second);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  const date = new Date(dateTimeString);
  if (!isNaN(date.getTime())) {
    return date;
  }

  return null;
};

export const formatDateTimeToISO = (date: Date | string | null | undefined): string => {
  if (!date) return '';

  let dateObj: Date;
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    const parsed = parseDateTime(date);
    if (!parsed) return '';
    dateObj = parsed;
  } else {
    return '';
  }

  if (isNaN(dateObj.getTime())) return '';

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hour = String(dateObj.getHours()).padStart(2, '0');
  const minute = String(dateObj.getMinutes()).padStart(2, '0');
  const second = String(dateObj.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

/** Format for HTML `datetime-local` inputs (`YYYY-MM-DDTHH:mm`). */
export const formatDateTimeToLocalISO = (date: Date | string | null | undefined): string => {
  if (!date) return '';

  let dateObj: Date;
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    const parsed = parseDateTime(date);
    if (!parsed) return '';
    dateObj = parsed;
  } else {
    return '';
  }

  if (isNaN(dateObj.getTime())) return '';

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hour = String(dateObj.getHours()).padStart(2, '0');
  const minute = String(dateObj.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}`;
};

export const formatDateTimeToString = (date: Date | string | null | undefined, format: string): string => {
  if (!date || !format) return '';

  let dateObj: Date;
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    const parsed = parseDateTime(date);
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
  const hour = String(dateObj.getHours()).padStart(2, '0');
  const minute = String(dateObj.getMinutes()).padStart(2, '0');
  const second = String(dateObj.getSeconds()).padStart(2, '0');

  return format
    .replace(/DD/g, day)
    .replace(/MM/g, month)
    .replace(/YYYY/g, year.toString())
    .replace(/YY/g, yearShort)
    .replace(/HH/g, hour)
    .replace(/mm/g, minute)
    .replace(/ss/g, second);
};

export const parseDateTimeFromFormat = (dateTimeString: string, format: string): Date | null => {
  if (!dateTimeString || !format) return null;

  const dayIndex = format.indexOf('DD');
  const monthIndex = format.indexOf('MM');
  const yearIndex = format.indexOf('YYYY');
  const yearShortIndex = format.indexOf('YY');
  const hourIndex = format.indexOf('HH');
  const minuteIndex = format.indexOf('mm');
  const secondIndex = format.indexOf('ss');

  if (dayIndex === -1 || monthIndex === -1 || (yearIndex === -1 && yearShortIndex === -1)) {
    return parseDateTime(dateTimeString);
  }

  try {
    let day = '';
    let month = '';
    let year = '';
    let hour = '00';
    let minute = '00';
    let second = '00';

    if (dayIndex !== -1) {
      day = dateTimeString.substring(dayIndex, dayIndex + 2);
    }

    if (monthIndex !== -1) {
      month = dateTimeString.substring(monthIndex, monthIndex + 2);
    }

    if (yearIndex !== -1) {
      year = dateTimeString.substring(yearIndex, yearIndex + 4);
    } else if (yearShortIndex !== -1) {
      const yearShort = dateTimeString.substring(yearShortIndex, yearShortIndex + 2);
      const currentYear = new Date().getFullYear();
      const currentCentury = Math.floor(currentYear / 100) * 100;
      const parsedYear = parseInt(yearShort);
      // 00-50 → 20xx; 51-99 → 19xx
      year = parsedYear <= 50
        ? (currentCentury + parsedYear).toString()
        : (currentCentury - 100 + parsedYear).toString();
    }

    if (hourIndex !== -1) {
      hour = dateTimeString.substring(hourIndex, hourIndex + 2);
    }
    if (minuteIndex !== -1) {
      minute = dateTimeString.substring(minuteIndex, minuteIndex + 2);
    }
    if (secondIndex !== -1) {
      second = dateTimeString.substring(secondIndex, secondIndex + 2);
    }

    if (day && month && year) {
      const date = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      );
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  } catch {
  }

  return parseDateTime(dateTimeString);
};

export const getMinDateTime = (
  constraint: string | undefined,
  minDateTime: string | undefined
): string | undefined => {
  if (minDateTime) {
    if (minDateTime === 'now') {
      return formatDateTimeToLocalISO(new Date());
    }
    return minDateTime;
  }

  if (constraint === 'past-only') {
    return undefined;
  }

  if (constraint === 'future-only') {
    return formatDateTimeToLocalISO(new Date());
  }

  return undefined;
};

export const getMaxDateTime = (
  constraint: string | undefined,
  maxDateTime: string | undefined
): string | undefined => {
  if (maxDateTime) {
    if (maxDateTime === 'now') {
      return formatDateTimeToLocalISO(new Date());
    }
    return maxDateTime;
  }

  if (constraint === 'past-only') {
    return formatDateTimeToLocalISO(new Date());
  }

  if (constraint === 'future-only') {
    return undefined;
  }

  return undefined;
};

export const validateDateTimeConstraints = (
  date: Date | string | null | undefined,
  minDateTime: string | undefined,
  maxDateTime: string | undefined,
  constraint: string | undefined
): string | null => {
  if (!date) return null;

  const dateObj = date instanceof Date ? date : parseDateTime(date);
  if (!dateObj) return null;

  const dateTimeISO = formatDateTimeToLocalISO(dateObj);
  const nowISO = formatDateTimeToLocalISO(new Date());

  if (constraint === 'past-only') {
    if (dateTimeISO > nowISO) {
      return 'DateTime must be in the past';
    }
  } else if (constraint === 'future-only') {
    if (dateTimeISO < nowISO) {
      return 'DateTime must be in the future';
    }
  }

  const effectiveMinDateTime = getMinDateTime(constraint, minDateTime);
  if (effectiveMinDateTime && dateTimeISO < effectiveMinDateTime) {
    return `DateTime must be on or after ${effectiveMinDateTime}`;
  }

  const effectiveMaxDateTime = getMaxDateTime(constraint, maxDateTime);
  if (effectiveMaxDateTime && dateTimeISO > effectiveMaxDateTime) {
    return `DateTime must be on or before ${effectiveMaxDateTime}`;
  }

  return null;
};
