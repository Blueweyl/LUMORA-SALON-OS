import type { Appointment, Business } from '../types';
import { minutesToTime, timeToMinutes, todayISO } from './dates';
import { hoursProblem } from './hours';

export interface Conflict {
  appt: Appointment;
}

const BLOCKING_STATUSES = new Set<Appointment['status']>(['cancelled', 'no-show']);

export function findConflicts(appointments: Appointment[], staffId: string, date: string, time: string, durationMin: number, excludeApptId?: string): Conflict[] {
  if (!staffId || !time || durationMin <= 0) return [];
  const start = timeToMinutes(time);
  const end = start + durationMin;
  return appointments
    .filter((a) => a.id !== excludeApptId && a.staffId === staffId && a.date === date && !BLOCKING_STATUSES.has(a.status))
    .filter((a) => {
      const aStart = timeToMinutes(a.time);
      const aEnd = aStart + a.durationMin;
      return start < aEnd && end > aStart;
    })
    .map((appt) => ({ appt }));
}

/** Appointments that don't overlap but sit closer than the configured buffer. */
export function findBufferWarnings(appointments: Appointment[], staffId: string, date: string, time: string, durationMin: number, bufferMin: number, excludeApptId?: string): Appointment[] {
  if (!staffId || !time || durationMin <= 0 || bufferMin <= 0) return [];
  const start = timeToMinutes(time);
  const end = start + durationMin;
  return appointments.filter((a) => {
    if (a.id === excludeApptId || a.staffId !== staffId || a.date !== date || BLOCKING_STATUSES.has(a.status)) return false;
    const aStart = timeToMinutes(a.time);
    const aEnd = aStart + a.durationMin;
    const overlaps = start < aEnd && end > aStart;
    const tooClose = start < aEnd + bufferMin && end + bufferMin > aStart;
    return !overlaps && tooClose;
  });
}

export interface BookingCheckInput {
  staffId: string;
  date: string;
  time: string;
  durationMin: number;
  excludeApptId?: string;
}

export interface BookingCheck {
  conflicts: Conflict[];
  hoursIssue: string | null;
  pastIssue: string | null;
  bufferWarnings: Appointment[];
}

export function checkBooking(appointments: Appointment[], business: Business, input: BookingCheckInput, now: Date = new Date()): BookingCheck {
  const { staffId, date, time, durationMin, excludeApptId } = input;
  const conflicts = findConflicts(appointments, staffId, date, time, durationMin, excludeApptId);
  const hoursIssue = date && time && durationMin > 0 ? hoursProblem(business, date, time, durationMin) : null;
  let pastIssue: string | null = null;
  const today = todayISO();
  if (date && date < today) pastIssue = 'That date is in the past.';
  else if (date === today && time && timeToMinutes(time) < now.getHours() * 60 + now.getMinutes() - 60) pastIssue = 'That time has already passed today.';
  const bufferWarnings = findBufferWarnings(appointments, staffId, date, time, durationMin, business.bufferMin, excludeApptId);
  return { conflicts, hoursIssue, pastIssue, bufferWarnings };
}

export function suggestTimes(appointments: Appointment[], business: Business, staffId: string, date: string, durationMin: number, count = 4, excludeApptId?: string, now: Date = new Date()): string[] {
  if (!staffId || durationMin <= 0 || !date) return [];
  if (hoursProblem(business, date, business.openTime, 1)?.startsWith("You're closed")) return [];
  const dayStart = timeToMinutes(business.openTime);
  const dayEnd = timeToMinutes(business.closeTime);
  const bufferMin = Math.max(0, business.bufferMin);
  const busy = appointments
    .filter((a) => a.id !== excludeApptId && a.staffId === staffId && a.date === date && !BLOCKING_STATUSES.has(a.status))
    .map((a) => ({ start: timeToMinutes(a.time) - bufferMin, end: timeToMinutes(a.time) + a.durationMin + bufferMin }))
    .sort((a, b) => a.start - b.start);

  let earliest = dayStart;
  if (date === todayISO()) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    earliest = Math.max(dayStart, Math.ceil(nowMin / 15) * 15);
  }
  if (date < todayISO()) return [];

  const results: string[] = [];
  let cursor = earliest;
  const fits = (s: number) => s + durationMin <= dayEnd && !busy.some((b) => s < b.end && s + durationMin > b.start);
  while (cursor + durationMin <= dayEnd && results.length < count) {
    if (fits(cursor)) {
      results.push(minutesToTime(cursor));
      cursor += Math.max(30, durationMin);
    } else {
      const blocking = busy.find((b) => cursor < b.end && cursor + durationMin > b.start);
      cursor = blocking ? Math.max(cursor + 15, Math.ceil(blocking.end / 15) * 15) : cursor + 15;
    }
  }
  return results;
}
