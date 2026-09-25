import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storage } from './setup';

// Frozen Wednesday morning (same as store.test) so demo data and hours are deterministic.
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date(2026, 8, 23, 8, 0, 0));

const { useStore } = await import('../src/store/store');
const sel = await import('../src/lib/selectors');
const fin = await import('../src/lib/finance');
const { useStorageStatus } = await import('../src/lib/storage');
const { buildBackup, parseBackup } = await import('../src/lib/backup');
const { suggestTimes, checkBooking } = await import('../src/lib/scheduling');
const { isoDaysFromNow, todayISO } = await import('../src/lib/dates');
import type { Appointment, Payment } from '../src/types';

const S = () => useStore.getState();
const confirm = () => S().runConfirm();
const r2 = (n: number) => Math.round(n * 100) / 100 + 0; // + 0 folds -0 into 0

async function demo() {
  await S().resetDemo();
  S().dismissOnboarding();
  useStorageStatus.setState({ saveError: null, loadNotice: null });
}

let seq = 0;
function addClient(name = `Client ${++seq}`, extra: Partial<{ phone: string; email: string }> = {}) {
  S().openNewClient();
  S().updateNewClientField('name', name);
  if (extra.phone) S().updateNewClientField('phone', extra.phone);
  if (extra.email) S().updateNewClientField('email', extra.email);
  S().saveNewClient(true);
  const c = S().clients.find((x) => x.name === name)!;
  S().dismissJustAdded();
  return c;
}

/** Books into the first free slot so tests never collide with demo appointments. */
function book(p: { clientId: string; serviceIds: string[]; date?: string; staffId?: string; deposit?: number; discount?: number; depositMethod?: 'Card' | 'Cash' }): Appointment {
  const date = p.date ?? todayISO();
  const staffIds = p.staffId ? [p.staffId] : ['st_ava', 'st_jordan', 'st_mia'];
  const duration = S().services.filter((sv) => p.serviceIds.includes(sv.id)).reduce((n, sv) => n + sv.duration, 0);
  for (const staffId of staffIds) {
    const slots = suggestTimes(S().appointments, S().business, staffId, date, duration, 1);
    if (!slots.length) continue;
    S().openNewAppt({ clientId: p.clientId, serviceIds: p.serviceIds, staffId, date, time: slots[0] });
    if (p.discount) S().updateNewApptField('discount', p.discount);
    if (p.deposit) S().updateNewApptField('deposit', p.deposit);
    if (p.depositMethod) S().updateNewApptField('depositMethod', p.depositMethod);
    const before = S().appointments.length;
    S().saveNewAppt();
    const created = S().appointments.slice(before);
    if (created.length) return created[0];
  }
  throw new Error(`no free slot on ${date}: ${S().toastMsg}`);
}

const appt = (id: string) => S().appointments.find((a) => a.id === id)!;
const paysFor = (id: string) => S().payments.filter((p) => p.apptId === id);
const card = (id: string) => S().giftCards.find((c) => c.id === id)!;

function checkout(apptId: string, opts: { tip?: number; method?: 'Card' | 'Cash'; giftCardId?: string; products?: Record<string, number> } = {}) {
  S().openApptDetail(apptId);
  if (opts.tip) S().updateCheckoutTip(opts.tip);
  if (opts.method) S().setCheckoutPayMethod(opts.method);
  if (opts.giftCardId) S().setCheckoutGiftCard(opts.giftCardId);
  Object.entries(opts.products || {}).forEach(([id, q]) => S().setCheckoutProductQty(id, q));
  S().completeCheckout();
  S().closeCompleteScreen();
}

function recordPayment(d: Partial<ReturnType<typeof S>['recordPaymentDraft']> & { clientId: string }, force = false) {
  S().openRecordPayment(d.clientId, d.apptId, d.type);
  (Object.keys(d) as (keyof typeof d)[]).forEach((k) => {
    if (k !== 'clientId' && k !== 'apptId') S().updateRecordPaymentField(k, d[k] as never);
  });
  const before = S().payments.length;
  S().saveRecordPayment(force);
  return { added: S().payments.slice(0, S().payments.length - before), toast: S().toastMsg, open: S().showRecordPayment };
}

function sellCard(clientId: string, amount: number, method: 'Card' | 'Cash' = 'Card') {
  const { added } = recordPayment({ clientId, type: 'gift-card', amount, method });
  expect(added).toHaveLength(1);
  return card(added[0].giftCardId!);
}

/* ------------------------------------------------------------------ */
/* Ledger invariants: checked after every scenario and every fuzz step */
/* ------------------------------------------------------------------ */

let cardBaseline = new Map<string, number>();
function redeemedFrom(cardId: string) {
  return S().payments.filter((p) => !p.voided && p.method === 'Gift card' && p.giftCardId === cardId).reduce((n, p) => n + p.amount, 0);
}
function snapshotCards() {
  cardBaseline = new Map(S().giftCards.map((c) => [c.id, r2(c.initialValue - c.balance - redeemedFrom(c.id))]));
}

function assertLedger() {
  const s = S();
  const month = todayISO().slice(0, 7);
  // 1. no negative or malformed payments; tips never exceed the payment
  for (const p of s.payments) {
    expect(p.amount).toBeGreaterThan(0);
    expect(p.tip ?? 0).toBeLessThanOrEqual(p.amount);
    if (p.method === 'Gift card') expect(p.giftCardId, 'redemption must name its card').toBeTruthy();
  }
  // 2. revenue = every non-voided cash/card payment this month; redemptions never count
  const expectedRevenue = s.payments.filter((p) => !p.voided && p.method !== 'Gift card' && p.date.startsWith(month)).reduce((n, p) => n + p.amount, 0);
  expect(r2(sel.getRevenueThisMonth(s))).toBe(r2(expectedRevenue));
  // 3. outstanding = Σ max(0, bill − paid) over completed visits; flags agree with payments
  let owed = 0;
  const hasPayments = new Set(s.payments.map((p) => p.apptId));
  const creditBySource = new Map<string, number>();
  s.giftCards.forEach((c) => c.sourceApptId && c.kind === 'credit' && creditBySource.set(c.sourceApptId, (creditBySource.get(c.sourceApptId) || 0) + c.initialValue));
  const redeemed = new Map<string, number>();
  s.payments.forEach((p) => !p.voided && p.method === 'Gift card' && p.giftCardId && redeemed.set(p.giftCardId, (redeemed.get(p.giftCardId) || 0) + p.amount));
  for (const a of s.appointments) {
    const paid = sel.apptPaid(s, a.id);
    expect(paid).toBeGreaterThanOrEqual(-0.001);
    if (a.status === 'completed') {
      const bill = sel.apptBill(a);
      owed += Math.max(0, r2(bill - paid));
      if (paid >= bill - 0.005) expect(a.balancePaid, `visit ${a.id} is fully paid`).toBe(true);
      else if (hasPayments.has(a.id)) expect(a.balancePaid, `visit ${a.id} still owes`).toBe(false);
      // Never more collected than billed, unless the difference became store credit.
      const credit = creditBySource.get(a.id) || 0;
      expect(paid).toBeLessThanOrEqual(bill + credit + 0.005);
    } else if (a.status !== 'cancelled' && a.status !== 'no-show') {
      expect(paid).toBeLessThanOrEqual(sel.apptTotal(a) + 0.005);
    }
  }
  expect(r2(sel.getOutstandingTotal(s))).toBe(r2(owed));
  // 4. gift cards: 0 ≤ balance ≤ value, and balance moves exactly with redemptions
  for (const c of s.giftCards) {
    expect(c.balance).toBeGreaterThanOrEqual(0);
    expect(c.balance).toBeLessThanOrEqual(c.initialValue + 0.005);
    if (c.voided) {
      expect(c.balance).toBe(0);
      continue;
    }
    const base = cardBaseline.get(c.id) ?? 0;
    expect(r2(c.initialValue - c.balance - (redeemed.get(c.id) || 0))).toBe(base);
  }
  // 5. a sold gift card's sale payment exists (unless voided with it)
  for (const c of s.giftCards.filter((x) => x.kind === 'gift' && cardBaseline.get(x.id) === 0 && !x.voided)) {
    const sale = s.payments.find((p) => p.type === 'gift-card' && p.giftCardId === c.id);
    if (sale) expect(sale.voided).toBeFalsy();
  }
  // 6. liability = unspent balances
  expect(sel.getGiftCardLiability(s)).toBe(r2(s.giftCards.filter((c) => !c.voided && c.balance > 0.004).reduce((n, c) => n + c.balance, 0)));
}

