// Dates and times in Israel time, Hebrew (spec section 12): 21.10.2026, "לפני 3 ימים".

const TIME_ZONE = 'Asia/Jerusalem';

const fullFormat = new Intl.DateTimeFormat('he-IL', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormat = new Intl.DateTimeFormat('he-IL', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
});

// en-CA formats as YYYY-MM-DD, which compares as a string.
const isoDayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });

const relativeFormat = new Intl.RelativeTimeFormat('he', { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "לפני 3 ימים", "אתמול", "עכשיו". */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      // Chrome's Hebrew data appends the count to word forms: "לפני שעתיים (2)". Drop it.
      return relativeFormat.format(Math.round(seconds / size), unit).replace(/\s*\(\d+\)$/, '');
    }
  }
  return relativeFormat.format(0, 'second');
}

/** 21.10.2026, 14:05 */
export function fullDateTime(iso: string): string {
  return fullFormat.format(new Date(iso));
}

/** A date column (YYYY-MM-DD) as 21.10.2026. */
export function formatDate(day: string): string {
  return dateFormat.format(new Date(`${day}T12:00:00Z`));
}

/** True when a YYYY-MM-DD due date is before today in Israel. */
export function isPastDue(day: string | null): boolean {
  return day !== null && day < isoDayFormat.format(new Date());
}
