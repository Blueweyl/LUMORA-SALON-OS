import { describe, expect, it } from 'vitest';
import { checkBooking, findConflicts, suggestTimes } from '../src/lib/scheduling';
import { hoursProblem, nextOpenDay, parseHoursText, formatHoursLabel } from '../src/lib/hours';
import { defaultBusiness } from '../src/data/seed';
import { isoDaysFromNow } from '../src/lib/dates';
import type { Appointment } from '../src/types';

const biz = defaultBusiness(); // Tue–Sat 09:00–18:00, 15 min buffer
const day = nextOpenDay(biz, isoDaysFromNow(14));

function appt(over: Partial<Appointment>): Appointment {
  return {
    id: over.id ?? Math.random().toString(36),
    clientId: 'c1',
    staffId: 'st1',
    serviceIds: ['s1'],
    date: day,
    time: '10:00',
    durationMin: 60,
    price: 100,
    discount: 0,
    deposit: 0,
    depositPaid: false,
    balancePaid: false,
    status: 'confirmed',
    notes: '',
    recurring: 'none',
    createdAt: day,
    tip: 0,
    productsSold: [],
    ...over,
  };
}

describe('conflict detection', () => {
  const existing = [appt({ id: 'a', time: '10:00', durationMin: 60 })];

  it('flags a same-staff overlap', () => {
    expect(findConflicts(existing, 'st1', day, '10:30', 30)).toHaveLength(1);
  });
  it('flags a booking whose duration runs into the next one', () => {
    expect(findConflicts(existing, 'st1', day, '09:15', 60)).toHaveLength(1);
  });
  it('allows back-to-back bookings', () => {
    expect(findConflicts(existing, 'st1', day, '11:00', 30)).toHaveLength(0);
    expect(findConflicts(existing, 'st1', day, '09:00', 60)).toHaveLength(0);
  });
  it('ignores other staff, cancelled and no-show bookings', () => {
    expect(findConflicts(existing, 'st2', day, '10:00', 60)).toHaveLength(0);
    const closed = [appt({ status: 'cancelled' }), appt({ status: 'no-show' })];
    expect(findConflicts(closed, 'st1', day, '10:00', 60)).toHaveLength(0);
  });
  it('excludes the appointment being rescheduled', () => {
    expect(findConflicts(existing, 'st1', day, '10:15', 60, 'a')).toHaveLength(0);
  });
});

describe('business hours', () => {
  it('blocks closed days', () => {
    const monday = nextOpenDay({ openDays: [1] }, isoDaysFromNow(10));
    expect(hoursProblem(biz, monday, '10:00', 60)).toMatch(/closed on Mondays/);
  });
  it('blocks starting before opening and running past closing', () => {
    expect(hoursProblem(biz, day, '08:30', 60)).toMatch(/before opening/);
    expect(hoursProblem(biz, day, '17:30', 60)).toMatch(/past closing/);
    expect(hoursProblem(biz, day, '17:00', 60)).toBeNull();
  });
  it('parses legacy hour labels', () => {
    expect(parseHoursText('Mon–Fri, 8:30 AM – 7 PM')).toEqual({ openDays: [1, 2, 3, 4, 5], openTime: '08:30', closeTime: '19:00' });
    expect(formatHoursLabel([2, 3, 4, 5, 6], '09:00', '18:00')).toBe('Tue–Sat, 9:00 AM – 6:00 PM');
    expect(formatHoursLabel([1, 3, 5], '09:00', '17:00')).toBe('Mon, Wed, Fri, 9:00 AM – 5:00 PM');
  });
});

describe('checkBooking', () => {
  it('reports past dates', () => {
    expect(checkBooking([], biz, { staffId: 'st1', date: '2000-01-04', time: '10:00', durationMin: 30 }).pastIssue).toBeTruthy();
  });
  it('warns about the buffer without blocking', () => {
    const r = checkBooking([appt({ time: '10:00', durationMin: 60 })], biz, { staffId: 'st1', date: day, time: '11:05', durationMin: 30 });
    expect(r.conflicts).toHaveLength(0);
    expect(r.bufferWarnings).toHaveLength(1);
  });
});

describe('suggestTimes', () => {
  it('only suggests free slots inside business hours', () => {
    const busy = [appt({ time: '09:00', durationMin: 180 })];
    const slots = suggestTimes(busy, biz, 'st1', day, 60, 10);
    expect(slots.length).toBeGreaterThan(0);
    for (const t of slots) {
      expect(findConflicts(busy, 'st1', day, t, 60)).toHaveLength(0);
      expect(hoursProblem(biz, day, t, 60)).toBeNull();
    }
    expect(slots[0] >= '12:15').toBe(true); // respects the 15 min buffer
  });
  it('suggests nothing on closed days', () => {
    const sunday = nextOpenDay({ openDays: [0] }, isoDaysFromNow(7));
    expect(suggestTimes([], biz, 'st1', sunday, 60)).toEqual([]);
  });
});