beforeEach(async () => {
  storage.quotaBytes = Infinity;
  await demo();
  snapshotCards();
  assertLedger();
});

/* ------------------------------------------------------------------ */

describe('P0 overpayments', () => {
  it('rejects a payment above what a visit owes and records nothing', () => {
    const emma = S().appointments.find((a) => a.clientId === 'cl_emma' && a.status === 'completed')!;
    expect(sel.apptOutstanding(S(), emma)).toBe(75);
    const r = recordPayment({ clientId: 'cl_emma', apptId: emma.id, amount: 80 });
    expect(r.added).toHaveLength(0);
    expect(r.open).toBe(true);
    expect(r.toast).toMatch(/more than the \$75\.00 owed/);
    assertLedger();
  });

  it('accepts the exact amount and marks the visit paid', () => {
    const emma = S().appointments.find((a) => a.clientId === 'cl_emma' && a.status === 'completed')!;
    const r = recordPayment({ clientId: 'cl_emma', apptId: emma.id, amount: 75 });
    expect(r.added).toHaveLength(1);
    expect(appt(emma.id).balancePaid).toBe(true);
    expect(r.toast).toMatch(/paid in full/);
    assertLedger();
  });

  it('partial payments reduce the balance; once settled, nothing more can be applied', () => {
    const emma = S().appointments.find((a) => a.clientId === 'cl_emma' && a.status === 'completed')!;
    expect(recordPayment({ clientId: 'cl_emma', apptId: emma.id, amount: 30 }).toast).toMatch(/\$45\.00 still owed/);
    expect(sel.apptOutstanding(S(), appt(emma.id))).toBe(45);
    recordPayment({ clientId: 'cl_emma', apptId: emma.id, amount: 45 });
    expect(sel.apptOutstanding(S(), appt(emma.id))).toBe(0);
    const third = recordPayment({ clientId: 'cl_emma', apptId: emma.id, amount: 5 });
    expect(third.added).toHaveLength(0);
    expect(third.toast).toMatch(/Nothing is owed/);
    assertLedger();
  });

  it('caps a deposit at the booking total', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_gelmani'], date: isoDaysFromNow(7) });
    const over = recordPayment({ clientId: c.id, apptId: a.id, amount: 46, type: 'deposit' });
    expect(over.added).toHaveLength(0);
    const ok = recordPayment({ clientId: c.id, apptId: a.id, amount: 45, type: 'deposit' });
    expect(ok.added).toHaveLength(1);
    expect(appt(a.id).depositPaid).toBe(true);
    expect(sel.apptBalance(S(), appt(a.id))).toBe(0);
    assertLedger();
  });

  it('a "balance" or "deposit" payment must say which visit it is for', () => {
    const c = addClient();
    S().openRecordPayment(c.id);
    S().updateRecordPaymentField('amount', 20);
    S().updateRecordPaymentField('type', 'balance');
    S().saveRecordPayment();
    expect(S().toastMsg).toMatch(/which unpaid visit/);
    S().updateRecordPaymentField('type', 'deposit');
    S().saveRecordPayment();
    expect(S().toastMsg).toMatch(/which booking/);
    expect(S().payments.filter((p) => p.clientId === c.id)).toHaveLength(0);
  });

  it.each([0, -5, Number.NaN])('rejects an amount of %s', (amt) => {
    const c = addClient();
    const r = recordPayment({ clientId: c.id, amount: amt });
    expect(r.added).toHaveLength(0);
    expect(r.toast).toMatch(/amount above zero/);
  });

  it('rejects a payment for a visit that belongs to another client', () => {
    const emma = S().appointments.find((a) => a.clientId === 'cl_emma' && a.status === 'completed')!;
    const c = addClient();
    S().openRecordPayment(c.id);
    useStore.setState({ recordPaymentDraft: { ...S().recordPaymentDraft, apptId: emma.id, amount: 10, type: 'balance' } });
    S().saveRecordPayment();
    expect(S().payments.filter((p) => p.clientId === c.id)).toHaveLength(0);
    assertLedger();
  });

  it('checkout never charges again for money already paid', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'], deposit: 65 });
    checkout(a.id, { tip: 5 });
    const pays = paysFor(a.id).filter((p) => !p.voided);
    expect(pays.map((p) => p.amount).sort()).toEqual([5, 65]); // deposit + tip only
    expect(pays.find((p) => p.amount === 5)!.tip).toBe(5);
    assertLedger();
  });
});

