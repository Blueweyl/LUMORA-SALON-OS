import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storage } from './setup';

// Release QA: destructive regression tests for the full flow
// Client → Booking → Checkout → Payment → Inventory → Loyalty → Rebook → Cancel/Void/Refund → Backup → Restore.
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date(2026, 8, 23, 8, 0, 0)); // Wednesday 08:00

const { useStore, pickDomain } = await import('../src/store/store');
const sel = await import('../src/lib/selectors');
const fin = await import('../src/lib/finance');
const { STORAGE_KEY, useStorageStatus, flushStorage } = await import('../src/lib/storage');
const { buildBackup, parseBackup, repairDomain } = await import('../src/lib/backup');
const { suggestTimes } = await import('../src/lib/scheduling');
const { isoDaysFromNow, todayISO } = await import('../src/lib/dates');
import type { Appointment } from '../src/types';

const S = () => useStore.getState();
const confirm = () => S().runConfirm();
const r2 = (n: number) => Math.round(n * 100) / 100 + 0;

let seq = 0;
function addClient(name = `QA Client ${++seq}`, extra: Partial<{ phone: string; email: string }> = {}) {
  S().openNewClient();
  S().updateNewClientField('name', name);
  if (extra.phone) S().updateNewClientField('phone', extra.phone);
  if (extra.email) S().updateNewClientField('email', extra.email);
  S().saveNewClient(true);
  const c = S().clients.find((x) => x.name === name)!;
  S().dismissJustAdded();
  return c;
}

function book(p: { clientId: string; serviceIds: string[]; date?: string; staffId?: string; time?: string; deposit?: number; recurring?: 'none' | 'weekly' }): Appointment {
  const date = p.date ?? todayISO();
  const staffIds = p.staffId ? [p.staffId] : ['st_ava', 'st_jordan', 'st_mia'];
  const duration = S().services.filter((sv) => p.serviceIds.includes(sv.id)).reduce((n, sv) => n + sv.duration, 0);
  for (const staffId of staffIds) {
    const time = p.time ?? suggestTimes(S().appointments, S().business, staffId, date, duration, 1)[0];
    if (!time) continue;
    S().openNewAppt({ clientId: p.clientId, serviceIds: p.serviceIds, staffId, date, time });
    if (p.deposit) S().updateNewApptField('deposit', p.deposit);
    if (p.recurring) S().updateNewApptField('recurring', p.recurring);
    const before = S().appointments.length;
    S().saveNewAppt();
    const created = S().appointments.slice(before);
    S().closeNewAppt();
    if (created.length) return created[0];
  }
  throw new Error(`could not book: ${S().toastMsg}`);
}

const appt = (id: string) => S().appointments.find((a) => a.id === id)!;
const client = (id: string) => S().clients.find((c) => c.id === id)!;
const card = (id: string) => S().giftCards.find((c) => c.id === id)!;
const item = (id: string) => S().inventory.find((i) => i.id === id)!;
const paysFor = (id: string) => S().payments.filter((p) => p.apptId === id);

function checkout(apptId: string, opts: { tip?: number; method?: 'Card' | 'Cash'; giftCardId?: string; products?: Record<string, number> } = {}) {
  S().openApptDetail(apptId);
  if (opts.tip) S().updateCheckoutTip(opts.tip);
  if (opts.method) S().setCheckoutPayMethod(opts.method);
  if (opts.giftCardId) S().setCheckoutGiftCard(opts.giftCardId);
  Object.entries(opts.products || {}).forEach(([id, q]) => S().setCheckoutProductQty(id, q));
  S().completeCheckout();
  S().closeCompleteScreen();
}

function pay(d: { clientId: string; apptId?: string; amount: number; type?: 'full' | 'product' | 'package' | 'gift-card' | 'deposit' | 'balance'; method?: 'Card' | 'Cash' | 'Gift card'; giftCardId?: string }, force = false) {
  S().openRecordPayment(d.clientId, d.apptId, d.type);
  S().updateRecordPaymentField('amount', d.amount);
  if (d.method) S().updateRecordPaymentField('method', d.method);
  if (d.giftCardId) S().updateRecordPaymentField('giftCardId', d.giftCardId);
  const before = S().payments.length;
  S().saveRecordPayment(force);
  const added = S().payments.slice(0, S().payments.length - before);
  S().closeRecordPayment();
  return added;
}

