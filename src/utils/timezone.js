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

    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    const hourNum = parseInt(hour, 10);
    const minNum = parseInt(minute, 10);

    if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum) ||
        isNaN(hourNum) || isNaN(minNum)) {
      throw new Error(`Invalid date/time format: ${dateStr} ${timeStr}`);
    }

    // Create a date string in ISO format (YYYY-MM-DDTHH:MM:00)
    const isoStr = `${String(yearNum).padStart(4, '0')}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}T${String(hourNum).padStart(2, '0')}:${String(minNum).padStart(2, '0')}:00`;

    // Create a temporary date in UTC
    const localDate = new Date(isoStr + 'Z');

    // Get the offset between the timezone and UTC
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(localDate);
    const tzValues = {};
    parts.forEach(part => {
      tzValues[part.type] = part.value;
    });

    const tzDate = new Date(
      `${tzValues.year}-${tzValues.month}-${tzValues.day}T${tzValues.hour}:${tzValues.minute}:${tzValues.second}Z`
    );

    // Calculate offset: localDate (in UTC) vs tzDate (what should be local time in UTC)
    const offset = localDate.getTime() - tzDate.getTime();

    // The actual UTC time is the ISO date plus the offset
    const utcDate = new Date(localDate.getTime() + offset);

    return utcDate;
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