describe('P0 duplicate payments', () => {
  it('asks before recording the same payment twice, and records nothing if declined', () => {
    const c = addClient();
    recordPayment({ clientId: c.id, amount: 40, type: 'product', method: 'Cash' });
    const second = recordPayment({ clientId: c.id, amount: 40, type: 'product', method: 'Cash' });
    expect(second.added).toHaveLength(0);
    expect(S().confirmDialog?.title).toMatch(/duplicate/);
    S().closeConfirm();
    expect(S().payments.filter((p) => p.clientId === c.id)).toHaveLength(1);
  });

  it('records the repeat when the owner confirms it is real', () => {
    const c = addClient();
    recordPayment({ clientId: c.id, amount: 40, type: 'product' });
    recordPayment({ clientId: c.id, amount: 40, type: 'product' });
    confirm();
    expect(S().payments.filter((p) => p.clientId === c.id && !p.voided)).toHaveLength(2);
    assertLedger();
  });

  it('does not flag different amounts, types or methods', () => {
    const c = addClient();
    recordPayment({ clientId: c.id, amount: 40, type: 'product' });
    recordPayment({ clientId: c.id, amount: 41, type: 'product' });
    recordPayment({ clientId: c.id, amount: 40, type: 'package' });
    recordPayment({ clientId: c.id, amount: 40, type: 'product', method: 'Cash' });
    expect(S().confirmDialog).toBeNull();
    expect(S().payments.filter((p) => p.clientId === c.id)).toHaveLength(4);
  });

  it('a voided payment does not count as a duplicate', () => {
    const c = addClient();
    const [p] = recordPayment({ clientId: c.id, amount: 40, type: 'product' }).added;
    S().voidPayment(p.id);
    confirm();
    const again = recordPayment({ clientId: c.id, amount: 40, type: 'product' });
    expect(again.added).toHaveLength(1);
    assertLedger();
  });

  it('an old identical payment (outside 10 minutes) is not a duplicate', () => {
    const c = addClient();
    recordPayment({ clientId: c.id, amount: 40, type: 'product' });
    vi.setSystemTime(new Date(2026, 8, 23, 8, 30, 0));
    try {
      expect(recordPayment({ clientId: c.id, amount: 40, type: 'product' }).added).toHaveLength(1);
    } finally {
      vi.setSystemTime(new Date(2026, 8, 23, 8, 0, 0));
    }
  });

  it('double-clicking Complete & Charge charges once', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'] });
    S().openApptDetail(a.id);
    S().completeCheckout();
    useStore.setState({ apptDetailId: a.id }); // a stale second click
    S().completeCheckout();
    expect(paysFor(a.id)).toHaveLength(1);
    expect(S().toastMsg).toMatch(/already been checked out/);
    expect(S().clients.find((x) => x.id === c.id)!.visits).toBe(1);
    assertLedger();
  });

  it('double-clicking a confirm button runs the action once', () => {
    const emma = S().appointments.find((a) => a.clientId === 'cl_emma' && a.status === 'completed')!;
    const [p] = recordPayment({ clientId: 'cl_emma', apptId: emma.id, amount: 75 }).added;
    S().voidPayment(p.id);
    confirm();
    confirm();
    expect(S().payments.filter((x) => x.id === p.id)).toHaveLength(1);
    expect(sel.apptOutstanding(S(), appt(emma.id))).toBe(75);
    assertLedger();
  });

  it('a second submit for a settled visit is refused (nothing left to pay)', () => {
    const emma = S().appointments.find((a) => a.clientId === 'cl_emma' && a.status === 'completed')!;
    recordPayment({ clientId: 'cl_emma', apptId: emma.id, amount: 75 });
    S().openRecordPayment('cl_emma');
    useStore.setState({ recordPaymentDraft: { ...S().recordPaymentDraft, apptId: emma.id, amount: 75, type: 'balance' } });
    S().saveRecordPayment(true);
    expect(S().payments.filter((p) => p.apptId === emma.id && !p.voided && p.amount === 75)).toHaveLength(1);
  });
});

describe('P0 voided payments', () => {
  it('voiding a checkout payment re-opens exactly that balance and removes it from revenue', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'] });
    const rev0 = sel.getRevenueThisMonth(S());
    checkout(a.id, { tip: 10 });
    expect(r2(sel.getRevenueThisMonth(S()) - rev0)).toBe(75);
    const pay = paysFor(a.id)[0];
    S().voidPayment(pay.id);
    confirm();
    expect(r2(sel.getRevenueThisMonth(S()))).toBe(r2(rev0));
    expect(sel.apptOutstanding(S(), appt(a.id))).toBe(65); // tip isn't owed
    expect(appt(a.id).balancePaid).toBe(false);
    assertLedger();
  });

  it('voiding a deposit on an upcoming booking puts it back into the balance due', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_balayage'], date: isoDaysFromNow(7), deposit: 40 });
    expect(sel.apptBalance(S(), appt(a.id))).toBe(110);
    S().voidPayment(paysFor(a.id)[0].id);
    confirm();
    expect(sel.apptBalance(S(), appt(a.id))).toBe(150);
    expect(appt(a.id).depositPaid).toBe(false);
    assertLedger();
  });

  it('voiding one of two partial payments leaves the other counted', () => {
    const emma = S().appointments.find((a) => a.clientId === 'cl_emma' && a.status === 'completed')!;
    const [p1] = recordPayment({ clientId: 'cl_emma', apptId: emma.id, amount: 25 }).added;
    recordPayment({ clientId: 'cl_emma', apptId: emma.id, amount: 50 });
    expect(appt(emma.id).balancePaid).toBe(true);
    S().voidPayment(p1.id);
    confirm();
    expect(sel.apptOutstanding(S(), appt(emma.id))).toBe(25);
    expect(appt(emma.id).balancePaid).toBe(false);
    assertLedger();
  });

  it('voiding is final and idempotent; the record stays for audit', () => {
    const c = addClient();
    const [p] = recordPayment({ clientId: c.id, amount: 30, type: 'package' }).added;
    S().voidPayment(p.id);
    confirm();
    S().voidPayment(p.id);
    expect(S().confirmDialog).toBeNull();
    const kept = S().payments.find((x) => x.id === p.id)!;
    expect(kept).toMatchObject({ voided: true, voidedAt: todayISO(), amount: 30 });
    assertLedger();
  });

  it('cancelling the void dialog changes nothing', () => {
    const c = addClient();
    const [p] = recordPayment({ clientId: c.id, amount: 30, type: 'package' }).added;
    S().voidPayment(p.id);
    S().closeConfirm();
    expect(S().payments.find((x) => x.id === p.id)!.voided).toBeFalsy();
  });

  it('after a void, a new payment settles the visit again', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_blowout'] });
    checkout(a.id);
    S().voidPayment(paysFor(a.id)[0].id);
    confirm();
    recordPayment({ clientId: c.id, apptId: a.id, amount: 40 }, true);
    expect(appt(a.id).balancePaid).toBe(true);
    expect(sel.getOutstandingForClient(S(), c.id)).toBe(0);
    assertLedger();
  });
});

