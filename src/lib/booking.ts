import type { AppState } from '../store/types';
import type { Appointment } from '../types';
import { checkBooking } from './scheduling';
import { formatTime } from './dates';
import { clientName } from './selectors';

type BookingState = Pick<AppState, 'newApptDraft' | 'editingApptId' | 'services' | 'staff' | 'clients' | 'appointments' | 'business' | 'payments'>;

export interface DraftEvaluation {
  price: number;
  duration: number;
  total: number;
  balance: number;
  blocking: string[]; // must be fixed before saving
  hoursIssue: string | null; // blocking unless the user explicitly allows outside-hours
  warnings: string[]; // shown, but saving is allowed
  editing: Appointment | undefined;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function evaluateDraft(s: BookingState, now: Date = new Date()): DraftEvaluation {
  const d = s.newApptDraft;
  const editing = s.editingApptId ? s.appointments.find((a) => a.id === s.editingApptId) : undefined;
  const services = s.services.filter((sv) => d.serviceIds.includes(sv.id));
  // A reschedule keeps the booked price/duration; new bookings use current service prices.
  const price = editing ? editing.price : round2(services.reduce((sum, sv) => sum + sv.price, 0));
  const duration = editing ? editing.durationMin : services.reduce((sum, sv) => sum + sv.duration, 0);
  const discount = editing ? editing.discount : d.discount;
  const deposit = editing ? editing.deposit : d.deposit;
  const total = round2(Math.max(0, price - discount));
  const balance = round2(Math.max(0, total - deposit));

  const blocking: string[] = [];
  const warnings: string[] = [];
  if (!d.clientId) blocking.push('Choose a client.');
  else if (!s.clients.some((c) => c.id === d.clientId && !c.archived) && !editing) blocking.push('That client is archived — restore them first.');
  if (!editing && services.length === 0) blocking.push('Choose at least one service.');
  if (!editing && services.some((sv) => !sv.active)) blocking.push('One of the chosen services is archived.');
  const staff = s.staff.find((st) => st.id === d.staffId);
  if (!d.staffId || !staff) blocking.push('Choose a staff member.');
  else if (staff.archived) blocking.push(`${staff.name} is no longer on the team — choose someone else.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) blocking.push('Choose a date.');
  if (!/^\d{2}:\d{2}$/.test(d.time)) blocking.push('Choose a time.');
  if (!editing) {
    if (d.discount < 0 || d.deposit < 0) blocking.push('Discount and deposit can’t be negative.');
    if (d.discount > price) blocking.push('Discount is more than the service price.');
    if (d.deposit > total) blocking.push('Deposit is more than the total.');
  }

  let hoursIssue: string | null = null;
  if (blocking.length === 0 || (d.staffId && d.date && d.time)) {
    const check = checkBooking(s.appointments, s.business, { staffId: d.staffId, date: d.date, time: d.time, durationMin: duration, excludeApptId: editing?.id }, now);
    check.conflicts.forEach(({ appt }) => {
      blocking.push(`${staff?.name ?? 'This staff member'} is already booked with ${clientName(s, appt.clientId)} at ${formatTime(appt.time)}. Pick another time or staff member.`);
    });
    if (check.pastIssue) blocking.push(check.pastIssue);
    hoursIssue = check.hoursIssue;
    check.bufferWarnings.forEach((a) => warnings.push(`Less than ${s.business.bufferMin} min buffer next to ${clientName(s, a.clientId)} at ${formatTime(a.time)}.`));
  }
  return { price, duration, total, balance, blocking, hoursIssue, warnings, editing };
}

export function canSaveDraft(ev: DraftEvaluation, allowOutsideHours: boolean): boolean {
  return ev.blocking.length === 0 && (!ev.hoursIssue || allowOutsideHours);
}
