import type { AppState } from '../store/types';
import type { Appointment, Client, GiftCard, InventoryItem, Payment, Service, StaffMember } from '../types';
import { isMoneyIn, isUsableCard } from './finance';
import { todayISO, daysBetween, birthdayDaysUntil, isoDaysAgo, isoDaysFromNow, WEEKDAYS_LONG } from './dates';
import { serviceCost, serviceMargin, serviceProfit } from './pricing';
import { isOpenDay } from './hours';

type S = Pick<AppState, 'clients' | 'appointments' | 'payments' | 'services' | 'staff' | 'inventory' | 'expenses' | 'business' | 'waitlist' | 'loyaltyRewards'>;

/* ---------- memo helpers (keep selectors fast with thousands of records) ---------- */

function memoByRef<A extends object, R>(fn: (a: A) => R): (a: A) => R {
  const cache = new WeakMap<A, { day: string; value: R }>();
  return (a) => {
    const day = todayISO();
    const hit = cache.get(a);
    if (hit && hit.day === day) return hit.value;
    const value = fn(a);
    cache.set(a, { day, value });
    return value;
  };
}

const indexById = memoByRef(<T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]))) as <T extends { id: string }>(list: T[]) => Map<string, T>;

/* ---------- lookups ---------- */

export function getClient(s: Pick<S, 'clients'>, id: string | null | undefined): Client | undefined {
  if (!id) return undefined;
  return indexById(s.clients).get(id);
}

export function clientName(s: Pick<S, 'clients'>, id: string): string {
  return getClient(s, id)?.name ?? 'Deleted client';
}

export function getStaff(s: Pick<S, 'staff'>, id: string): StaffMember | undefined {
  return indexById(s.staff).get(id);
}

export function staffName(s: Pick<S, 'staff'>, id: string): string {
  const st = getStaff(s, id);
  if (!st) return 'Former staff';
  return st.archived ? `${st.name} (former)` : st.name;
}

export function getServices(s: Pick<S, 'services'>, ids: string[]): Service[] {
  const idx = indexById(s.services);
  return ids.map((id) => idx.get(id)).filter((x): x is Service => Boolean(x));
}

export function serviceNames(s: Pick<S, 'services'>, ids: string[]): string {
  const names = getServices(s, ids).map((sv) => sv.name);
  const missing = ids.length - names.length;
  if (missing > 0) names.push(missing === 1 ? 'Removed service' : `${missing} removed services`);
  return names.join(' + ') || 'Service';
}

export function activeStaff(s: Pick<S, 'staff'>): StaffMember[] {
  return s.staff.filter((st) => !st.archived);
}

export function activeClients(s: Pick<S, 'clients'>): Client[] {
  return s.clients.filter((c) => !c.archived);
}

/* ---------- money per appointment (derived from payments, never from flags) ---------- */

export function apptTotal(a: Appointment): number {
  return Math.max(0, a.price - a.discount);
}

export function apptProductsTotal(a: Appointment): number {
  return a.productsSold.reduce((sum, l) => sum + l.qty * l.price, 0);
}

/** Everything the client owes for this visit: services after discount + retail products (tips excluded). */
export function apptBill(a: Appointment): number {
  return apptTotal(a) + apptProductsTotal(a);
}

export function activePayments(s: Pick<S, 'payments'>): Payment[] {
  return activePaymentsMemo(s.payments);
}
const activePaymentsMemo = memoByRef((payments: Payment[]) => payments.filter((p) => !p.voided));

const paidByAppt = memoByRef((payments: Payment[]) => {
  const map = new Map<string, number>();
  payments.forEach((p) => {
    if (p.voided || !p.apptId) return;
    map.set(p.apptId, (map.get(p.apptId) || 0) + p.amount - (p.tip || 0));
  });
  return map;
});

/** Amount already paid toward the bill (deposits + balance payments, excluding tips). */
export function apptPaid(s: Pick<S, 'payments'>, apptId: string): number {
  return paidByAppt(s.payments).get(apptId) || 0;
}

