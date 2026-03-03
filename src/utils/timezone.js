import cityTimezones from 'city-timezones';

/**
 * Resolves user input (IANA string or city name) to a valid IANA timezone.
 * Returns null if not resolved.
 */
export function resolveTimezoneFromText(input) {
  const trimmed = input.trim();

  // 1. Try as-is IANA timezone (e.g. "Europe/Moscow")
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch (e) {}

  // 2. Try city name lookup via city-timezones (e.g. "Budapest", "Moscow")
  const results = cityTimezones.lookupViaCity(trimmed);
  if (results && results.length > 0) {
    return results[0].timezone;
  }

  // 3. Case-insensitive city match
  const lower = trimmed.toLowerCase();
  const match = cityTimezones.cityMapping.find(
    c => c.city.toLowerCase() === lower
  );
  if (match) {
    return match.timezone;
  }

  return null;
}

