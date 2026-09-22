export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(base: Date | string, days: number): Date {
  const d = typeof base === 'string' ? new Date(base + 'T00:00:00') : new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function isoDaysAgo(days: number): string {
  return toISODate(addDays(new Date(), -days));
}

export function isoDaysFromNow(days: number): string {
  return toISODate(addDays(new Date(), days));
}

export function isoWeeksAgo(weeks: number): string {
  return isoDaysAgo(weeks * 7);
}

export function isoWeeksFromNow(weeks: number): string {
  return isoDaysFromNow(weeks * 7);
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.round((db - da) / 86400000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatDateShort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function formatDateLong(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return `${WEEKDAYS_LONG[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function formatDateWeekday(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
}

export function formatRelative(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = daysBetween(todayISO(), iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < -1 && diff > -7) return `${Math.abs(diff)} days ago`;
  if (diff >= 7 && diff < 60) return `In ${Math.round(diff / 7)}w`;
  if (diff <= -7 && diff > -60) return `${Math.round(Math.abs(diff) / 7)}w ago`;
  return formatDateShort(iso);
}

export function formatTime(t: string): string {
  const [hStr, m] = t.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function minutesToTime(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function birthdayDaysUntil(mmdd: string): number {
  const [mm, dd] = mmdd.split('-').map(Number);
  const now = new Date();
  const year = now.getFullYear();
  let next = new Date(year, mm - 1, dd);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (next.getTime() < todayMidnight.getTime()) {
    next = new Date(year + 1, mm - 1, dd);
  }
  return Math.round((next.getTime() - todayMidnight.getTime()) / 86400000);
}

export function formatBirthday(mmdd: string): string {
  const [mm, dd] = mmdd.split('-').map(Number);
  return `${MONTHS[mm - 1]} ${dd}`;
}

export { MONTHS, WEEKDAYS, WEEKDAYS_LONG };