/** Cash/card actually received (excludes voids and gift-card/credit redemptions, which were paid for earlier). */
export function moneyInPayments(s: Pick<S, 'payments'>): Payment[] {
  return moneyInMemo(s.payments);
}
const moneyInMemo = memoByRef((payments: Payment[]) => payments.filter(isMoneyIn));

/** Most that can still be applied to this visit: the unpaid bill after checkout, or the unpaid service total before it. */
export function apptPaymentCap(s: Pick<S, 'payments'>, a: Appointment): number {
  if (a.status === 'completed') return apptOutstanding(s, a);
  if (a.status === 'cancelled' || a.status === 'no-show') return 0;
  return apptBalance(s, a);
}

export function apptOutstanding(s: Pick<S, 'payments'>, a: Appointment): number {
  if (a.status !== 'completed') return 0;
  return Math.max(0, Math.round((apptBill(a) - apptPaid(s, a.id)) * 100) / 100);
}

/** Balance still due before/at checkout (services after discount minus what's been paid). */
export function apptBalance(s: Pick<S, 'payments'>, a: Appointment): number {
  return Math.max(0, Math.round((apptTotal(a) - apptPaid(s, a.id)) * 100) / 100);
}

export function apptDateTime(a: Appointment): number {
  return new Date(`${a.date}T${a.time}:00`).getTime();
}

const ACTIVE_STATUSES = new Set<Appointment['status']>(['unconfirmed', 'confirmed', 'checked-in', 'in-service']);

export function isUpcoming(a: Appointment): boolean {
  return ACTIVE_STATUSES.has(a.status) && a.date >= todayISO();
}

export function isOpenStatus(a: Appointment): boolean {
  return ACTIVE_STATUSES.has(a.status);
}

const apptsByDate = memoByRef((appointments: Appointment[]) => {
  const map = new Map<string, Appointment[]>();
  appointments.forEach((a) => {
    if (a.status === 'cancelled') return;
    const list = map.get(a.date);
    if (list) list.push(a);
    else map.set(a.date, [a]);
  });
  map.forEach((list) => list.sort((a, b) => a.time.localeCompare(b.time)));
  return map;
});

export function getAppointmentsForDate(s: Pick<S, 'appointments'>, date: string): Appointment[] {
  return apptsByDate(s.appointments).get(date) || [];
}

export function getTodaysSchedule(s: Pick<S, 'appointments'>): Appointment[] {
  return getAppointmentsForDate(s, todayISO());
}

export function getNextAppointment(s: Pick<S, 'appointments'>): Appointment | undefined {
  const now = Date.now();
  let best: Appointment | undefined;
  s.appointments.forEach((a) => {
    if (!isUpcoming(a) || apptDateTime(a) < now - 30 * 60000) return;
    if (!best || apptDateTime(a) < apptDateTime(best)) best = a;
  });
  return best;
}

export function getExpectedRevenueToday(s: Pick<S, 'appointments'>): number {
  return getTodaysSchedule(s)
    .filter((a) => a.status !== 'no-show')
    .reduce((sum, a) => sum + apptTotal(a), 0);
}

export function getCollectedToday(s: Pick<S, 'payments'>): number {
  const today = todayISO();
  return moneyInPayments(s)
    .filter((p) => p.date === today)
    .reduce((sum, p) => sum + p.amount, 0);
}

const outstandingIndex = new WeakMap<Appointment[], { payments: Payment[]; day: string; byClient: Map<string, number>; total: number; appts: Appointment[] }>();
function outstanding(s: Pick<S, 'appointments' | 'payments'>) {
  const day = todayISO();
  const hit = outstandingIndex.get(s.appointments);
  if (hit && hit.payments === s.payments && hit.day === day) return hit;
  const byClient = new Map<string, number>();
  const appts: Appointment[] = [];
  let total = 0;
  s.appointments.forEach((a) => {
    const owed = apptOutstanding(s, a);
    if (owed <= 0) return;
    appts.push(a);
    total += owed;
    byClient.set(a.clientId, (byClient.get(a.clientId) || 0) + owed);
  });
  appts.sort((a, b) => a.date.localeCompare(b.date));
  const value = { payments: s.payments, day, byClient, total, appts };
  outstandingIndex.set(s.appointments, value);
  return value;
}