describe('P0 gift cards', () => {
  it('selling a card creates a unique code, counts as money in, and is owed as services', () => {
    const c = addClient();
    const rev0 = sel.getRevenueThisMonth(S());
    const liab0 = sel.getGiftCardLiability(S());
    const gc = sellCard(c.id, 100);
    expect(gc.code).toMatch(/^LUM-\d{4}$/);
    expect(gc).toMatchObject({ initialValue: 100, balance: 100, kind: 'gift', clientId: c.id });
    expect(r2(sel.getRevenueThisMonth(S()) - rev0)).toBe(100);
    expect(r2(sel.getGiftCardLiability(S()) - liab0)).toBe(100);
    assertLedger();
  });

  it('a card that covers the whole bill: no new revenue except the tip', () => {
    const buyer = addClient();
    const gc = sellCard(buyer.id, 100);
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'] });
    const rev0 = sel.getRevenueThisMonth(S());
    checkout(a.id, { giftCardId: gc.id, tip: 8, method: 'Cash' });
    expect(card(gc.id).balance).toBe(35);
    const pays = paysFor(a.id);
    expect(pays.find((p) => p.method === 'Gift card')).toMatchObject({ amount: 65, giftCardId: gc.id });
    expect(pays.find((p) => p.method === 'Cash')).toMatchObject({ amount: 8, tip: 8 });
    expect(r2(sel.getRevenueThisMonth(S()) - rev0)).toBe(8);
    expect(appt(a.id).balancePaid).toBe(true);
    assertLedger();
  });

  it('a card smaller than the bill is used up and the rest is charged', () => {
    const c = addClient();
    const gc = sellCard(c.id, 50);
    const a = book({ clientId: c.id, serviceIds: ['svc_balayage'] });
    checkout(a.id, { giftCardId: gc.id });
    expect(card(gc.id).balance).toBe(0);
    const pays = paysFor(a.id);
    expect(pays.map((p) => [p.method, p.amount])).toEqual(expect.arrayContaining([['Gift card', 50], ['Card', 100]]));
    expect(sel.getOutstandingForClient(S(), c.id)).toBe(0);
    assertLedger();
  });

  it('an empty or voided card cannot be used at checkout', () => {
    const c = addClient();
    const gc = sellCard(c.id, 40);
    const a1 = book({ clientId: c.id, serviceIds: ['svc_blowout'] });
    checkout(a1.id, { giftCardId: gc.id });
    expect(card(gc.id).balance).toBe(0);
    const a2 = book({ clientId: c.id, serviceIds: ['svc_blowout'] });
    S().openApptDetail(a2.id);
    S().setCheckoutGiftCard(gc.id);
    S().completeCheckout();
    expect(S().toastMsg).toMatch(/no balance left/);
    expect(appt(a2.id).status).not.toBe('completed');
    assertLedger();
  });

  it('Record Payment from a card cannot exceed the card balance', () => {
    const c = addClient();
    const gc = sellCard(c.id, 20);
    const emma = S().appointments.find((a) => a.clientId === 'cl_emma' && a.status === 'completed')!;
    const r = recordPayment({ clientId: 'cl_emma', apptId: emma.id, amount: 30, method: 'Gift card', giftCardId: gc.id });
    expect(r.added).toHaveLength(0);
    expect(r.toast).toMatch(/only has \$20\.00/);
    const ok = recordPayment({ clientId: 'cl_emma', apptId: emma.id, amount: 20, method: 'Gift card', giftCardId: gc.id });
    expect(ok.added).toHaveLength(1);
    expect(card(gc.id).balance).toBe(0);
    expect(sel.apptOutstanding(S(), appt(emma.id))).toBe(55);
    assertLedger();
  });

  it('paying from a gift card needs a card chosen', () => {
    const c = addClient();
    sellCard(c.id, 20);
    const r = recordPayment({ clientId: c.id, amount: 10, method: 'Gift card', type: 'product' });
    expect(r.added).toHaveLength(0);
    expect(r.toast).toMatch(/Choose a gift card/);
  });

  it('a gift card cannot buy another gift card', () => {
    const c = addClient();
    const gc = sellCard(c.id, 50);
    S().openRecordPayment(c.id, undefined, 'gift-card');
    useStore.setState({ recordPaymentDraft: { ...S().recordPaymentDraft, amount: 20, method: 'Gift card', giftCardId: gc.id } });
    S().saveRecordPayment();
    expect(S().toastMsg).toMatch(/can’t be bought with another gift card/);
    expect(card(gc.id).balance).toBe(50);
  });

  it('a gift card sale is never attached to a visit', () => {
    const emma = S().appointments.find((a) => a.clientId === 'cl_emma' && a.status === 'completed')!;
    S().openRecordPayment('cl_emma', emma.id);
    S().updateRecordPaymentField('type', 'gift-card');
    expect(S().recordPaymentDraft.apptId).toBe('');
  });

  it('voiding an unused card cancels it and its sale (revenue and liability both drop)', () => {
    const c = addClient();
    const rev0 = sel.getRevenueThisMonth(S());
    const liab0 = sel.getGiftCardLiability(S());
    const gc = sellCard(c.id, 60);
    S().voidGiftCard(gc.id);
    confirm();
    expect(card(gc.id)).toMatchObject({ voided: true, balance: 0 });
    expect(sel.getRevenueThisMonth(S())).toBe(rev0);
    expect(sel.getGiftCardLiability(S())).toBe(liab0);
    assertLedger();
  });

  it('voiding the sale payment routes to voiding the card', () => {
    const c = addClient();
    const gc = sellCard(c.id, 60);
    const sale = S().payments.find((p) => p.giftCardId === gc.id && p.type === 'gift-card')!;
    S().voidPayment(sale.id);
    expect(S().confirmDialog?.title).toMatch(/Void this gift card/);
    confirm();
    expect(card(gc.id).voided).toBe(true);
    expect(S().payments.find((p) => p.id === sale.id)!.voided).toBe(true);
    assertLedger();
  });

  it('a partly used card cannot be voided', () => {
    const c = addClient();
    const gc = sellCard(c.id, 100);
    const a = book({ clientId: c.id, serviceIds: ['svc_blowout'] });
    checkout(a.id, { giftCardId: gc.id });
    S().voidGiftCard(gc.id);
    expect(S().confirmDialog).toBeNull();
    expect(S().toastMsg).toMatch(/already been used/);
    expect(card(gc.id).voided).toBeFalsy();
  });

  it('voiding a redemption puts the money back on the card and re-opens the visit', () => {
    const c = addClient();
    const gc = sellCard(c.id, 100);
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'] });
    checkout(a.id, { giftCardId: gc.id });
    const redemption = paysFor(a.id).find((p) => p.method === 'Gift card')!;
    S().voidPayment(redemption.id);
    confirm();
    expect(card(gc.id).balance).toBe(100);
    expect(sel.apptOutstanding(S(), appt(a.id))).toBe(65);
    assertLedger();
  });

  it('the tip is never taken from a gift card', () => {
    const c = addClient();
    const gc = sellCard(c.id, 500);
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'] });
    checkout(a.id, { giftCardId: gc.id, tip: 12 });
    expect(card(gc.id).balance).toBe(435);
    expect(paysFor(a.id).find((p) => p.method !== 'Gift card')).toMatchObject({ amount: 12, tip: 12 });
    assertLedger();
  });

  it('codes stay unique across many cards', () => {
    const c = addClient();
    for (let i = 1; i <= 40; i++) sellCard(c.id, i + 0.5);
    const codes = S().giftCards.map((g) => g.code);
    expect(new Set(codes).size).toBe(codes.length);
    assertLedger();
  });

  it('a code lookup ignores case and spaces', () => {
    const gc = S().giftCards[0];
    expect(fin.findCardByCode(S().giftCards, `  ${gc.code.toLowerCase()} `)?.id).toBe(gc.id);
  });
});

