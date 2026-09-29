const TIMESTAMP_PATTERN = /^(\d{2}):(\d{2}):(\d{2})\s+(\d{2})\/(\d{2})\/(\d{4})$/;
const OFFSET_PATTERN = /^[+-](?:0\d|1[0-4]):[0-5]\d$/;

export function parseOneOfficeTimestamp(
  raw: string,
  timeZoneOffset = '+07:00',
): string | null {
  const match = TIMESTAMP_PATTERN.exec(raw.trim());

  if (!match || !OFFSET_PATTERN.test(timeZoneOffset)) {
    return null;
  }

  const [, hourText, minuteText, secondText, dayText, monthText, yearText] = match;
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);

  if (hour > 23 || minute > 59 || second > 59 || month < 1 || month > 12) {
    return null;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}${timeZoneOffset}`;
}