export function getOutstandingTotal(s: Pick<S, 'appointments' | 'payments'>): number {
  return outstanding(s).total;
}

export function getOutstandingForClient(s: Pick<S, 'appointments' | 'payments'>, clientId: string): number {
  return outstanding(s).byClient.get(clientId) || 0;
}

export function getOutstandingAppointments(s: Pick<S, 'appointments' | 'payments'>, clientId?: string): Appointment[] {
  const list = outstanding(s).appts;
  return clientId ? list.filter((a) => a.clientId === clientId) : list;
}

function isThisMonth(iso: string): boolean {
  return iso.slice(0, 7) === todayISO().slice(0, 7);
}

export function getRevenueThisMonth(s: Pick<S, 'payments'>): number {
  return moneyInPayments(s)
    .filter((p) => isThisMonth(p.date))
    .reduce((sum, p) => sum + p.amount, 0);
}

export function getTipsThisMonth(s: Pick<S, 'payments'>): number {
  return moneyInPayments(s)
    .filter((p) => isThisMonth(p.date))
    .reduce((sum, p) => sum + (p.tip || 0), 0);
}

/* ---------- gift cards & store credit ---------- */

export function usableCards(s: { giftCards: GiftCard[] }): GiftCard[] {
  return s.giftCards.filter(isUsableCard);
}

/** Cards a client can pay with: their own store credit / cards first, then any other open gift card. */
export function cardsForClient(s: { giftCards: GiftCard[] }, clientId: string): GiftCard[] {
  const own = (c: GiftCard) => (c.clientId === clientId ? 0 : 1);
  return usableCards(s).sort((a, b) => own(a) - own(b) || a.code.localeCompare(b.code));
}

export function getClientCredit(s: { giftCards: GiftCard[] }, clientId: string): number {
  return usableCards(s).filter((c) => c.clientId === clientId).reduce((sum, c) => sum + c.balance, 0);
}

/** Unspent gift card + store credit balances: services the business still owes. */
export function getGiftCardLiability(s: { giftCards: GiftCard[] }): number {
  return Math.round(usableCards(s).reduce((sum, c) => sum + c.balance, 0) * 100) / 100;
}

export function getExpensesThisMonth(s: Pick<S, 'expenses'>): number {
  return s.expenses.filter((e) => isThisMonth(e.date)).reduce((sum, e) => sum + e.amount, 0);
}

export function getNetProfit(s: Pick<S, 'payments' | 'expenses'>): number {
  return getRevenueThisMonth(s) - getExpensesThisMonth(s);
}

export function getAvgTicket(s: Pick<S, 'appointments'>): number {
  const completed = s.appointments.filter((a) => a.status === 'completed' && isThisMonth(a.date));
  if (completed.length === 0) return 0;
  return Math.round((completed.reduce((sum, a) => sum + apptBill(a), 0) / completed.length) * 100) / 100;
}

export function getLowStockItems(s: Pick<S, 'inventory'>): InventoryItem[] {
  return s.inventory.filter((i) => i.qty <= i.reorderLevel);
}

export function servicesLeft(item: InventoryItem): number | null {
  const perServiceValues = Object.values(item.usagePerService).filter((v) => v > 0);
  if (perServiceValues.length === 0) return null;
  const avgUse = perServiceValues.reduce((a, b) => a + b, 0) / perServiceValues.length;
  if (avgUse <= 0) return null;
  return Math.floor(item.qty / avgUse);
}

/** Inventory consumed by a set of services, per item id. */
export function inventoryUsage(inventory: InventoryItem[], serviceIds: string[]): Record<string, number> {
  const usage: Record<string, number> = {};
  serviceIds.forEach((sid) => {
    inventory.forEach((item) => {
      const used = item.usagePerService[sid];
      if (used) usage[item.id] = Math.round(((usage[item.id] || 0) + used) * 1000) / 1000;
    });
  });
  return usage;
}

const upcomingClients = memoByRef((appointments: Appointment[]) => {
  const set = new Set<string>();
  appointments.forEach((a) => {
    if (isUpcoming(a)) set.add(a.clientId);
  });
  return set;
});

