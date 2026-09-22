import type { AppState } from '../store/types';
import type { Appointment, Client, InventoryItem } from '../types';
import { todayISO, daysBetween, birthdayDaysUntil, isoDaysAgo } from './dates';
import { serviceCost, serviceMargin, serviceProfit } from './pricing';

export function getClient(s: AppState, id: string | null | undefined): Client | undefined {
  if (!id) return undefined;
  return s.clients.find((c) => c.id === id);
}

export function getStaff(s: AppState, id: string) {
  return s.staff.find((st) => st.id === id);
}

export function getServices(s: AppState, ids: string[]) {
  return s.services.filter((sv) => ids.includes(sv.id));
}

export function serviceNames(s: AppState, ids: string[]): string {
  return getServices(s, ids).map((sv) => sv.name).join(' + ');
}

export function apptTotal(a: Appointment): number {
  return a.price - a.discount;
}

export function apptBalance(a: Appointment): number {
  return Math.max(0, a.price - a.discount - a.deposit);
}

export function apptDateTime(a: Appointment): number {
  return new Date(`${a.date}T${a.time}:00`).getTime();
}

const ACTIVE_STATUSES = new Set<Appointment['status']>(['unconfirmed', 'confirmed', 'checked-in', 'in-service']);

export function isUpcoming(a: Appointment): boolean {
  return ACTIVE_STATUSES.has(a.status) && a.date >= todayISO();
}

