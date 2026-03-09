import { DateTime } from 'luxon';

/**
 * Parse local date/time string and convert to UTC
 * @param {string} dateStr - DD.MM.YYYY format
 * @param {string} timeStr - HH:MM format
 * @param {string} timezone - IANA timezone (e.g., 'Europe/Moscow')
 * @returns {Date} UTC date
 * @throws {Error} If parsing fails
 */
export function localDateToUTC(dateStr, timeStr, timezone = 'Europe/Moscow') {
  try {
    // Parse DD.MM.YYYY HH:MM
    const [day, month, year] = dateStr.split('.');
    const [hour, minute] = timeStr.split(':');

    // Create DateTime in local timezone
    const local = DateTime.fromObject(
      {
        year: parseInt(year, 10),
        month: parseInt(month, 10),
        day: parseInt(day, 10),
        hour: parseInt(hour, 10),
        minute: parseInt(minute, 10),
      },
      { zone: timezone }
    );

    if (!local.isValid) {
      throw new Error(`Invalid date/time: ${dateStr} ${timeStr}`);
    }

    // Convert to UTC
    return local.toUTC().toJSDate();
  } catch (err) {
    throw new Error(`Failed to parse datetime: ${err.message}`);
  }
}

/**
 * Validate datetime string format
 * @param {string} dateStr - DD.MM.YYYY
 * @param {string} timeStr - HH:MM
 * @returns {boolean}
 */
export function isValidDateTimeFormat(dateStr, timeStr) {
  const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
  const timeRegex = /^\d{2}:\d{2}$/;
  return dateRegex.test(dateStr) && timeRegex.test(timeStr);
}