export function hasUpcomingAppt(s: Pick<S, 'appointments'>, clientId: string): boolean {
  return upcomingClients(s.appointments).has(clientId);
}

const nextApptByClient = memoByRef((appointments: Appointment[]) => {
  const map = new Map<string, Appointment>();
  appointments.forEach((a) => {
    if (!isUpcoming(a)) return;
    const cur = map.get(a.clientId);
    if (!cur || apptDateTime(a) < apptDateTime(cur)) map.set(a.clientId, a);
  });
  return map;
});

export function getNextApptForClient(s: Pick<S, 'appointments'>, clientId: string): Appointment | undefined {
  return nextApptByClient(s.appointments).get(clientId);
}

/* ---------- retention / rebooking ---------- */

export interface RetentionEntry {
  client: Client;
  daysSince: number;
  dueDate: string;
}

/** Weeks until a client should come back after these services: the shortest service-specific cycle, else the business default. */
export function rebookWeeksFor(s: Pick<S, 'services' | 'business'>, serviceIds: string[]): number {
  const cycles = getServices(s, serviceIds).map((sv) => sv.rebookWeeks).filter((w): w is number => typeof w === 'number' && w > 0);
  return cycles.length ? Math.min(...cycles) : s.business.rebookWeeks;
}

const lastCompletedByClient = memoByRef((appointments: Appointment[]) => {
  const map = new Map<string, Appointment>();
  appointments.forEach((a) => {
    if (a.status !== 'completed') return;
    const cur = map.get(a.clientId);
    if (!cur || apptDateTime(a) > apptDateTime(cur)) map.set(a.clientId, a);
  });
  return map;
});

export function getRetentionGroups(s: Pick<S, 'clients' | 'appointments' | 'business'> & Partial<Pick<S, 'services'>>) {
  const lastByClient = lastCompletedByClient(s.appointments);
  const services = s.services || [];
  const dueSoon: RetentionEntry[] = [];
  const dueNow: RetentionEntry[] = [];
  const overdue: RetentionEntry[] = [];
  const lost: RetentionEntry[] = [];
  const today = todayISO();

  s.clients.forEach((c) => {
    if (c.archived || !c.lastVisit) return;
    if (hasUpcomingAppt(s, c.id)) return;
    const last = lastByClient.get(c.id);
    const rebookDays = (last ? rebookWeeksFor({ services, business: s.business }, last.serviceIds) : s.business.rebookWeeks) * 7;
    const lostAfter = Math.max(90, rebookDays + 42);
    const daysSince = daysBetween(c.lastVisit, today);
    const daysPastDue = daysSince - rebookDays;
    const due = isoDaysFromNow(-daysPastDue);
    const entry = { client: c, daysSince, dueDate: due };
    if (daysSince >= lostAfter) lost.push(entry);
    else if (daysPastDue >= 28) overdue.push(entry);
    else if (daysPastDue >= 0) dueNow.push(entry);
    else if (daysPastDue >= -7) dueSoon.push(entry);
  });

  const byDays = (a: RetentionEntry, b: RetentionEntry) => b.daysSince - a.daysSince;
  return {
    dueSoon: dueSoon.sort(byDays),
    dueNow: dueNow.sort(byDays),
    overdue: overdue.sort(byDays),
    lost: lost.sort(byDays),
  };
}

/** Clients due or overdue for rebooking, most overdue first. */
export function getRebookingOpportunities(s: Pick<S, 'clients' | 'appointments' | 'business'> & Partial<Pick<S, 'services'>>): RetentionEntry[] {
  const { dueNow, overdue } = getRetentionGroups(s);
  return [...overdue, ...dueNow];
}

export function potentialRevenue(s: Pick<S, 'appointments'>, entries: RetentionEntry[]): number {
  const avg = getAvgTicket(s) || 90;
  return Math.round(entries.length * avg);
}

/** The client's most recent completed visit — used to prefill a rebooking. */
export function lastCompletedAppt(s: Pick<S, 'appointments'>, clientId: string): Appointment | undefined {
  return lastCompletedByClient(s.appointments).get(clientId);
}

/* ---------- dashboard ---------- */

