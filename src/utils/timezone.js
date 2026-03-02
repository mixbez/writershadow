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

/**
 * Resolves lat/lon coordinates to an IANA timezone using the free timeapi.io.
 * Returns null on failure.
 */
export async function resolveTimezoneFromCoords(lat, lon) {
  try {
    const url = `https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lon}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.timeZone || null;
  } catch (e) {
    return null;
  }
}