export function getAppointmentsForDate(s: AppState, date: string): Appointment[] {
  return s.appointments
    .filter((a) => a.date === date && a.status !== 'cancelled')
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function getTodaysSchedule(s: AppState): Appointment[] {
  return getAppointmentsForDate(s, todayISO());
}

export function getNextAppointment(s: AppState): Appointment | undefined {
  const now = Date.now();
  const upcoming = s.appointments
    .filter((a) => isUpcoming(a) && apptDateTime(a) >= now - 30 * 60000)
    .sort((a, b) => apptDateTime(a) - apptDateTime(b));
  return upcoming[0];
}

export function getExpectedRevenueToday(s: AppState): number {
  return getTodaysSchedule(s).reduce((sum, a) => sum + apptTotal(a), 0);
}

export function getOutstandingTotal(s: AppState): number {
  return s.appointments
    .filter((a) => a.status === 'completed' && !a.balancePaid)
    .reduce((sum, a) => sum + apptBalance(a), 0);
}

export function getOutstandingForClient(s: AppState, clientId: string): number {
  return s.appointments
    .filter((a) => a.clientId === clientId && a.status === 'completed' && !a.balancePaid)
    .reduce((sum, a) => sum + apptBalance(a), 0);
}

function isThisMonth(iso: string): boolean {
  const d = new Date(iso + 'T00:00:00');
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export function getRevenueThisMonth(s: AppState): number {
  return s.payments.filter((p) => isThisMonth(p.date)).reduce((sum, p) => sum + p.amount, 0);
}

export function getExpensesThisMonth(s: AppState): number {
  return s.expenses.filter((e) => isThisMonth(e.date)).reduce((sum, e) => sum + e.amount, 0);
}

export function getNetProfit(s: AppState): number {
  return getRevenueThisMonth(s) - getExpensesThisMonth(s);
}

export function getAvgTicket(s: AppState): number {
  const completed = s.appointments.filter((a) => a.status === 'completed' && isThisMonth(a.date));
  if (completed.length === 0) return 0;
  return Math.round((completed.reduce((sum, a) => sum + apptTotal(a), 0) / completed.length) * 100) / 100;
}

export function getLowStockItems(s: AppState): InventoryItem[] {
  return s.inventory.filter((i) => i.qty <= i.reorderLevel);
}

export function servicesLeft(item: InventoryItem): number | null {
  const perServiceValues = Object.values(item.usagePerService);
  if (perServiceValues.length === 0) return null;
  const avgUse = perServiceValues.reduce((a, b) => a + b, 0) / perServiceValues.length;
  if (avgUse <= 0) return null;
  return Math.floor(item.qty / avgUse);
}

export function hasUpcomingAppt(s: AppState, clientId: string): boolean {
  return s.appointments.some((a) => a.clientId === clientId && isUpcoming(a));
}

export interface RetentionEntry {
  client: Client;
  daysSince: number;
  dueDate: string;
}

export function getRetentionGroups(s: AppState) {
  const rebookDays = s.business.rebookWeeks * 7;
  const dueSoon: RetentionEntry[] = [];
  const dueNow: RetentionEntry[] = [];
  const overdue: RetentionEntry[] = [];
  const lost: RetentionEntry[] = [];

  s.clients.forEach((c) => {
    if (!c.lastVisit) return;
    if (hasUpcomingAppt(s, c.id)) return;
    const daysSince = daysBetween(c.lastVisit, todayISO());
    const daysPastDue = daysSince - rebookDays;
    if (daysSince >= 90) {
      lost.push({ client: c, daysSince, dueDate: c.lastVisit });
    } else if (daysPastDue >= 28) {
      overdue.push({ client: c, daysSince, dueDate: c.lastVisit });
    } else if (daysPastDue >= 0) {
      dueNow.push({ client: c, daysSince, dueDate: c.lastVisit });
    } else if (daysPastDue >= -7) {
      dueSoon.push({ client: c, daysSince, dueDate: c.lastVisit });
    }
  });

  const byDays = (a: RetentionEntry, b: RetentionEntry) => b.daysSince - a.daysSince;
  return {
    dueSoon: dueSoon.sort(byDays),
    dueNow: dueNow.sort(byDays),
    overdue: overdue.sort(byDays),
    lost: lost.sort(byDays),
  };
}

export function potentialRevenue(s: AppState, entries: RetentionEntry[]): number {
  const avg = getAvgTicket(s) || 90;
  return Math.round(entries.length * avg);
}

export interface AttentionItem {
  id: string;
  text: string;
  color: string;
  onClick: 'client' | 'grow-retention' | 'money-inventory' | 'bookings-unconfirmed' | 'grow-loyalty';
  targetId?: string;
}

export function getNeedsAttention(s: AppState): AttentionItem[] {
  const items: AttentionItem[] = [];

  const owing = s.clients
    .map((c) => ({ c, owed: getOutstandingForClient(s, c.id) }))
    .filter((x) => x.owed > 0)
    .sort((a, b) => b.owed - a.owed);
  owing.slice(0, 2).forEach(({ c, owed }) => {
    items.push({ id: `owe_${c.id}`, text: `${c.name.split(' ')[0]} owes $${owed.toFixed(0)}`, color: 'var(--color-bad-500)', onClick: 'client', targetId: c.id });
  });

  const { dueNow, overdue } = getRetentionGroups(s);
  const rebookCount = dueNow.length + overdue.length;
  if (rebookCount > 0) {
    items.push({ id: 'rebook', text: `${rebookCount} client${rebookCount === 1 ? '' : 's'} due for rebooking`, color: 'var(--color-warn-500)', onClick: 'grow-retention' });
  }

  const low = getLowStockItems(s);
  low.slice(0, 1).forEach((item) => {
    items.push({ id: `low_${item.id}`, text: `${item.name} low stock`, color: 'var(--color-warn-500)', onClick: 'money-inventory' });
  });

  const unconfirmedCount = s.appointments.filter((a) => a.status === 'unconfirmed' && isUpcoming(a)).length;
  if (unconfirmedCount > 0) {
    items.push({ id: 'unconfirmed', text: `${unconfirmedCount} booking${unconfirmedCount === 1 ? '' : 's'} need confirmation`, color: 'var(--color-gold-600)', onClick: 'bookings-unconfirmed' });
  }

  const upcomingBdays = s.clients
    .map((c) => ({ c, days: birthdayDaysUntil(c.birthday) }))
    .filter((x) => x.days <= 7)
    .sort((a, b) => a.days - b.days);
  upcomingBdays.slice(0, 1).forEach(({ c, days }) => {
    items.push({ id: `bday_${c.id}`, text: `${c.name.split(' ')[0]} birthday in ${days} day${days === 1 ? '' : 's'}`, color: 'var(--color-gold-600)', onClick: 'client', targetId: c.id });
  });

  return items;
}

export function getUpcomingBirthdays(s: AppState, withinDays = 30) {
  return s.clients
    .map((c) => ({ client: c, days: birthdayDaysUntil(c.birthday) }))
    .filter((x) => x.days <= withinDays)
    .sort((a, b) => a.days - b.days);
}

export function getReviewCandidates(s: AppState, withinDays = 14) {
  const cutoff = isoDaysAgo(withinDays);
  const seen = new Set<string>();
  const result: { client: Client; appt: Appointment }[] = [];
  s.appointments
    .filter((a) => a.status === 'completed' && a.date >= cutoff)
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((a) => {
      if (seen.has(a.clientId)) return;
      const c = getClient(s, a.clientId);
      if (!c) return;
      seen.add(a.clientId);
      result.push({ client: c, appt: a });
    });
  return result;
}

export function getReferralCandidates(s: AppState) {
  return s.clients.filter((c) => c.vipTier === 'gold' || c.vipTier === 'platinum').sort((a, b) => b.loyaltyPoints - a.loyaltyPoints);
}

export function getServiceProfitability(s: AppState) {
  return s.services
    .filter((sv) => sv.active)
    .map((sv) => {
      const cost = serviceCost(sv);
      const profit = serviceProfit(sv.price, cost);
      const margin = serviceMargin(sv.price, cost);
      return { service: sv, cost, profit, margin };
    })
    .sort((a, b) => b.profit - a.profit);
}

export function getCancellationMatches(s: AppState, appt: Appointment) {
  const clientMatches = s.clients.filter((c) => {
    if (c.id === appt.clientId) return false;
    if (hasUpcomingAppt(s, c.id)) return false;
    const pref = c.beautyProfile.preferredStaffId;
    return pref === appt.staffId || appt.serviceIds.some((id) => id === 'svc_balayage' || id === 'svc_highlight');
  });
  const waitlistMatches = s.waitlist.filter((w) => w.serviceIds.some((id) => appt.serviceIds.includes(id)));
  return { clientMatches: clientMatches.slice(0, 3), waitlistMatches };
}

export interface ActivityEntry {
  id: string;
  text: string;
  date: string;
  time: number;
}

export function getRecentActivity(s: AppState, limit = 6): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  s.payments.slice(0, 20).forEach((p) => {
    const c = getClient(s, p.clientId);
    entries.push({ id: p.id, text: `${c?.name ?? 'Client'} paid $${p.amount.toFixed(0)} (${p.type})`, date: p.date, time: new Date(p.date).getTime() + 1 });
  });
  s.appointments
    .filter((a) => a.status === 'completed')
    .slice(-20)
    .forEach((a) => {
      const c = getClient(s, a.clientId);
      entries.push({ id: `done_${a.id}`, text: `${c?.name ?? 'Client'} completed ${serviceNames(s, a.serviceIds)}`, date: a.date, time: new Date(a.date).getTime() + 2 });
    });
  s.clients.slice(0, 5).forEach((c) => {
    entries.push({ id: `new_${c.id}`, text: `${c.name} added as a new client`, date: c.createdAt, time: new Date(c.createdAt).getTime() });
  });
  return entries.sort((a, b) => b.time - a.time).slice(0, limit);
}

export function getSearchResults(s: AppState, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return { clients: [], appointments: [] };
  const clients = s.clients.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q)).slice(0, 5);
  const appointments = s.appointments
    .filter((a) => {
      const c = getClient(s, a.clientId);
      return c && (c.name.toLowerCase().includes(q) || serviceNames(s, a.serviceIds).toLowerCase().includes(q));
    })
    .slice(0, 5);
  return { clients, appointments };
}

export function vipEligibleForReferral(c: Client) {
  return c.vipTier === 'gold' || c.vipTier === 'platinum';
}