export interface AttentionItem {
  id: string;
  text: string;
  color: string;
  onClick: 'client' | 'record-payment' | 'grow-retention' | 'money-inventory' | 'bookings-unconfirmed' | 'grow-loyalty' | 'money-pricing' | 'bookings-date';
  targetId?: string;
  apptId?: string;
  action: string; // verb shown on the button, so every alert says what clicking it does
}

export function getWeakMarginServices(s: Pick<S, 'services'>) {
  return getServiceProfitability(s).filter((p) => p.margin < p.service.targetMargin);
}

/** Open days in the next week with nothing booked yet. */
export function getSlowDays(s: Pick<S, 'appointments' | 'business'>, days = 7): string[] {
  const out: string[] = [];
  for (let i = 1; i <= days; i++) {
    const d = isoDaysFromNow(i);
    if (!isOpenDay(s.business, d)) continue;
    const count = getAppointmentsForDate(s, d).filter((a) => a.status !== 'no-show').length;
    if (count === 0) out.push(d);
  }
  return out;
}

export function getNeedsAttention(s: S): AttentionItem[] {
  const items: AttentionItem[] = [];
  const cur = s.business.currencySymbol;

  const owing = [...outstanding(s).byClient.entries()].sort((a, b) => b[1] - a[1]);
  owing.slice(0, 2).forEach(([clientId, owed]) => {
    const oldest = outstanding(s).appts.find((a) => a.clientId === clientId);
    items.push({ id: `owe_${clientId}`, text: `${clientName(s, clientId).split(' ')[0]} owes ${cur}${owed.toFixed(2)}`, color: 'var(--color-bad-500)', onClick: 'record-payment', targetId: clientId, apptId: oldest?.id, action: 'Collect' });
  });

  const rebookCount = getRebookingOpportunities(s).length;
  if (rebookCount > 0) {
    items.push({ id: 'rebook', text: `${rebookCount} client${rebookCount === 1 ? '' : 's'} due for rebooking`, color: 'var(--color-warn-500)', onClick: 'grow-retention', action: 'Rebook' });
  }

  const low = getLowStockItems(s);
  if (low.length > 0) {
    items.push({ id: 'low_stock', text: low.length === 1 ? `${low[0].name} low stock` : `${low.length} items low on stock`, color: 'var(--color-warn-500)', onClick: 'money-inventory', action: 'Restock' });
  }

  const unconfirmedCount = s.appointments.filter((a) => a.status === 'unconfirmed' && isUpcoming(a)).length;
  if (unconfirmedCount > 0) {
    items.push({ id: 'unconfirmed', text: `${unconfirmedCount} booking${unconfirmedCount === 1 ? '' : 's'} need confirmation`, color: 'var(--color-gold-600)', onClick: 'bookings-unconfirmed', action: 'Confirm' });
  }

  const upcomingBdays = getUpcomingBirthdays(s, 7);
  upcomingBdays.slice(0, 1).forEach(({ client: c, days }) => {
    items.push({ id: `bday_${c.id}`, text: days === 0 ? `${c.name.split(' ')[0]}'s birthday is today` : `${c.name.split(' ')[0]} birthday in ${days} day${days === 1 ? '' : 's'}`, color: 'var(--color-gold-600)', onClick: 'client', targetId: c.id, action: 'Say hi' });
  });

  // Lightweight rule-based insights from data already in the app.
  const weak = getWeakMarginServices(s);
  if (weak.length > 0) {
    items.push({ id: 'weak_margin', text: `${weak.length} service${weak.length === 1 ? '' : 's'} below target margin`, color: 'var(--color-ink-400)', onClick: 'money-pricing', targetId: weak[0].service.id, action: 'Fix price' });
  }
  const slow = getSlowDays(s);
  if (slow.length > 0) {
    const d = new Date(slow[0] + 'T00:00:00');
    items.push({ id: 'slow_day', text: `${WEEKDAYS_LONG[d.getDay()]} has no bookings yet`, color: 'var(--color-ink-400)', onClick: 'bookings-date', targetId: slow[0], action: 'Fill' });
  }

  return items;
}