function sellCard(clientId: string, amount: number) {
  const [p] = pay({ clientId, amount, type: 'gift-card' });
  return card(p.giftCardId!);
}

function voidPay(id: string) {
  S().voidPayment(id);
  confirm();
}

/** Loyalty invariant for clients created during a test: points = Σ log, never negative. */
function assertPoints(clientId: string) {
  const c = client(clientId);
  expect(c.loyaltyPoints).toBeGreaterThanOrEqual(0);
  expect((c.pointsLog || []).reduce((n, e) => n + e.delta, 0)).toBe(c.loyaltyPoints);
}

/** One financial truth: every screen's number comes from the same payments. */
function assertOneTruth() {
  const s = S();
  const month = todayISO().slice(0, 7);
  const moneyIn = s.payments.filter((p) => !p.voided && p.method !== 'Gift card');
  expect(r2(sel.getRevenueThisMonth(s))).toBe(r2(moneyIn.filter((p) => p.date.startsWith(month)).reduce((n, p) => n + p.amount, 0)));
  expect(r2(sel.getCollectedToday(s))).toBe(r2(moneyIn.filter((p) => p.date === todayISO()).reduce((n, p) => n + p.amount, 0)));
  const owed = s.appointments.filter((a) => a.status === 'completed').reduce((n, a) => n + Math.max(0, r2(sel.apptBill(a) - sel.apptPaid(s, a.id))), 0);
  expect(r2(sel.getOutstandingTotal(s))).toBe(r2(owed));
  expect(r2(s.clients.reduce((n, c) => n + sel.getOutstandingForClient(s, c.id), 0))).toBe(r2(owed));
  for (const a of s.appointments) {
    const paid = sel.apptPaid(s, a.id);
    if (a.status === 'completed') expect(a.balancePaid, `stale flag on ${a.id}`).toBe(paid >= sel.apptBill(a) - 0.005);
  }
  for (const g of s.giftCards) {
    expect(g.balance).toBeGreaterThanOrEqual(0);
    expect(g.balance).toBeLessThanOrEqual(g.initialValue + 0.005);
  }
}

beforeEach(async () => {
  storage.quotaBytes = Infinity;
  await S().resetDemo();
  S().dismissOnboarding();
  useStorageStatus.setState({ saveError: null, loadNotice: null });
});

/* ------------------------------------------------------------------ */

describe('1–2 payments & one financial truth', () => {
  it('the full flow keeps every number in agreement at every step', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_balayage', 'svc_cut'], deposit: 50 });
    assertOneTruth();
    checkout(a.id, { tip: 15, products: { inv_oil: 1 } });
    assertOneTruth();
    expect(sel.apptOutstanding(S(), appt(a.id))).toBe(0);
    // void the final payment → balance re-opens, revenue drops, points follow
    const final = paysFor(a.id).find((p) => p.type === 'balance')!;
    voidPay(final.id);
    assertOneTruth();
    expect(sel.apptOutstanding(S(), appt(a.id))).toBe(r2(215 + 22 - 50));
    assertPoints(c.id);
    // pay part, then the rest
    pay({ clientId: c.id, apptId: a.id, amount: 100 });
    assertOneTruth();
    expect(sel.apptOutstanding(S(), appt(a.id))).toBe(87);
    expect(pay({ clientId: c.id, apptId: a.id, amount: 88 })).toHaveLength(0); // overpay blocked
    pay({ clientId: c.id, apptId: a.id, amount: 87 });
    assertOneTruth();
    expect(appt(a.id).balancePaid).toBe(true);
    assertPoints(c.id);
    expect(client(c.id).loyaltyPoints).toBe(237);
  });

  it('client history (payments tab) shows every payment incl. voided ones, and totals match the money tab', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'] });
    checkout(a.id);
    voidPay(paysFor(a.id)[0].id);
    pay({ clientId: c.id, apptId: a.id, amount: 65 });
    const history = S().payments.filter((p) => p.clientId === c.id);
    expect(history).toHaveLength(2);
    expect(history.filter((p) => p.voided)).toHaveLength(1);
    expect(sel.getOutstandingForClient(S(), c.id)).toBe(0);
    assertOneTruth();
  });

  it('booking save is idempotent (double click creates one appointment)', () => {
    const c = addClient();
    const time = suggestTimes(S().appointments, S().business, 'st_ava', isoDaysFromNow(8), 45, 1)[0];
    S().openNewAppt({ clientId: c.id, serviceIds: ['svc_gelmani'], staffId: 'st_ava', date: isoDaysFromNow(8), time });
    S().updateNewApptField('deposit', 10);
    const before = S().appointments.length;
    S().saveNewAppt();
    S().saveNewAppt();
    expect(S().appointments.length).toBe(before + 1);
    expect(S().payments.filter((p) => p.clientId === c.id)).toHaveLength(1);
  });

  it('stale paid flags in stored data are ignored and rebuilt on load', () => {
    const d = pickDomain(S());
    const emma = d.appointments.find((a) => a.clientId === 'cl_emma' && a.status === 'completed')!;
    const lying = { ...d, appointments: d.appointments.map((a) => (a.id === emma.id ? { ...a, balancePaid: true } : a)) };
    const { domain } = repairDomain(JSON.parse(JSON.stringify(lying)));
    expect(domain.appointments.find((a) => a.id === emma.id)!.balancePaid).toBe(false);
    expect(sel.apptOutstanding({ payments: domain.payments }, emma)).toBe(75);
  });
});