describe('P0 deposits on cancellation / no-show', () => {
  const withDeposit = (date = isoDaysFromNow(7)) => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_balayage'], date, deposit: 40 });
    return { c, a };
  };

  it('cancel a week ahead: owner is asked, default is store credit, no money is lost', () => {
    const { c, a } = withDeposit();
    const rev0 = sel.getRevenueThisMonth(S());
    S().apptAction(a.id, 'cancel');
    expect(S().confirmDialog?.choices?.map((x) => x.value)).toEqual(['kept', 'credit', 'refunded']);
    expect(S().confirmDialog?.choice).toBe('credit');
    confirm();
    expect(appt(a.id)).toMatchObject({ status: 'cancelled', depositOutcome: 'credit' });
    expect(sel.getClientCredit(S(), c.id)).toBe(40);
    expect(sel.getRevenueThisMonth(S())).toBe(rev0); // the deposit was already counted once
    expect(S().toastMsg).toMatch(/\$40\.00 added to store credit/);
    assertLedger();
  });

  it('keep as fee: revenue keeps the deposit, no credit', () => {
    const { c, a } = withDeposit();
    const rev0 = sel.getRevenueThisMonth(S());
    S().apptAction(a.id, 'cancel');
    S().setConfirmChoice('kept');
    confirm();
    expect(appt(a.id).depositOutcome).toBe('kept');
    expect(sel.getClientCredit(S(), c.id)).toBe(0);
    expect(sel.getRevenueThisMonth(S())).toBe(rev0);
    assertLedger();
  });

  it('refund: the deposit is voided and leaves revenue', () => {
    const { a } = withDeposit();
    const rev0 = sel.getRevenueThisMonth(S());
    S().apptAction(a.id, 'cancel');
    S().setConfirmChoice('refunded');
    confirm();
    expect(paysFor(a.id).every((p) => p.voided)).toBe(true);
    expect(r2(rev0 - sel.getRevenueThisMonth(S()))).toBe(40);
    expect(appt(a.id)).toMatchObject({ depositOutcome: 'refunded', depositPaid: false });
    assertLedger();
  });

  it('a late cancellation (inside the window) defaults to keeping the fee', () => {
    const { a } = withDeposit(todayISO());
    S().apptAction(a.id, 'cancel');
    expect(S().confirmDialog?.choice).toBe('kept');
    expect(S().confirmDialog?.message).toMatch(/cancellation window/);
  });

  it('no-show defaults to keeping the fee and counts the no-show', () => {
    const { c, a } = withDeposit(todayISO());
    S().apptAction(a.id, 'noshow');
    expect(S().confirmDialog?.choice).toBe('kept');
    confirm();
    expect(appt(a.id)).toMatchObject({ status: 'no-show', depositOutcome: 'kept' });
    expect(S().clients.find((x) => x.id === c.id)!.noShowCount).toBe(1);
    assertLedger();
  });

  it('without a deposit, cancel is a simple confirmation', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'], date: isoDaysFromNow(7) });
    S().apptAction(a.id, 'cancel');
    expect(S().confirmDialog?.choices).toBeUndefined();
    confirm();
    expect(appt(a.id).status).toBe('cancelled');
    expect(appt(a.id).depositOutcome).toBeUndefined();
  });

  it('cancelling twice does nothing the second time', () => {
    const { c, a } = withDeposit();
    S().apptAction(a.id, 'cancel');
    confirm();
    S().apptAction(a.id, 'cancel');
    expect(S().confirmDialog).toBeNull();
    expect(S().clients.find((x) => x.id === c.id)!.cancellationCount).toBe(1);
    expect(S().giftCards.filter((g) => g.sourceApptId === a.id)).toHaveLength(1);
  });

  it('store credit is spent at the next checkout without being counted as new revenue', () => {
    const { c, a } = withDeposit();
    S().apptAction(a.id, 'cancel');
    confirm();
    const credit = S().giftCards.find((g) => g.sourceApptId === a.id)!;
    expect(sel.cardsForClient(S(), c.id)[0].id).toBe(credit.id); // own credit listed first
    const next = book({ clientId: c.id, serviceIds: ['svc_cut'] });
    const rev0 = sel.getRevenueThisMonth(S());
    checkout(next.id, { giftCardId: credit.id });
    expect(card(credit.id).balance).toBe(0);
    expect(r2(sel.getRevenueThisMonth(S()) - rev0)).toBe(25); // 65 − 40 credit
    assertLedger();
  });

  it('a deposit that became credit cannot be voided behind the credit’s back', () => {
    const { a } = withDeposit();
    S().apptAction(a.id, 'cancel');
    confirm();
    S().voidPayment(paysFor(a.id)[0].id);
    expect(S().confirmDialog).toBeNull();
    expect(S().toastMsg).toMatch(/became store credit/);
    assertLedger();
  });

  it('refunding unused credit voids the credit and the deposit together', () => {
    const { c, a } = withDeposit();
    const rev0 = sel.getRevenueThisMonth(S());
    S().apptAction(a.id, 'cancel');
    confirm();
    const credit = S().giftCards.find((g) => g.sourceApptId === a.id)!;
    S().voidGiftCard(credit.id);
    expect(S().confirmDialog?.title).toMatch(/Refund this store credit/);
    confirm();
    expect(card(credit.id).voided).toBe(true);
    expect(paysFor(a.id).every((p) => p.voided)).toBe(true);
    expect(appt(a.id).depositOutcome).toBe('refunded');
    expect(sel.getClientCredit(S(), c.id)).toBe(0);
    expect(r2(rev0 - sel.getRevenueThisMonth(S()))).toBe(40);
    assertLedger();
  });

  it('credit that has been partly spent cannot be refunded', () => {
    const { c, a } = withDeposit();
    S().apptAction(a.id, 'cancel');
    confirm();
    const credit = S().giftCards.find((g) => g.sourceApptId === a.id)!;
    const next = book({ clientId: c.id, serviceIds: ['svc_browtint'] });
    checkout(next.id, { giftCardId: credit.id });
    S().voidGiftCard(credit.id);
    expect(S().toastMsg).toMatch(/already been used/);
    expect(card(credit.id).voided).toBeFalsy();
  });

  it('a deposit recorded later (Record Payment) is handled the same way', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'], date: isoDaysFromNow(7) });
    recordPayment({ clientId: c.id, apptId: a.id, amount: 20, type: 'deposit', method: 'Cash' });
    S().apptAction(a.id, 'cancel');
    S().setConfirmChoice('refunded');
    confirm();
    expect(paysFor(a.id).every((p) => p.voided)).toBe(true);
    assertLedger();
  });

  it('a deposit paid from a gift card goes back onto the card when refunded', () => {
    const c = addClient();
    const gc = sellCard(c.id, 80);
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'], date: isoDaysFromNow(7) });
    recordPayment({ clientId: c.id, apptId: a.id, amount: 30, type: 'deposit', method: 'Gift card', giftCardId: gc.id });
    expect(card(gc.id).balance).toBe(50);
    S().apptAction(a.id, 'cancel');
    S().setConfirmChoice('refunded');
    confirm();
    expect(card(gc.id).balance).toBe(80);
    assertLedger();
  });

  it('store credit only covers new money; the gift-card-paid part of a deposit returns to its card', () => {
    const c = addClient();
    const gc = sellCard(c.id, 50);
    const a = book({ clientId: c.id, serviceIds: ['svc_balayage'], date: isoDaysFromNow(7), deposit: 20 });
    recordPayment({ clientId: c.id, apptId: a.id, amount: 15, type: 'deposit', method: 'Gift card', giftCardId: gc.id });
    expect(card(gc.id).balance).toBe(35);
    S().apptAction(a.id, 'cancel');
    expect(S().confirmDialog?.message).toMatch(/\$35\.00 deposit/);
    S().setConfirmChoice('credit');
    confirm();
    expect(card(gc.id).balance).toBe(50);
    const credit = S().giftCards.find((g) => g.sourceApptId === a.id)!;
    expect(credit.initialValue).toBe(20);
    S().voidGiftCard(credit.id);
    confirm();
    expect(card(gc.id).balance).toBe(50);
    expect(paysFor(a.id).every((p) => p.voided)).toBe(true);
    assertLedger();
  });

  it('paying more up front than the final bill turns the difference into credit at checkout', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'] });
    // Simulate old data where a deposit exceeded what the visit ended up costing.
    useStore.setState((s) => ({ payments: [{ id: 'pay_legacy', clientId: c.id, apptId: a.id, amount: 90, method: 'Card', type: 'deposit', date: todayISO() } as Payment, ...s.payments] }));
    checkout(a.id);
    const credit = S().giftCards.find((g) => g.sourceApptId === a.id && g.kind === 'credit')!;
    expect(credit.balance).toBe(25);
    expect(S().toastMsg).toMatch(/\$25\.00 overpaid → store credit/);
    expect(paysFor(a.id)).toHaveLength(1); // nothing charged
    snapshotCards();
    assertLedger();
  });
});