export function getUpcomingBirthdays(s: Pick<S, 'clients'>, withinDays = 30) {
  return s.clients
    .filter((c) => !c.archived && /^\d{2}-\d{2}$/.test(c.birthday))
    .map((c) => ({ client: c, days: birthdayDaysUntil(c.birthday) }))
    .filter((x) => Number.isFinite(x.days) && x.days <= withinDays)
    .sort((a, b) => a.days - b.days);
}

export function getReviewCandidates(s: Pick<S, 'appointments' | 'clients'>, withinDays = 14) {
  const cutoff = isoDaysAgo(withinDays);
  const seen = new Set<string>();
  const result: { client: Client; appt: Appointment }[] = [];
  s.appointments
    .filter((a) => a.status === 'completed' && a.date >= cutoff)
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((a) => {
      if (seen.has(a.clientId)) return;
      const c = getClient(s, a.clientId);
      if (!c || c.archived) return;
      seen.add(a.clientId);
      result.push({ client: c, appt: a });
    });
  return result;
}

export function getReferralCandidates(s: Pick<S, 'clients'>) {
  return s.clients.filter((c) => !c.archived && (c.vipTier === 'gold' || c.vipTier === 'platinum')).sort((a, b) => b.loyaltyPoints - a.loyaltyPoints);
}

export function getServiceProfitability(s: Pick<S, 'services'>) {
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

const servicesByClient = memoByRef((appointments: Appointment[]) => {
  const map = new Map<string, Set<string>>();
  appointments.forEach((a) => {
    if (a.status !== 'completed') return;
    const set = map.get(a.clientId) || new Set<string>();
    a.serviceIds.forEach((id) => set.add(id));
    map.set(a.clientId, set);
  });
  return map;
});

export function getCancellationMatches(s: Pick<S, 'clients' | 'appointments' | 'waitlist'>, appt: Appointment) {
  const history = servicesByClient(s.appointments);
  const clientMatches = s.clients.filter((c) => {
    if (c.archived || c.id === appt.clientId) return false;
    if (hasUpcomingAppt(s, c.id)) return false;
    if (s.waitlist.some((w) => w.clientId === c.id)) return false;
    const pref = c.beautyProfile.preferredStaffId;
    const hadService = appt.serviceIds.some((id) => history.get(c.id)?.has(id));
    return pref === appt.staffId || hadService;
  });
  const waitlistMatches = s.waitlist.filter((w) => w.clientId !== appt.clientId && w.serviceIds.some((id) => appt.serviceIds.includes(id)));
  return { clientMatches: clientMatches.slice(0, 3), waitlistMatches };
}

/* ---------- activity ---------- */

export interface ActivityEntry {
  id: string;
  text: string;
  date: string;
  time: number;
}

export function getRecentActivity(s: S, limit = 6): ActivityEntry[] {
  const cur = s.business.currencySymbol;
  const entries: ActivityEntry[] = [];
  const byDateDesc = <T extends { date: string }>(a: T, b: T) => b.date.localeCompare(a.date);
  [...activePayments(s)].sort(byDateDesc).slice(0, 20).forEach((p, i) => {
    entries.push({ id: p.id, text: p.type === 'gift-card' ? `${clientName(s, p.clientId)} bought a ${cur}${p.amount.toFixed(0)} gift card` : `${clientName(s, p.clientId)} paid ${cur}${p.amount.toFixed(0)}${p.method === 'Gift card' ? ' from gift card / credit' : ` (${p.type.replace('-', ' ')})`}`, date: p.date, time: new Date(p.date + 'T00:00:00').getTime() + 3 - i * 1e-3 });
  });
  s.appointments
    .filter((a) => a.status === 'completed')
    .sort(byDateDesc)
    .slice(0, 20)
    .forEach((a, i) => {
      entries.push({ id: `done_${a.id}`, text: `${clientName(s, a.clientId)} completed ${serviceNames(s, a.serviceIds)}`, date: a.date, time: new Date(a.date + 'T00:00:00').getTime() + 2 - i * 1e-3 });
    });
  [...s.clients].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).forEach((c) => {
    entries.push({ id: `new_${c.id}`, text: `${c.name} added as a new client`, date: c.createdAt, time: new Date(c.createdAt + 'T00:00:00').getTime() });
  });
  return entries.sort((a, b) => b.time - a.time).slice(0, limit);
}