describe('3 gift cards', () => {
  it('multiple redemptions across visits run the card down to exactly zero, never below', () => {
    const c = addClient();
    const gc = sellCard(c.id, 100);
    const rev0 = sel.getRevenueThisMonth(S());
    const v1 = book({ clientId: c.id, serviceIds: ['svc_blowout'] }); // 40
    checkout(v1.id, { giftCardId: gc.id });
    const v2 = book({ clientId: c.id, serviceIds: ['svc_blowout'] }); // 40
    checkout(v2.id, { giftCardId: gc.id });
    expect(card(gc.id).balance).toBe(20);
    const v3 = book({ clientId: c.id, serviceIds: ['svc_blowout'] }); // 40 → 20 card + 20 cash
    checkout(v3.id, { giftCardId: gc.id, method: 'Cash', tip: 5 });
    expect(card(gc.id).balance).toBe(0);
    expect(paysFor(v3.id).map((p) => [p.method, p.amount]).sort()).toEqual([['Cash', 25], ['Gift card', 20]]);
    expect(r2(sel.getRevenueThisMonth(S()) - rev0)).toBe(25); // only the new cash, never the card again
    assertOneTruth();
  });

  it('a card drained between opening checkout and completing it only applies what is left', () => {
    const c = addClient();
    const gc = sellCard(c.id, 50);
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'] });
    S().openApptDetail(a.id);
    S().setCheckoutGiftCard(gc.id);
    // meanwhile the card is used elsewhere
    const emma = S().appointments.find((x) => x.clientId === 'cl_emma' && x.status === 'completed')!;
    pay({ clientId: 'cl_emma', apptId: emma.id, amount: 30, method: 'Gift card', giftCardId: gc.id });
    useStore.setState({ apptDetailId: a.id });
    S().completeCheckout();
    expect(card(gc.id).balance).toBe(0);
    expect(paysFor(a.id).find((p) => p.method === 'Gift card')!.amount).toBe(20);
    expect(sel.apptOutstanding(S(), appt(a.id))).toBe(0);
    assertOneTruth();
  });

  it('insufficient balance is refused for Record Payment and the card is untouched', () => {
    const c = addClient();
    const gc = sellCard(c.id, 10);
    const emma = S().appointments.find((x) => x.clientId === 'cl_emma' && x.status === 'completed')!;
    expect(pay({ clientId: 'cl_emma', apptId: emma.id, amount: 10.01, method: 'Gift card', giftCardId: gc.id })).toHaveLength(0);
    expect(card(gc.id).balance).toBe(10);
  });

  it('refund chain: void redemption → card restored → card voidable → sale leaves revenue', () => {
    const c = addClient();
    const rev0 = sel.getRevenueThisMonth(S());
    const gc = sellCard(c.id, 60);
    const a = book({ clientId: c.id, serviceIds: ['svc_browtint'] });
    checkout(a.id, { giftCardId: gc.id });
    voidPay(paysFor(a.id).find((p) => p.method === 'Gift card')!.id);
    expect(card(gc.id).balance).toBe(60);
    S().voidGiftCard(gc.id);
    confirm();
    expect(card(gc.id).voided).toBe(true);
    expect(sel.getRevenueThisMonth(S())).toBe(rev0);
    expect(sel.apptOutstanding(S(), appt(a.id))).toBe(35);
    assertOneTruth();
  });

  it('gift card state survives backup → restore exactly', () => {
    const c = addClient();
    const gc = sellCard(c.id, 80);
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'] });
    checkout(a.id, { giftCardId: gc.id });
    const parsed = parseBackup(JSON.stringify(buildBackup(pickDomain(S()), 'x')));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.domain.giftCards.find((g) => g.id === gc.id)!.balance).toBe(15);
    expect(parsed.summary.warnings.join(' ')).not.toMatch(/gift card/);
  });

  it('a backup with a card balance above its value, or a payment pointing at a missing card, is repaired/flagged', () => {
    const d = JSON.parse(JSON.stringify(buildBackup(pickDomain(S()), 'x')));
    d.data.giftCards[0].balance = d.data.giftCards[0].initialValue + 500;
    d.data.payments.push({ id: 'pay_x', clientId: 'cl_sarah', apptId: null, amount: 5, method: 'Gift card', type: 'full', date: todayISO(), giftCardId: 'gc_missing' });
    const r = parseBackup(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.domain.giftCards[0].balance).toBe(r.domain.giftCards[0].initialValue);
    expect(r.summary.warnings.join(' ')).toMatch(/gift card that isn't in this backup/);
  });
});

