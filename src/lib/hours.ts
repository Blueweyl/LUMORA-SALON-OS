import type { Business } from '../types';
import { addDays, formatTime, timeToMinutes, toISODate } from './dates';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Display order starts on Monday, the way most salons read their week.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const DEFAULT_OPEN_DAYS = [2, 3, 4, 5, 6];
export const DEFAULT_OPEN_TIME = '09:00';
export const DEFAULT_CLOSE_TIME = '18:00';

export function dayShort(d: number): string {
  return DAY_SHORT[d];
}

function formatDays(days: number[]): string {
  const ordered = WEEK_ORDER.filter((d) => days.includes(d));
  if (ordered.length === 0) return 'Closed';
  if (ordered.length === 7) return 'Every day';
  // Collapse consecutive runs (in Monday-first order) into ranges.
  const runs: number[][] = [];
  ordered.forEach((d) => {
    const last = runs[runs.length - 1];
    if (last && WEEK_ORDER.indexOf(d) === WEEK_ORDER.indexOf(last[last.length - 1]) + 1) last.push(d);
    else runs.push([d]);
  });
  return runs.map((r) => (r.length >= 3 ? `${DAY_SHORT[r[0]]}–${DAY_SHORT[r[r.length - 1]]}` : r.map((d) => DAY_SHORT[d]).join(', '))).join(', ');
}

export function formatHoursLabel(openDays: number[], openTime: string, closeTime: string): string {
  if (openDays.length === 0) return 'Closed';
  return `${formatDays(openDays)}, ${formatTime(openTime)} – ${formatTime(closeTime)}`;
}

function parseClock(h: string, m: string | undefined, ampm: string | undefined): string | null {
  let hour = parseInt(h, 10);
  const min = m ? parseInt(m, 10) : 0;
  if (Number.isNaN(hour) || hour > 23 || min > 59) return null;
  const ap = ampm?.toLowerCase();
  if (ap === 'pm' && hour < 12) hour += 12;
  if (ap === 'am' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Best-effort parse of the legacy free-text hours string (e.g. "Tue–Sat, 9:00 AM – 6:00 PM"). */
export function parseHoursText(text: string): { openDays: number[]; openTime: string; closeTime: string } {
  const out = { openDays: DEFAULT_OPEN_DAYS, openTime: DEFAULT_OPEN_TIME, closeTime: DEFAULT_CLOSE_TIME };
  if (!text) return out;
  const times = [...text.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi)].filter((m) => m[3] || m[2]);
  if (times.length >= 2) {
    const open = parseClock(times[0][1], times[0][2], times[0][3]);
    const close = parseClock(times[1][1], times[1][2], times[1][3]);
    if (open && close && timeToMinutes(close) > timeToMinutes(open)) {
      out.openTime = open;
      out.closeTime = close;
    }
  }
  const lower = text.toLowerCase();
  const idx = (name: string) => DAY_SHORT.findIndex((d) => d.toLowerCase() === name.slice(0, 3).toLowerCase());
  const range = lower.match(/(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s*[–—-]\s*(sun|mon|tue|wed|thu|fri|sat)/);
  if (range) {
    const a = WEEK_ORDER.indexOf(idx(range[1]));
    const b = WEEK_ORDER.indexOf(idx(range[2]));
    if (a >= 0 && b >= a) out.openDays = WEEK_ORDER.slice(a, b + 1);
  } else if (/every day|daily|7 days/.test(lower)) {
    out.openDays = [0, 1, 2, 3, 4, 5, 6];
  }
  return out;
}

export function isOpenDay(b: Pick<Business, 'openDays'>, iso: string): boolean {
  const d = new Date(iso + 'T00:00:00');
  return b.openDays.includes(d.getDay());
}

/** Returns a human-readable problem if the slot is outside business hours, otherwise null. */
export function hoursProblem(b: Pick<Business, 'openDays' | 'openTime' | 'closeTime'>, iso: string, time: string, durationMin: number): string | null {
  if (!isOpenDay(b, iso)) {
    const d = new Date(iso + 'T00:00:00');
    return `You're closed on ${['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][d.getDay()]}.`;
  }
  const start = timeToMinutes(time);
  const end = start + durationMin;
  if (start < timeToMinutes(b.openTime)) return `Starts before opening time (${formatTime(b.openTime)}).`;
  if (end > timeToMinutes(b.closeTime)) return `Runs past closing time (${formatTime(b.closeTime)}).`;
  return null;
}

/** The first open day on or after the given date (falls back to the date itself if the business has no open days). */
export function nextOpenDay(b: Pick<Business, 'openDays'>, iso: string): string {
  if (b.openDays.length === 0) return iso;
  for (let i = 0; i < 7; i++) {
    const d = toISODate(addDays(iso, i));
    if (isOpenDay(b, d)) return d;
  }
  return iso;
}