/* ---------- search ---------- */

const digits = (v: string) => v.replace(/\D/g, '');

export function clientMatches(c: Client, q: string): boolean {
  const qd = digits(q);
  return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (qd.length >= 3 && digits(c.phone).includes(qd)) || c.phone.toLowerCase().includes(q);
}

export interface SearchResults {
  clients: Client[];
  appointments: Appointment[];
  services: Service[];
  staff: StaffMember[];
  payments: Payment[];
  total: number;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Understands "2026-09-23", "9/23", "9/23/26", "sep 23" and "23 sep" so bookings can be found by date. */
export function parseDateQuery(q: string): string | null {
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const pad = (n: number) => String(n).padStart(2, '0');
  const valid = (y: number, m: number, d: number) => {
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
  };
  let m = q.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = q.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) return valid(m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : year, +m[1], +m[2]);
  m = q.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/) || null;
  if (m && MONTHS.includes(m[1].slice(0, 3))) return valid(m[3] ? +m[3] : year, MONTHS.indexOf(m[1].slice(0, 3)) + 1, +m[2]);
  m = q.match(/^(\d{1,2})\s+([a-z]{3,9})\.?(?:\s+(\d{4}))?$/);
  if (m && MONTHS.includes(m[2].slice(0, 3))) return valid(m[3] ? +m[3] : year, MONTHS.indexOf(m[2].slice(0, 3)) + 1, +m[1]);
  return null;
}

export function getSearchResults(s: S, query: string, perGroup = 5): SearchResults {
  const q = query.trim().toLowerCase();
  const empty = { clients: [], appointments: [], services: [], staff: [], payments: [], total: 0 };
  if (!q) return empty;
  const dateQ = parseDateQuery(q);

  const clients = s.clients.filter((c) => clientMatches(c, q)).sort((a, b) => Number(!!a.archived) - Number(!!b.archived));
  const matchedClientIds = new Set(clients.map((c) => c.id));
  const services = s.services.filter((sv) => sv.name.toLowerCase().includes(q) || sv.category.toLowerCase().includes(q));
  const matchedServiceIds = new Set(services.map((sv) => sv.id));
  const staff = s.staff.filter((st) => st.name.toLowerCase().includes(q) || st.role.toLowerCase().includes(q));
  const matchedStaffIds = new Set(staff.map((st) => st.id));

  const today = todayISO();
  const appointments = s.appointments
    .filter((a) => (dateQ ? a.date === dateQ : matchedClientIds.has(a.clientId) || a.serviceIds.some((id) => matchedServiceIds.has(id)) || matchedStaffIds.has(a.staffId) || a.notes.toLowerCase().includes(q) || (q.length >= 4 && a.status.includes(q))))
    // Upcoming first (soonest), then most recent past.
    .sort((a, b) => {
      const af = a.date >= today;
      const bf = b.date >= today;
      if (af !== bf) return af ? -1 : 1;
      return af ? (a.date + a.time).localeCompare(b.date + b.time) : (b.date + b.time).localeCompare(a.date + a.time);
    });

  const amountQ = q.replace(/[^0-9.]/g, '');
  const payments = s.payments
    .filter((p) =>
      dateQ
        ? p.date === dateQ
        : matchedClientIds.has(p.clientId) ||
          (amountQ.length > 0 && /^[^a-z]*$/.test(q) && p.amount.toFixed(2).startsWith(amountQ)) ||
          (p.note || '').toLowerCase().includes(q) ||
          (q.length >= 4 && (p.method.toLowerCase().includes(q) || p.type.replace('-', ' ').includes(q))),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    clients: clients.slice(0, perGroup),
    appointments: appointments.slice(0, perGroup),
    services: services.slice(0, perGroup),
    staff: staff.slice(0, perGroup),
    payments: payments.slice(0, perGroup),
    total: clients.length + appointments.length + services.length + staff.length + payments.length,
  };
}

export function vipEligibleForReferral(c: Client) {
  return c.vipTier === 'gold' || c.vipTier === 'platinum';
}