describe('4 duplicate clients', () => {
  it('offers View Existing | Create Anyway; View Existing opens the profile without creating', () => {
    const owner = addClient('Dup Owner', { phone: '(415) 555-0199', email: 'dup@example.com' });
    const count = S().clients.length;
    S().openNewClient();
    S().updateNewClientField('name', 'Dup Other');
    S().updateNewClientField('phone', '+1 415.555.0199');
    S().saveNewClient();
    expect(S().confirmDialog).toMatchObject({ altLabel: 'View Existing', confirmLabel: 'Create Anyway' });
    S().runConfirmAlt();
    expect(S().clients.length).toBe(count);
    expect(S().showNewClient).toBe(false);
    expect(S().selectedClientId).toBe(owner.id);
  });

  it('Create Anyway adds the client', () => {
    addClient('Dup Owner 2', { email: 'x@example.com' });
    S().openNewClient();
    S().updateNewClientField('name', 'Dup Other 2');
    S().updateNewClientField('email', 'X@EXAMPLE.COM');
    S().saveNewClient();
    confirm();
    expect(S().clients.some((c) => c.name === 'Dup Other 2')).toBe(true);
  });
});

describe('5 inventory', () => {
  it('multi-service usage adds up and is deducted once at checkout', () => {
    const c = addClient();
    const toner0 = item('inv_toner').qty;
    const gloves0 = item('inv_gloves').qty;
    const a = book({ clientId: c.id, serviceIds: ['svc_balayage', 'svc_roottouch'] });
    checkout(a.id);
    expect(item('inv_toner').qty).toBe(toner0 - 50);
    expect(item('inv_gloves').qty).toBe(gloves0 - 4);
    useStore.setState({ apptDetailId: a.id });
    S().completeCheckout(); // stale second click
    expect(item('inv_toner').qty).toBe(toner0 - 50);
  });

  it('insufficient supplies: stock stops at zero (never negative) and the owner is told', () => {
    const c = addClient();
    S().updateInventoryField('inv_color7n', 'qty', 0.5);
    const a = book({ clientId: c.id, serviceIds: ['svc_roottouch'] });
    checkout(a.id);
    expect(item('inv_color7n').qty).toBe(0);
    expect(S().toastMsg).toMatch(/check stock: .*Color 7N/);
  });

  it('out-of-stock retail cannot be sold; quantities are capped at stock', () => {
    S().updateInventoryField('inv_oil', 'qty', 0);
    S().openApptDetail(S().appointments.find((a) => a.status === 'confirmed' && a.date === todayISO())!.id);
    S().setCheckoutProductQty('inv_oil', 3);
    expect(S().checkoutDraft.productSelections.inv_oil).toBe(0);
    expect(S().toastMsg).toMatch(/Only 0/);
    S().updateInventoryField('inv_shampoo', 'qty', 2);
    S().setCheckoutProductQty('inv_shampoo', 5);
    expect(S().checkoutDraft.productSelections.inv_shampoo).toBe(2);
  });

  it('negative and invalid stock inputs are refused or clamped to zero', () => {
    S().updateInventoryField('inv_foils', 'qty', -10);
    expect(item('inv_foils').qty).toBe(0);
    S().updateInventoryField('inv_foils', 'qty', Number.NaN);
    expect(item('inv_foils').qty).toBe(0);
    S().restockInventory('inv_foils', -5);
    S().restockInventory('inv_foils', Number.NaN);
    expect(item('inv_foils').qty).toBe(0);
    S().restockInventory('inv_foils', 12);
    expect(item('inv_foils').qty).toBe(12);
    S().setInventoryUsage('inv_foils', 'svc_cut', -3);
    expect(item('inv_foils').usagePerService.svc_cut).toBeUndefined();
  });

  it('removed products keep their name and price on past sales; totals are unchanged', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'] });
    checkout(a.id, { products: { inv_oil: 2 } });
    const bill = sel.apptBill(appt(a.id));
    S().deleteInventoryItem('inv_oil');
    confirm();
    expect(appt(a.id).productsSold[0]).toMatchObject({ name: 'Retail Hair Oil', qty: 2, price: 22 });
    expect(sel.apptBill(appt(a.id))).toBe(bill);
    assertOneTruth();
  });

  it('archived services still deduct their supplies when an existing booking is checked out', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_browtint'] });
    S().archiveToggleService('svc_browtint');
    const tint0 = item('inv_browtint').qty;
    checkout(a.id);
    expect(item('inv_browtint').qty).toBe(tint0 - 1);
  });

  it('estimated services remaining', () => {
    expect(sel.servicesLeft({ ...item('inv_foils'), qty: 100 })).toBe(Math.floor(100 / 22)); // avg of 20 & 24
    expect(sel.servicesLeft({ ...item('inv_foils'), qty: 0 })).toBe(0);
    expect(sel.servicesLeft(item('inv_shampoo'))).toBeNull(); // retail only
  });
});