describe('P0 totals always agree', () => {
  it('checkout: itemized bill = payments − tips; spend, points and history match', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_balayage', 'svc_cut'], discount: 15, deposit: 50 });
    checkout(a.id, { tip: 10, products: { inv_shampoo: 2 } });
    const done = appt(a.id);
    const bill = sel.apptBill(done); // 215 − 15 + 48
    expect(bill).toBe(248);
    expect(sel.apptPaid(S(), a.id)).toBe(248);
    const cl = S().clients.find((x) => x.id === c.id)!;
    expect(cl.lifetimeSpend).toBe(248);
    expect(cl.loyaltyPoints).toBe(248);
    expect(cl.pointsLog?.[0]).toMatchObject({ delta: 248, apptId: a.id });
    expect(S().payments.filter((p) => p.apptId === a.id && !p.voided).reduce((n, p) => n + p.amount - (p.tip || 0), 0)).toBe(248);
    assertLedger();
  });

  it('dashboard, money tab and client balance use the same numbers', () => {
    const s = S();
    const byClient = s.clients.reduce((n, c) => n + sel.getOutstandingForClient(s, c.id), 0);
    expect(r2(byClient)).toBe(r2(sel.getOutstandingTotal(s)));
    expect(r2(sel.getOutstandingAppointments(s).reduce((n, a) => n + sel.apptOutstanding(s, a), 0))).toBe(r2(sel.getOutstandingTotal(s)));
    const today = todayISO();
    expect(r2(sel.getCollectedToday(s))).toBe(r2(s.payments.filter((p) => fin.isMoneyIn(p) && p.date === today).reduce((n, p) => n + p.amount, 0)));
  });

  it('randomised stress: 12 × 150 destructive operations keep every invariant', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      let x = seed * 9973;
      const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
      const pick = <T,>(arr: T[]): T | undefined => (arr.length ? arr[Math.floor(rnd() * arr.length)] : undefined);
      const clients = [addClient(), addClient(), addClient()];
      const ops: (() => void)[] = [
        () => { // book (maybe with deposit)
          const c = pick(clients)!;
          try {
            book({ clientId: c.id, serviceIds: [pick(['svc_cut', 'svc_blowout', 'svc_browtint', 'svc_gelmani'])!], date: rnd() < 0.6 ? todayISO() : isoDaysFromNow(1 + Math.floor(rnd() * 20)), deposit: rnd() < 0.5 ? Math.floor(rnd() * 30) : 0 });
          } catch { /* day full */ }
        },
        () => { // checkout (maybe with card, tip, product)
          const a = pick(S().appointments.filter((y) => clients.some((c) => c.id === y.clientId) && y.date === todayISO() && fin.OPEN_STATUSES.includes(y.status) && y.status !== 'unconfirmed'));
          if (!a) return;
          const cards = sel.cardsForClient(S(), a.clientId);
          checkout(a.id, { tip: rnd() < 0.4 ? Math.floor(rnd() * 20) : 0, giftCardId: rnd() < 0.5 ? pick(cards)?.id : undefined, products: rnd() < 0.3 ? { inv_oil: 1 } : {} });
        },
        () => { // pay (random amount, sometimes over) toward something owed
          const a = pick(S().appointments.filter((y) => clients.some((c) => c.id === y.clientId) && sel.apptPaymentCap(S(), y) > 0));
          if (!a) return;
          const cap = sel.apptPaymentCap(S(), a);
          const cards = sel.cardsForClient(S(), a.clientId);
          const useCard = rnd() < 0.3 && cards.length > 0;
          recordPayment({ clientId: a.clientId, apptId: a.id, amount: r2(cap * (0.3 + rnd())), method: useCard ? 'Gift card' : 'Cash', giftCardId: useCard ? cards[0].id : '' }, rnd() < 0.5);
          S().closeRecordPayment();
          S().closeConfirm();
        },
        () => sellCard(pick(clients)!.id, 10 + Math.floor(rnd() * 90)),
        () => { // void a random payment (confirm or back out)
          const p = pick(S().payments.filter((y) => !y.voided && clients.some((c) => c.id === y.clientId)));
          if (!p) return;
          S().voidPayment(p.id);
          if (rnd() < 0.8) confirm(); else S().closeConfirm();
        },
        () => { // void / refund a card
          const g = pick(S().giftCards.filter((y) => !y.voided && clients.some((c) => c.id === y.clientId)));
          if (g) { S().voidGiftCard(g.id); confirm(); }
        },
        () => { // cancel or no-show with any deposit outcome
          const a = pick(S().appointments.filter((y) => clients.some((c) => c.id === y.clientId) && fin.OPEN_STATUSES.includes(y.status)));
          if (!a) return;
          S().apptAction(a.id, a.date === todayISO() && rnd() < 0.5 ? 'noshow' : 'cancel');
          if (S().confirmDialog?.choices) S().setConfirmChoice(pick(['kept', 'credit', 'refunded'])!);
          confirm();
        },
        () => { // double submits
          const a = pick(S().appointments.filter((y) => clients.some((c) => c.id === y.clientId) && y.status === 'completed'));
          if (!a) return;
          useStore.setState({ apptDetailId: a.id });
          S().completeCheckout();
          confirm();
        },
      ];
      const trail: string[] = [];
      for (let i = 0; i < 150; i++) {
        const k = Math.floor(rnd() * ops.length);
        const before = JSON.stringify(S().giftCards.map((g) => [g.code, g.balance, g.voided]));
        const t0 = S().toastMsg;
        const id0 = S().toastId;
        ops[k]();
        if (S().toastId !== id0) seen.add(S().toastMsg.replace(/[\d.$,]+/g, '#').split(' · ')[0]);
        void t0;
        trail.push(`${k} ${S().toastMsg} ${before} -> ${JSON.stringify(S().giftCards.map((g) => [g.code, g.balance, g.voided]))}`);
        S().closeCompleteScreen();
        try {
          assertLedger();
          // Loyalty follows money: points = Σ paid (≤ bill) over completed visits, and the log adds up.
          for (const cl of clients) {
            const now = S().clients.find((x) => x.id === cl.id)!;
            const expected = S().appointments.filter((y) => y.clientId === cl.id && y.status === 'completed').reduce((n, y) => n + fin.visitPoints(sel.apptBill(y), sel.apptPaid(S(), y.id)), 0);
            expect(now.loyaltyPoints, `points for ${now.name}`).toBe(expected);
            expect((now.pointsLog || []).reduce((n, e) => n + e.delta, 0)).toBe(now.loyaltyPoints);
          }
        } catch (e) {
          if (process.env.FUZZ_DEBUG) console.log(`seed ${seed}\n` + trail.slice(-6).join('\n'));
          throw e;
        }
      }
    }
    // The run must actually have exercised the money paths, not just no-ops.
    const hit = [...seen].join(' | ');
    for (const expected of ['Checkout complete', 'Payment recorded', 'Gift card LUM-#', 'Payment voided', 'Appointment cancelled', 'Store credit refunded', 'Gift card voided', 'already been checked out']) {
      expect(hit, `fuzz never produced "${expected}"`).toContain(expected);
    }
  }, 60_000);
});

