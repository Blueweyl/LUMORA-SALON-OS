import { addDays, toISODate, todayISO } from './dates';

export interface WeekDay {
  date: string;
  label: string;
  dayNum: number;
  isToday: boolean;
}

export function getWeekDays(centerDate: string): WeekDay[] {
  const center = new Date(centerDate + 'T00:00:00');
  const dow = center.getDay();
  const monday = addDays(center, dow === 0 ? -6 : 1 - dow);
  const today = todayISO();
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    const iso = toISODate(d);
    return { date: iso, label: labels[i], dayNum: d.getDate(), isToday: iso === today };
  });
}

export interface MonthCell {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

export function getMonthCells(anchorDate: string): MonthCell[] {
  const anchor = new Date(anchorDate + 'T00:00:00');
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startDow = firstOfMonth.getDay();
  const gridStart = addDays(firstOfMonth, startDow === 0 ? -6 : 1 - startDow);
  const today = todayISO();
  return Array.from({ length: 42 }, (_, i) => {
    const d = addDays(gridStart, i);
    const iso = toISODate(d);
    return { date: iso, day: d.getDate(), inMonth: d.getMonth() === month, isToday: iso === today };
  });
}