describe('6 booking regression', () => {
  const day = () => isoDaysFromNow(8); // an open Thursday

  it('overlaps, durations, buffers and hours', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_balayage', 'svc_cut'], staffId: 'st_jordan', date: day(), time: '10:00' });
    expect(a.durationMin).toBe(150); // ends 12:30
    const c2 = addClient();
    expect(() => book({ clientId: c2.id, serviceIds: ['svc_blowout'], staffId: 'st_jordan', date: day(), time: '12:15' })).toThrow(/already booked/);
    expect(() => book({ clientId: c2.id, serviceIds: ['svc_keratin'], staffId: 'st_jordan', date: day(), time: '16:00' })).toThrow(/closing|past/i);
    const ok = book({ clientId: c2.id, serviceIds: ['svc_blowout'], staffId: 'st_jordan', date: day(), time: '12:30' });
    expect(ok.time).toBe('12:30'); // back-to-back allowed (buffer only warns)
  });

  it('reschedule keeps price, deposit and payments; a conflicting move is refused', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'], staffId: 'st_ava', date: day(), time: '09:00', deposit: 20 });
    S().updateServiceField('svc_cut', 'price', 99); // price change after booking
    const blocker = book({ clientId: addClient().id, serviceIds: ['svc_cut'], staffId: 'st_ava', date: day(), time: '14:00' });
    S().openReschedule(a.id);
    S().updateNewApptField('time', '14:15');
    S().saveNewAppt();
    expect(appt(a.id).time).toBe('09:00');
    S().updateNewApptField('time', '11:00');
    S().saveNewAppt();
    expect(appt(a.id)).toMatchObject({ time: '11:00', price: 65 });
    expect(sel.apptPaid(S(), a.id)).toBe(20);
    expect(sel.apptBalance(S(), appt(a.id))).toBe(45);
    void blocker;
  });

  it('weekly recurring: one deposit, same slot each week, clashes skipped', () => {
    const c = addClient();
    const before = S().appointments.length;
    book({ clientId: c.id, serviceIds: ['svc_gelmani'], staffId: 'st_ava', date: day(), time: '16:00', deposit: 15, recurring: 'weekly' });
    const series = S().appointments.slice(before);
    expect(series.length).toBeGreaterThan(1);
    expect(new Set(series.map((a) => a.time)).size).toBe(1);
    expect(S().payments.filter((p) => p.clientId === c.id)).toHaveLength(1);
    expect(series.filter((a) => a.deposit > 0)).toHaveLength(1);
  });

  it('archived staff and services cannot be booked; their history remains', () => {
    S().addStaff('Leaving Soon', 'Stylist');
    const st = S().staff.find((x) => x.name === 'Leaving Soon')!;
    S().removeStaff(st.id);
    confirm();
    const c = addClient();
    // They can't be pre-selected…
    S().openNewAppt({ clientId: c.id, serviceIds: ['svc_cut'], staffId: st.id, date: day(), time: '09:00' });
    expect(S().newApptDraft.staffId).not.toBe(st.id);
    // …and a forced selection is refused on save.
    S().updateNewApptField('staffId', st.id);
    const n = S().appointments.length;
    S().saveNewAppt();
    expect(S().appointments.length).toBe(n);
    expect(S().toastMsg).toMatch(/no longer on the team/);
    S().closeNewAppt();
    S().archiveToggleService('svc_lashlift');
    S().openNewAppt({ clientId: c.id, serviceIds: ['svc_lashlift'], staffId: 'st_ava', date: day(), time: '09:00' });
    expect(S().newApptDraft.serviceIds).toEqual([]);
    S().updateNewApptField('serviceIds', ['svc_lashlift']);
    S().saveNewAppt();
    expect(S().appointments.length).toBe(n);
    expect(S().toastMsg).toMatch(/archived/);
    S().closeNewAppt();
    expect(sel.serviceNames(S(), ['svc_lashlift'])).toBe('Lash Lift & Tint');
  });
});