describe('backup keeps the money trail', () => {
  it('round-trips gift cards, redemptions, credits, deposit outcomes and points history', () => {
    const c = addClient();
    const gc = sellCard(c.id, 100);
    const a = book({ clientId: c.id, serviceIds: ['svc_cut'] });
    checkout(a.id, { giftCardId: gc.id, tip: 5 });
    const b = book({ clientId: c.id, serviceIds: ['svc_balayage'], date: isoDaysFromNow(7), deposit: 40 });
    S().apptAction(b.id, 'cancel');
    confirm();
    const totals = () => ({ rev: sel.getRevenueThisMonth(S()), owed: sel.getOutstandingTotal(S()), liab: sel.getGiftCardLiability(S()), credit: sel.getClientCredit(S(), c.id) });
    const before = totals();
    const file = JSON.stringify(buildBackup(useStore.getState(), new Date().toISOString()));
    const parsed = parseBackup(file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const d = parsed.domain;
    expect(d.giftCards.find((g) => g.id === gc.id)).toMatchObject({ balance: 35, kind: 'gift', clientId: c.id });
    expect(d.payments.find((p) => p.apptId === a.id && p.method === 'Gift card')).toMatchObject({ giftCardId: gc.id, amount: 65 });
    expect(d.appointments.find((x) => x.id === b.id)!.depositOutcome).toBe('credit');
    expect(d.clients.find((x) => x.id === c.id)!.pointsLog?.[0].delta).toBe(65);
    useStore.setState({ ...d });
    expect(totals()).toEqual(before);
    assertLedger();
  });

  it('an older (v2) backup still imports; a card payment with an unknown method becomes Card', () => {
    const d = JSON.parse(JSON.stringify(buildBackup(useStore.getState(), 'x')));
    d.schemaVersion = 2;
    d.data.payments[0].method = 'Venmo';
    const r = parseBackup(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.domain.payments[0].method).toBe('Card');
  });

  it('newer backups are refused by older formats (schema is versioned)', () => {
    const d = { ...buildBackup(useStore.getState(), 'x'), schemaVersion: 4 };
    expect(parseBackup(JSON.stringify(d)).ok).toBe(false);
  });
});

describe('P1 duplicate clients', () => {
  it.each([
    ['(555) 201-3344', '555.201.3344'],
    ['+1 555 201 3344', '5552013344'],
    ['555-201-3344', '1-555-201-3344'],
  ])('treats %s and %s as the same phone', (a, b) => {
    addClient('Phone Owner', { phone: a });
    S().openNewClient();
    S().updateNewClientField('name', 'Someone Else');
    S().updateNewClientField('phone', b);
    S().saveNewClient();
    expect(S().confirmDialog?.message).toMatch(/phone number/);
    S().closeConfirm();
    expect(S().clients.some((c) => c.name === 'Someone Else')).toBe(false);
  });

  it('matches email regardless of case and spaces', () => {
    addClient('Mail Owner', { email: 'Kim@Example.com' });
    S().openNewClient();
    S().updateNewClientField('name', 'Other Person');
    S().updateNewClientField('email', '  kim@example.COM ');
    S().saveNewClient();
    expect(S().confirmDialog?.message).toMatch(/email/);
  });

  it('does not match short or different numbers', () => {
    addClient('Short', { phone: '123' });
    S().openNewClient();
    S().updateNewClientField('name', 'Other Short');
    S().updateNewClientField('phone', '123');
    S().saveNewClient();
    expect(S().confirmDialog).toBeNull();
    addClient('Near', { phone: '555-201-3345' });
    expect(S().confirmDialog).toBeNull();
  });

  it('editing a client to another client’s phone asks first; cancelling keeps the old number', () => {
    const a = addClient('Edit A', { phone: '555-777-0001' });
    const b = addClient('Edit B', { phone: '555-777-0002' });
    let saved = false;
    S().saveClientContact(b.id, { name: 'Edit B', phone: '(555) 777-0001', email: '', birthday: '' }, () => (saved = true));
    expect(S().confirmDialog?.message).toMatch(/Edit A/);
    S().closeConfirm();
    expect(saved).toBe(false);
    expect(S().clients.find((c) => c.id === b.id)!.phone).toBe('555-777-0002');
    S().saveClientContact(b.id, { name: 'Edit B', phone: '(555) 777-0001', email: '', birthday: '' }, () => (saved = true));
    confirm();
    expect(saved).toBe(true);
    expect(S().clients.find((c) => c.id === b.id)!.phone).toBe('(555) 777-0001');
    expect(a.id).not.toBe(b.id);
  });
});

describe('P1 loyalty history', () => {
  it('logs points earned at checkout and redeemed, with reasons', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_keratin'] });
    checkout(a.id, { products: { inv_shampoo: 12 } });
    const earned = Math.floor(sel.apptBill(appt(a.id)));
    expect(earned).toBe(508);
    const reward = [...S().loyaltyRewards].sort((x, y) => x.pointsCost - y.pointsCost)[0];
    S().redeemReward(c.id, reward.id);
    confirm();
    const cl = S().clients.find((x) => x.id === c.id)!;
    expect(cl.pointsLog?.map((e) => e.delta)).toEqual([-reward.pointsCost, earned]);
    expect(cl.pointsLog?.[0].reason).toMatch(/Redeemed/);
    expect(cl.loyaltyPoints).toBe(earned - reward.pointsCost);
    // the running total always equals the log for a client created in the app
    expect(cl.pointsLog!.reduce((n, e) => n + e.delta, 0)).toBe(cl.loyaltyPoints);
  });

  it('a failed redemption changes nothing', () => {
    const c = addClient();
    const reward = S().loyaltyRewards[0];
    S().redeemReward(c.id, reward.id);
    const cl = S().clients.find((x) => x.id === c.id)!;
    expect(cl.loyaltyPoints).toBe(0);
    expect(cl.pointsLog ?? []).toHaveLength(0);
    expect(S().toastMsg).toMatch(/more points/);
  });

  it('redeeming never demotes a VIP tier', () => {
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_keratin'] });
    checkout(a.id, { products: { inv_shampoo: 12 } });
    expect(S().clients.find((x) => x.id === c.id)!.vipTier).toBe('silver');
    const big = [...S().loyaltyRewards].sort((x, y) => x.pointsCost - y.pointsCost)[0];
    S().redeemReward(c.id, big.id);
    confirm();
    const b2 = book({ clientId: c.id, serviceIds: ['svc_browtint'] });
    checkout(b2.id);
    expect(S().clients.find((x) => x.id === c.id)!.vipTier).toBe('silver');
  });
});

