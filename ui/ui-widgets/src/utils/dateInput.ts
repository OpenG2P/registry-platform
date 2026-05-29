/**
 * Date input utilities for parsing, formatting, and validation
 */

/**
 * Parse date string in various formats to Date object
 */
export const parseDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  
  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const date = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Try common formats
  const date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  return null;
};

/**
 * Format date to ISO string (YYYY-MM-DD) for storage
 */
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

/**
 * Format date to custom format string
 */
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

/**
 * Parse custom format string to Date object
 */
export const parseDateFromFormat = (dateString: string, format: string): Date | null => {
  if (!dateString || !format) return null;
  
  // Extract day, month, year positions from format
  const dayIndex = format.indexOf('DD');
  const monthIndex = format.indexOf('MM');
  const yearIndex = format.indexOf('YYYY');
  const yearShortIndex = format.indexOf('YY');
  
  if (dayIndex === -1 || monthIndex === -1 || (yearIndex === -1 && yearShortIndex === -1)) {
    // Fallback to standard Date parsing
    return parseDate(dateString);
  }
  
  try {
    let day = '';
    let month = '';
    let year = '';
    
    // Extract day (2 digits)
    if (dayIndex !== -1) {
      day = dateString.substring(dayIndex, dayIndex + 2);
    }
    
    // Extract month (2 digits)
    if (monthIndex !== -1) {
      month = dateString.substring(monthIndex, monthIndex + 2);
    }
    
    // Extract year (4 digits or 2 digits)
    if (yearIndex !== -1) {
      year = dateString.substring(yearIndex, yearIndex + 4);
    } else if (yearShortIndex !== -1) {
      const yearShort = dateString.substring(yearShortIndex, yearShortIndex + 2);
      const currentYear = new Date().getFullYear();
      const currentCentury = Math.floor(currentYear / 100) * 100;
      const parsedYear = parseInt(yearShort);
      // Assume 20xx for years 00-50, 19xx for years 51-99
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
    // Fallback to standard parsing
  }
  
  return parseDate(dateString);
};

/**
 * Get min date based on constraint type
 */
export const getMinDate = (
  constraint: string | undefined,
  minDate: string | undefined
): string | undefined => {
  if (minDate) {
    // If it's 'today', return today's date
    if (minDate === 'today') {
      return formatDateToISO(new Date());
    }
    return minDate;
  }
  
  if (constraint === 'past-only') {
    // No minimum for past-only (can select any past date)
    return undefined;
  }
  
  if (constraint === 'future-only') {
    // Minimum is today for future-only
    return formatDateToISO(new Date());
  }
  
  return undefined;
};

/**
 * Get max date based on constraint type
 */
export const getMaxDate = (
  constraint: string | undefined,
  maxDate: string | undefined
): string | undefined => {
  if (maxDate) {
    // If it's 'today', return today's date
    if (maxDate === 'today') {
      return formatDateToISO(new Date());
    }
    return maxDate;
  }
  
  if (constraint === 'past-only') {
    // Maximum is today for past-only
    return formatDateToISO(new Date());
  }
  
  if (constraint === 'future-only') {
    // No maximum for future-only (can select any future date)
    return undefined;
  }
  
  return undefined;
};

/**
 * Validate date constraints
 */
export const validateDateConstraints = (
  date: Date | string | null | undefined,
  minDate: string | undefined,
  maxDate: string | undefined,
  constraint: string | undefined
): string | null => {
  if (!date) return null;
  
  const dateObj = date instanceof Date ? date : parseDate(date);
  if (!dateObj) return null;
  
  const dateISO = formatDateToISO(dateObj);
  const todayISO = formatDateToISO(new Date());
  
  // Check constraint type
  if (constraint === 'past-only') {
    if (dateISO > todayISO) {
      return 'Date must be in the past';
    }
  } else if (constraint === 'future-only') {
    if (dateISO < todayISO) {
      return 'Date must be in the future';
    }
  }
  
  // Check minDate
  const effectiveMinDate = getMinDate(constraint, minDate);
  if (effectiveMinDate && dateISO < effectiveMinDate) {
    return `Date must be on or after ${effectiveMinDate}`;
  }
  
  // Check maxDate
  const effectiveMaxDate = getMaxDate(constraint, maxDate);
  if (effectiveMaxDate && dateISO > effectiveMaxDate) {
    return `Date must be on or before ${effectiveMaxDate}`;
  }
  
  return null;
};