describe('7 deposits on cancellation', () => {
  const setup = () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_balayage'], date: isoDaysFromNow(8), deposit: 40 });
    return { c, a };
  };
  it.each([
    ['kept', 40, 0],
    ['credit', 40, 40],
    ['refunded', 0, 0],
  ] as const)('%s: revenue keeps %s, client credit %s, nothing owed', (choice, revenueKept, credit) => {
    const rev0 = sel.getRevenueThisMonth(S());
    const { c, a } = setup();
    S().apptAction(a.id, 'cancel');
    S().setConfirmChoice(choice);
    confirm();
    expect(r2(sel.getRevenueThisMonth(S()) - rev0)).toBe(revenueKept);
    expect(sel.getClientCredit(S(), c.id)).toBe(credit);
    expect(sel.getOutstandingForClient(S(), c.id)).toBe(0);
    expect(appt(a.id).depositOutcome).toBe(choice);
    assertOneTruth();
  });
});

describe('8 loyalty', () => {
  it('points follow money paid: earn at checkout, reversed on void, re-earned on payment', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'] });
    checkout(a.id, { tip: 10 });
    expect(client(c.id).loyaltyPoints).toBe(65); // tips earn nothing
    voidPay(paysFor(a.id)[0].id);
    expect(client(c.id).loyaltyPoints).toBe(0);
    expect(client(c.id).pointsLog![0]).toMatchObject({ delta: -65, reason: expect.stringMatching(/voided/) });
    pay({ clientId: c.id, apptId: a.id, amount: 30.5 });
    expect(client(c.id).loyaltyPoints).toBe(30);
    pay({ clientId: c.id, apptId: a.id, amount: 34.5 });
    expect(client(c.id).loyaltyPoints).toBe(65);
    assertPoints(c.id);
  });

  it('points spent on a reward are not clawed below zero by a later void', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_keratin'] });
    checkout(a.id, { products: { inv_shampoo: 12 } }); // 508 pts
    const reward = S().loyaltyRewards.find((r) => r.pointsCost === 500)!;
    S().redeemReward(c.id, reward.id);
    confirm();
    expect(client(c.id).loyaltyPoints).toBe(8);
    voidPay(paysFor(a.id)[0].id);
    expect(client(c.id).loyaltyPoints).toBe(0);
    expect(client(c.id).pointsLog![0].delta).toBe(-8); // the log shows what was actually removed
    assertPoints(c.id);
  });

  it('a double-clicked redemption only redeems once; cancelling redeems nothing', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_keratin'] });
    checkout(a.id, { products: { inv_shampoo: 12 } });
    const reward = S().loyaltyRewards.find((r) => r.pointsCost === 500)!;
    S().redeemReward(c.id, reward.id);
    S().closeConfirm();
    expect(client(c.id).loyaltyPoints).toBe(508);
    S().redeemReward(c.id, reward.id);
    confirm();
    confirm();
    expect(client(c.id).loyaltyPoints).toBe(8);
    assertPoints(c.id);
  });

  it('points history survives backup → restore', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'] });
    checkout(a.id);
    const r = parseBackup(JSON.stringify(buildBackup(pickDomain(S()), 'x')));
    expect(r.ok && r.domain.clients.find((x) => x.id === c.id)!.pointsLog).toEqual(client(c.id).pointsLog);
  });
});

