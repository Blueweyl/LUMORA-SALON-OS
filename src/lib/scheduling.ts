import type { Appointment } from '../types';
import { minutesToTime, timeToMinutes } from './dates';

const DAY_START = 9 * 60;
const DAY_END = 18 * 60;

export interface Conflict {
  appt: Appointment;
}

export function findConflicts(appointments: Appointment[], staffId: string, date: string, time: string, durationMin: number, excludeApptId?: string): Conflict[] {
  if (!staffId || !time || durationMin <= 0) return [];
  const start = timeToMinutes(time);
  const end = start + durationMin;
  return appointments
    .filter((a) => a.id !== excludeApptId && a.staffId === staffId && a.date === date && a.status !== 'cancelled' && a.status !== 'no-show')
    .filter((a) => {
      const aStart = timeToMinutes(a.time);
      const aEnd = aStart + a.durationMin;
      return start < aEnd && end > aStart;
    })
    .map((appt) => ({ appt }));
}

export function suggestTimes(appointments: Appointment[], staffId: string, date: string, durationMin: number, bufferMin: number, count = 4): string[] {
  if (!staffId || durationMin <= 0) return [];
  const busy = appointments
    .filter((a) => a.staffId === staffId && a.date === date && a.status !== 'cancelled' && a.status !== 'no-show')
    .map((a) => ({ start: timeToMinutes(a.time) - bufferMin, end: timeToMinutes(a.time) + a.durationMin + bufferMin }))
    .sort((a, b) => a.start - b.start);

  const results: string[] = [];
  let cursor = DAY_START;
  for (const slot of busy) {
    if (cursor + durationMin <= slot.start) {
      results.push(minutesToTime(cursor));
      if (results.length >= count) return results;
    }
    cursor = Math.max(cursor, slot.end);
  }
  while (cursor + durationMin <= DAY_END && results.length < count) {
    results.push(minutesToTime(cursor));
    cursor += 30;
  }
  return results;
}