describe('P1 multi-service booking', () => {
  it('uses the total duration of every service for conflicts', () => {
    const c = addClient();
    const date = isoDaysFromNow(8);
    const a = book({ clientId: c.id, serviceIds: ['svc_balayage', 'svc_cut'], staffId: 'st_jordan', date });
    expect(a.durationMin).toBe(150);
    const end = (h: string, m: number) => { const [hh, mm] = h.split(':').map(Number); const t = hh * 60 + mm + m; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
    const inLastService = end(a.time, 140);
    const r = checkBooking(S().appointments, S().business, { staffId: 'st_jordan', date, time: inLastService, durationMin: 30 });
    expect(r.conflicts).toHaveLength(1);
    const after = checkBooking(S().appointments, S().business, { staffId: 'st_jordan', date, time: end(a.time, 155), durationMin: 30 });
    expect(after.conflicts).toHaveLength(0);
    expect(after.bufferWarnings).toHaveLength(1); // inside the 15-min buffer
  });

  it('blocks a multi-service booking that would run past closing', () => {
    const c = addClient();
    S().openNewAppt({ clientId: c.id, serviceIds: ['svc_keratin', 'svc_highlight'], staffId: 'st_mia', date: isoDaysFromNow(9), time: '14:00' });
    const before = S().appointments.length;
    S().saveNewAppt();
    expect(S().appointments.length).toBe(before);
    expect(S().showNewAppt).toBe(true);
  });
});

describe('P2 service-specific rebooking cycles', () => {
  it('uses the shortest cycle of the services done, else the business default', () => {
    expect(sel.rebookWeeksFor(S(), ['svc_gelmani'])).toBe(S().business.rebookWeeks);
    S().updateServiceField('svc_gelmani', 'rebookWeeks', 2);
    S().updateServiceField('svc_cut', 'rebookWeeks', 5);
    expect(sel.rebookWeeksFor(S(), ['svc_gelmani', 'svc_cut'])).toBe(2);
    S().updateServiceField('svc_gelmani', 'rebookWeeks', 0);
    expect(S().services.find((s) => s.id === 'svc_gelmani')!.rebookWeeks).toBeUndefined();
  });

  it('a client whose last visit was a 2-week service is due sooner, and Rebook pre-fills +2 weeks', () => {
    S().updateServiceField('svc_gelmani', 'rebookWeeks', 2);
    const c = addClient();
    const a = book({ clientId: c.id, serviceIds: ['svc_gelmani'] });
    checkout(a.id);
    vi.setSystemTime(new Date(2026, 9, 9, 8, 0, 0)); // 16 days later
    try {
      expect(sel.getRebookingOpportunities(S()).some((e) => e.client.id === c.id)).toBe(true);
    } finally {
      vi.setSystemTime(new Date(2026, 8, 23, 8, 0, 0));
    }
    S().rebookClient(c.id, a.id);
    expect(S().newApptDraft.date >= isoDaysFromNow(14)).toBe(true);
    expect(S().newApptDraft.date <= isoDaysFromNow(18)).toBe(true);
  });
});

describe('P1 search', () => {
  it('finds bookings and payments by date in several formats', () => {
    const d = todayISO();
    const onDay = S().appointments.filter((a) => a.date === d && a.status !== 'cancelled').length;
    expect(onDay).toBeGreaterThan(0);
    for (const q of ['2026-09-23', '9/23', '9/23/26', 'sep 23', 'September 23', '23 sep']) {
      const r = sel.getSearchResults(S(), q, 100);
      expect(r.appointments.length, q).toBeGreaterThan(0);
      expect(r.appointments.every((a) => a.date === d), q).toBe(true);
    }
    expect(sel.parseDateQuery('2/30')).toBeNull();
  });

  it('finds payments by method, and gift card payments by code', () => {
    const c = addClient('Searchable Buyer');
    const gc = sellCard(c.id, 30, 'Cash');
    expect(sel.getSearchResults(S(), 'cash', 100).payments.some((p) => p.giftCardId === gc.id)).toBe(true);
    expect(sel.getSearchResults(S(), gc.code.toLowerCase(), 100).payments.some((p) => p.giftCardId === gc.id)).toBe(true);
  });
});

describe('P2 inventory & dashboard', () => {
  it('service usage is deducted at checkout and flags low stock', () => {
    const c = addClient();
    const foils0 = S().inventory.find((i) => i.id === 'inv_foils')!.qty;
    const a = book({ clientId: c.id, serviceIds: ['svc_balayage'] });
    checkout(a.id);
    expect(S().inventory.find((i) => i.id === 'inv_foils')!.qty).toBe(foils0 - 20);
    expect(sel.getLowStockItems(S()).some((i) => i.id === 'inv_foils')).toBe(true);
  });

  it('every dashboard alert has an action; "owes" opens Record Payment pre-filled', () => {
    const items = sel.getNeedsAttention(S());
    expect(items.length).toBeGreaterThan(0);
    items.forEach((i) => expect(i.action).toBeTruthy());
    const owe = items.find((i) => i.onClick === 'record-payment')!;
    S().openRecordPayment(owe.targetId, owe.apptId);
    const a = appt(owe.apptId!);
    expect(S().recordPaymentDraft.amount).toBe(sel.apptOutstanding(S(), a));
    S().saveRecordPayment();
    expect(sel.apptOutstanding(S(), appt(a.id))).toBe(0);
    assertLedger();
  });
});
