// Derive a single attendance row (time_in / time_out) from the raw biometric
// events captured for one (employee, date). Pure function — no DB, no I/O.
//
// Rules:
//   1. No events            → both null (no attendance from biometric for this day)
//   2. One event            → time_in = that event, time_out = null
//   3. Multiple events      → time_in = earliest, time_out = latest
//      but if the gap between earliest and latest is < MIN_GAP_MINUTES,
//      treat as a double-scan and emit time_in only.
//
// We intentionally ignore the device's own checkIn/checkOut labels: they're
// derived from the device's internal flip-flop logic and unreliable (e.g. a
// person who scans once at end of day gets labelled "checkOut" with no prior
// "checkIn"). Earliest/latest of the day is the source of truth.

export interface BiometricEventLike {
  /** ISO 8601 timestamp from the device, e.g. "2026-05-20T16:59:36+02:00" */
  event_time: string;
}

export interface AttendanceDerivation {
  time_in: string | null;
  time_out: string | null;
  time_in_source: 'biometric' | null;
  time_out_source: 'biometric' | null;
  event_count: number;
}

const MIN_GAP_MINUTES = 5;

export function deriveAttendance(events: BiometricEventLike[]): AttendanceDerivation {
  if (events.length === 0) {
    return {
      time_in: null,
      time_out: null,
      time_in_source: null,
      time_out_source: null,
      event_count: 0,
    };
  }

  const sorted = [...events].sort((a, b) => a.event_time.localeCompare(b.event_time));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const time_in = isoToLocalTime(first.event_time);

  if (sorted.length === 1) {
    return {
      time_in,
      time_out: null,
      time_in_source: 'biometric',
      time_out_source: null,
      event_count: 1,
    };
  }

  const gapMs = new Date(last.event_time).getTime() - new Date(first.event_time).getTime();
  if (gapMs < MIN_GAP_MINUTES * 60_000) {
    return {
      time_in,
      time_out: null,
      time_in_source: 'biometric',
      time_out_source: null,
      event_count: sorted.length,
    };
  }

  return {
    time_in,
    time_out: isoToLocalTime(last.event_time),
    time_in_source: 'biometric',
    time_out_source: 'biometric',
    event_count: sorted.length,
  };
}

/**
 * Extract "HH:MM:SS" local time from a device-stamped ISO timestamp.
 * Device events always include their local +02:00 offset (SAST), so we can
 * read the time portion of the ISO string directly without timezone math.
 */
export function isoToLocalTime(iso: string): string {
  const m = iso.match(/T(\d{2}:\d{2}:\d{2})/);
  if (m) return m[1];
  // Fallback (shouldn't happen with HikVision payloads): convert via Africa/Johannesburg
  const parts = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const ss = parts.find((p) => p.type === 'second')?.value ?? '00';
  return `${hh}:${mm}:${ss}`;
}

/**
 * Extract YYYY-MM-DD date portion from a device-stamped ISO timestamp,
 * interpreting it in its declared offset (the device's local date).
 */
export function isoToLocalDate(iso: string): string {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const parts = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const mo = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${mo}-${d}`;
}