describe('9 persistence', () => {
  it('refresh after a full money flow restores identical totals and records', async () => {
    const c = addClient();
    const gc = sellCard(c.id, 50);
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'], deposit: 10 });
    checkout(a.id, { giftCardId: gc.id, tip: 4 });
    const b = book({ clientId: c.id, serviceIds: ['svc_balayage'], date: isoDaysFromNow(8), deposit: 30 });
    S().apptAction(b.id, 'cancel');
    S().setConfirmChoice('credit');
    confirm();
    const snap = () => ({
      rev: sel.getRevenueThisMonth(S()),
      owed: sel.getOutstandingTotal(S()),
      liab: sel.getGiftCardLiability(S()),
      credit: sel.getClientCredit(S(), c.id),
      points: client(c.id).loyaltyPoints,
      log: client(c.id).pointsLog,
      payments: S().payments.length,
    });
    const before = snap();
    await flushStorage();
    useStore.setState({ payments: [], giftCards: [], clients: [] }); // simulate a fresh tab
    await useStore.persist.rehydrate();
    expect(snap()).toEqual(before);
    assertOneTruth();
  });

  it('malformed money records are dropped on load without crashing, and reported', async () => {
    await flushStorage();
    const raw = JSON.parse(storage.getItem(STORAGE_KEY)!);
    raw.state.payments.push({ id: 'bad1', clientId: 'cl_sarah', amount: -50 }, { id: 'bad2', clientId: 'cl_sarah', amount: 'abc' }, null);
    raw.state.giftCards.push({ id: 'gcbad', initialValue: 20, balance: -5, code: 'NEG-1' });
    storage.setItem(STORAGE_KEY, JSON.stringify(raw));
    await useStore.persist.rehydrate();
    expect(useStorageStatus.getState().loadNotice).toMatch(/couldn't be read|could not be read/);
    expect(S().payments.every((p) => p.amount > 0)).toBe(true);
    expect(card('gcbad').balance).toBe(0);
    assertOneTruth();
  });

  it('backup → restore → backup produces the same data (no drift)', async () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'] });
    checkout(a.id);
    const first = buildBackup(pickDomain(S()), 'x');
    const r = parseBackup(JSON.stringify(first));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const second = buildBackup(r.domain, 'x');
    expect(second.data.payments).toEqual(first.data.payments);
    expect(second.data.appointments).toEqual(first.data.appointments);
    expect(second.data.giftCards).toEqual(first.data.giftCards);
    expect(second.data.clients).toEqual(first.data.clients);
  });
});

describe('fin helpers', () => {
  it('visitPoints never exceeds the bill or goes negative', () => {
    expect(fin.visitPoints(100, 150)).toBe(100);
    expect(fin.visitPoints(100, -5)).toBe(0);
    expect(fin.visitPoints(99.99, 99.99)).toBe(99);
  });
});
