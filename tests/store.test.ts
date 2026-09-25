import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storage } from './setup';

// Freeze "today" to a known Wednesday morning so demo data and business hours are deterministic.
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date(2026, 8, 23, 8, 0, 0));

const { useStore } = await import('../src/store/store');
const sel = await import('../src/lib/selectors');
const { STORAGE_KEY, RECOVERY_KEY, useStorageStatus, flushStorage } = await import('../src/lib/storage');
const { buildBackup } = await import('../src/lib/backup');
const { isoDaysFromNow, todayISO } = await import('../src/lib/dates');

const S = () => useStore.getState();
const confirm = () => S().runConfirm();
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  await flushStorage();
};

async function demo() {
  await S().resetDemo();
  S().dismissOnboarding();
  useStorageStatus.setState({ saveError: null, loadNotice: null });
}

function addClient(name: string, extra: Partial<{ phone: string; email: string }> = {}) {
  S().openNewClient();
  S().updateNewClientField('name', name);
  if (extra.phone) S().updateNewClientField('phone', extra.phone);
  if (extra.email) S().updateNewClientField('email', extra.email);
  S().saveNewClient(true);
  const c = S().clients.find((x) => x.name === name)!;
  S().dismissJustAdded();
  return c;
}

function book(p: { clientId: string; staffId: string; serviceIds: string[]; date: string; time: string; discount?: number; deposit?: number; recurring?: 'none' | 'weekly'; allowOutsideHours?: boolean }) {
  S().openNewAppt({ clientId: p.clientId, serviceIds: p.serviceIds, staffId: p.staffId, date: p.date, time: p.time });
  if (p.discount) S().updateNewApptField('discount', p.discount);
  if (p.deposit) S().updateNewApptField('deposit', p.deposit);
  if (p.recurring) S().updateNewApptField('recurring', p.recurring);
  if (p.allowOutsideHours) S().updateNewApptField('allowOutsideHours', true);
  const before = S().appointments.length;
  S().saveNewAppt();
  const created = S().appointments.slice(before);
  return { created, stillOpen: S().showNewAppt, toast: S().toastMsg };
}

beforeEach(async () => {
  storage.quotaBytes = Infinity;
  await demo();
});

describe('checkout integrity: service → discount → deposit → balance → payment → revenue → history → inventory', () => {
  it('charges exactly the balance + products + tip, once', () => {
    const today = todayISO();
    const c = addClient('Test Client');
    const r = book({ clientId: c.id, staffId: 'st_jordan', serviceIds: ['svc_balayage', 'svc_cut'], date: today, time: '09:00', discount: 15, deposit: 50 });
    expect(r.stillOpen).toBe(false);
    expect(r.created).toHaveLength(1);
    const appt = r.created[0];
    expect(appt.price).toBe(215);
    expect(sel.apptTotal(appt)).toBe(200);

    const depositPay = S().payments.filter((p) => p.apptId === appt.id);
    expect(depositPay).toHaveLength(1);
    expect(depositPay[0]).toMatchObject({ amount: 50, type: 'deposit' });
    expect(sel.apptBalance(S(), appt)).toBe(150);

    const inv0 = Object.fromEntries(S().inventory.map((i) => [i.id, i.qty]));
    const revenue0 = sel.getRevenueThisMonth(S());

    S().openApptDetail(appt.id);
    S().apptAction(appt.id, 'checkin');
    S().apptAction(appt.id, 'start');
    S().setCheckoutProductQty('inv_shampoo', 2);
    S().updateCheckoutTip(10);
    S().completeCheckout();

    const done = S().appointments.find((a) => a.id === appt.id)!;
    expect(done.status).toBe('completed');
    expect(done.productsSold).toEqual([{ itemId: 'inv_shampoo', qty: 2, price: 24, name: 'Retail Shampoo 250ml' }]);
    const pays = S().payments.filter((p) => p.apptId === appt.id);
    expect(pays).toHaveLength(2);
    const checkoutPay = pays.find((p) => p.type === 'balance')!;
    expect(checkoutPay.amount).toBe(150 + 48 + 10);
    expect(checkoutPay.tip).toBe(10);
    expect(sel.getRevenueThisMonth(S()) - revenue0).toBe(208);
    expect(sel.apptOutstanding(S(), done)).toBe(0);

    const client = S().clients.find((x) => x.id === c.id)!;
    expect(client.visits).toBe(1);
    expect(client.lifetimeSpend).toBe(248);
    expect(client.loyaltyPoints).toBe(248);
    expect(client.lastVisit).toBe(today);

    const inv1 = Object.fromEntries(S().inventory.map((i) => [i.id, i.qty]));
    expect(inv0.inv_lightener - inv1.inv_lightener).toBe(60);
    expect(inv0.inv_toner - inv1.inv_toner).toBe(30);
    expect(inv0.inv_shampoo - inv1.inv_shampoo).toBe(2);

    // A second submit (double-click / stale modal) must not create another payment.
    S().openApptDetail(appt.id);
    S().completeCheckout();
    expect(S().payments.filter((p) => p.apptId === appt.id)).toHaveLength(2);
    expect(S().clients.find((x) => x.id === c.id)!.visits).toBe(1);
  });

  it('never sells more retail stock than exists', () => {
    const today = todayISO();
    const c = addClient('Stock Test');
    const { created } = book({ clientId: c.id, staffId: 'st_jordan', serviceIds: ['svc_blowout'], date: today, time: '09:00' });
    S().openApptDetail(created[0].id);
    S().setCheckoutProductQty('inv_oil', 999);
    expect(S().checkoutDraft.productSelections.inv_oil).toBe(16);
  });

  it('blocks checkout of a future appointment', () => {
    const c = addClient('Future');
    const { created } = book({ clientId: c.id, staffId: 'st_jordan', serviceIds: ['svc_blowout'], date: isoDaysFromNow(1), time: '10:00' });
    S().openApptDetail(created[0].id);
    S().completeCheckout();
    expect(S().appointments.find((a) => a.id === created[0].id)!.status).toBe('confirmed');
  });

  it('settles an outstanding balance through Record Payment and re-opens it on void', () => {
    const emmaAppt = S().appointments.find((a) => a.clientId === 'cl_emma' && a.status === 'completed')!;
    expect(sel.apptOutstanding(S(), emmaAppt)).toBe(75);
    S().openRecordPayment('cl_emma', emmaAppt.id);
    expect(S().recordPaymentDraft.amount).toBe(75);
    S().saveRecordPayment();
    expect(sel.getOutstandingForClient(S(), 'cl_emma')).toBe(0);
    expect(S().appointments.find((a) => a.id === emmaAppt.id)!.balancePaid).toBe(true);

    const pay = S().payments.find((p) => p.apptId === emmaAppt.id && p.amount === 75)!;
    S().voidPayment(pay.id);
    confirm();
    expect(S().payments.find((p) => p.id === pay.id)!.voided).toBe(true);
    expect(sel.getOutstandingForClient(S(), 'cl_emma')).toBe(75);
  });
});

describe('booking rules', () => {
  const day = () => todayISO(); // Wednesday, open 09:00–18:00

  it('blocks a staff double-booking (Sarah is with Mia 10:30–13:00)', () => {
    const c = addClient('Overlap');
    const r = book({ clientId: c.id, staffId: 'st_mia', serviceIds: ['svc_cut'], date: day(), time: '11:00' });
    expect(r.created).toHaveLength(0);
    expect(r.stillOpen).toBe(true);
    expect(r.toast).toMatch(/already booked/);
  });

  it('blocks a booking whose duration runs into the next one', () => {
    const c = addClient('Runover');
    // Mia is booked 10:30; a 90 min root touch-up at 09:15 overlaps both Emma (09:15) and Sarah.
    const r = book({ clientId: c.id, staffId: 'st_mia', serviceIds: ['svc_roottouch'], date: day(), time: '09:45' });
    expect(r.created).toHaveLength(0);
  });

  it('blocks closed days and closing-time overruns unless explicitly allowed', () => {
    const c = addClient('Hours');
    const monday = isoDaysFromNow(5); // Mon Sep 28
    expect(book({ clientId: c.id, staffId: 'st_jordan', serviceIds: ['svc_cut'], date: monday, time: '10:00' }).created).toHaveLength(0);
    expect(book({ clientId: c.id, staffId: 'st_jordan', serviceIds: ['svc_keratin'], date: isoDaysFromNow(1), time: '16:00' }).created).toHaveLength(0);
    expect(book({ clientId: c.id, staffId: 'st_jordan', serviceIds: ['svc_cut'], date: monday, time: '10:00', allowOutsideHours: true }).created).toHaveLength(1);
  });

  it('blocks past dates, over-discounts and over-deposits', () => {
    const c = addClient('Money');
    expect(book({ clientId: c.id, staffId: 'st_jordan', serviceIds: ['svc_cut'], date: '2026-09-01', time: '10:00' }).created).toHaveLength(0);
    expect(book({ clientId: c.id, staffId: 'st_jordan', serviceIds: ['svc_cut'], date: isoDaysFromNow(1), time: '10:00', discount: 100 }).created).toHaveLength(0);
    expect(book({ clientId: c.id, staffId: 'st_jordan', serviceIds: ['svc_cut'], date: isoDaysFromNow(1), time: '10:00', deposit: 80 }).created).toHaveLength(0);
  });

  it('reschedules without changing price and rejects conflicting moves', () => {
    const c = addClient('Mover');
    const { created } = book({ clientId: c.id, staffId: 'st_jordan', serviceIds: ['svc_cut'], date: isoDaysFromNow(1), time: '10:00', deposit: 10 });
    const id = created[0].id;
    S().openReschedule(id);
    S().updateNewApptField('date', day());
    S().updateNewApptField('time', '13:00'); // Olivia with Jordan 13:00
    S().saveNewAppt();
    expect(S().appointments.find((a) => a.id === id)!.date).toBe(isoDaysFromNow(1));
    S().updateNewApptField('time', '14:00');
    S().saveNewAppt();
    const moved = S().appointments.find((a) => a.id === id)!;
    expect(moved).toMatchObject({ date: day(), time: '14:00', price: 65, deposit: 10 });
    expect(S().appointments.filter((a) => a.clientId === c.id)).toHaveLength(1);
    expect(S().payments.filter((p) => p.apptId === id)).toHaveLength(1);
  });

  it('creates a recurring series, skipping clashes, with a single deposit', () => {
    const c = addClient('Weekly');
    const first = isoDaysFromNow(1); // Thursday
    // Pre-book a clash three weeks out.
    const blocker = addClient('Blocker');
    book({ clientId: blocker.id, staffId: 'st_ava', serviceIds: ['svc_gelmani'], date: isoDaysFromNow(22), time: '11:00' });
    const r = book({ clientId: c.id, staffId: 'st_ava', serviceIds: ['svc_gelmani'], date: first, time: '11:00', recurring: 'weekly', deposit: 10 });
    expect(r.created.length).toBe(11);
    expect(r.created.some((a) => a.date === isoDaysFromNow(22))).toBe(false);
    expect(S().payments.filter((p) => r.created.some((a) => a.id === p.apptId))).toHaveLength(1);
    for (const a of r.created) expect(sel.getAppointmentsForDate(S(), a.date).filter((x) => x.staffId === 'st_ava' && x.time === '11:00')).toHaveLength(1);
  });
});

describe('archive integrity', () => {
  it('archiving a client keeps history, cancels upcoming visits, and blocks hard delete', () => {
    const history = S().appointments.filter((a) => a.clientId === 'cl_lauren').length;
    S().archiveClient('cl_lauren');
    confirm();
    const lauren = S().clients.find((c) => c.id === 'cl_lauren')!;
    expect(lauren.archived).toBe(true);
    expect(S().appointments.filter((a) => a.clientId === 'cl_lauren')).toHaveLength(history);
    expect(S().appointments.filter((a) => a.clientId === 'cl_lauren' && a.date >= todayISO()).every((a) => a.status === 'cancelled')).toBe(true);
    expect(sel.clientName(S(), 'cl_lauren')).toBe('Lauren Wallace');
    expect(sel.getRebookingOpportunities(S()).some((e) => e.client.id === 'cl_lauren')).toBe(false);
    S().deleteClient('cl_lauren');
    expect(S().confirmDialog).toBeNull();
    expect(S().clients.some((c) => c.id === 'cl_lauren')).toBe(true);
  });

  it('removing staff with upcoming work is blocked; otherwise they become "former" and history keeps their name', () => {
    S().removeStaff('st_mia');
    expect(S().staff.find((s) => s.id === 'st_mia')!.archived).toBeFalsy();
    S().addStaff('Temp', 'Stylist');
    const temp = S().staff.find((s) => s.name === 'Temp')!;
    S().removeStaff(temp.id);
    confirm();
    expect(S().staff.find((s) => s.id === temp.id)!.archived).toBe(true);
    expect(sel.staffName(S(), temp.id)).toBe('Temp (former)');
    expect(sel.activeStaff(S()).some((s) => s.id === temp.id)).toBe(false);
  });

  it('archived services still name past appointments but cannot be booked', () => {
    S().archiveToggleService('svc_highlight');
    const past = S().appointments.find((a) => a.serviceIds.includes('svc_highlight'))!;
    expect(sel.serviceNames(S(), past.serviceIds)).toBe('Full Highlight');
    const c = addClient('Archived svc');
    expect(book({ clientId: c.id, staffId: 'st_jordan', serviceIds: ['svc_highlight'], date: isoDaysFromNow(1), time: '10:00' }).created).toHaveLength(0);
  });
});

describe('search', () => {
  it('finds clients by phone digits, email, and bookings/services/staff/payments', () => {
    expect(sel.getSearchResults(S(), '4155550142').clients.map((c) => c.id)).toContain('cl_sarah');
    expect(sel.getSearchResults(S(), '555-0142').clients.map((c) => c.id)).toContain('cl_sarah');
    expect(sel.getSearchResults(S(), 'sarah.mitchell@').clients.map((c) => c.id)).toContain('cl_sarah');
    expect(sel.getSearchResults(S(), 'balayage').services.map((s) => s.id)).toContain('svc_balayage');
    expect(sel.getSearchResults(S(), 'balayage').appointments.length).toBeGreaterThan(0);
    expect(sel.getSearchResults(S(), 'jordan').staff.map((s) => s.id)).toContain('st_jordan');
    expect(sel.getSearchResults(S(), 'jordan').appointments.every((a) => a.staffId === 'st_jordan')).toBe(true);
    expect(sel.getSearchResults(S(), 'emma').payments.length).toBeGreaterThan(0);
    expect(sel.getSearchResults(S(), '').total).toBe(0);
  });
});

describe('rebooking', () => {
  it('surfaces due/overdue clients and pre-fills a booking on an open day', () => {
    const opps = sel.getRebookingOpportunities(S());
    expect(opps.length).toBeGreaterThan(5);
    const target = opps[0].client.id;
    S().rebookClient(target);
    expect(S().showNewAppt).toBe(true);
    expect(S().newApptDraft.clientId).toBe(target);
    const d = new Date(S().newApptDraft.date + 'T00:00:00');
    expect(S().business.openDays).toContain(d.getDay());
    expect(S().newApptDraft.date >= isoDaysFromNow(S().business.rebookWeeks * 7)).toBe(true);
  });
});

describe('backup, restore and recovery', () => {
  it('rejects an invalid file without touching data', () => {
    const before = S().clients.length;
    S().beginImport('bad.json', '{"hello":1}');
    expect(S().pendingImport).toBeNull();
    expect(S().confirmDialog?.title).toMatch(/not imported/);
    expect(S().clients.length).toBe(before);
  });

  it('restores a valid backup after review, keeping a recovery copy that can undo it', async () => {
    S().clearAllData();
    confirm();
    await settle();
    addClient('Real Client One');
    const realDomain = { ...S(), clients: S().clients };
    const file = JSON.stringify(buildBackup({ ...realDomain, demoMode: false, onboardingComplete: true, lastBackupAt: null } as never, '2026-09-22T12:00:00.000Z'));

    await demo(); // switch back to demo data
    const demoClients = S().clients.length;
    S().beginImport('lumora-backup.json', file);
    expect(S().pendingImport?.summary.counts.clients).toBe(1);
    expect(S().clients.length).toBe(demoClients); // nothing changes until confirmed
    await S().confirmImport();
    expect(S().clients.map((c) => c.name)).toEqual(['Real Client One']);
    expect(S().showOnboarding).toBe(false);
    expect(storage.getItem(RECOVERY_KEY)).toBeTruthy();

    await S().restoreRecovery();
    confirm();
    await settle();
    expect(S().clients.length).toBe(demoClients);
  });

  it('marks the backup date on export', () => {
    const g = globalThis as unknown as Record<string, unknown>;
    const clicks: string[] = [];
    const RealBlob = globalThis.Blob;
    g.URL = Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    g.Blob = class { constructor(public parts: unknown[]) {} };
    g.document = { body: { appendChild: () => {} }, createElement: () => ({ click: () => clicks.push('x'), remove: () => {}, set href(_v: string) {}, set download(_v: string) {} }) };
    try {
      S().exportBackup();
    } finally {
      g.Blob = RealBlob;
    }
    expect(clicks).toHaveLength(1);
    expect(S().lastBackupAt).toBeTruthy();
  });
});

describe('persistence', () => {
  it('saves every change to localStorage', async () => {
    addClient('Persisted Person');
    await flushStorage();
    const raw = JSON.parse(storage.getItem(STORAGE_KEY)!);
    expect(raw.state.clients.some((c: { name: string }) => c.name === 'Persisted Person')).toBe(true);
  });

  it('survives unreadable stored data: keeps a copy aside and reports it', async () => {
    storage.setItem(STORAGE_KEY, '{not json');
    await useStore.persist.rehydrate();
    expect(useStorageStatus.getState().loadNotice).toMatch(/could not be read/);
    const kept = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k) => k?.startsWith('lumora-salon-os-unreadable-'));
    expect(kept.length).toBeGreaterThan(0);
    expect(Array.isArray(S().clients)).toBe(true);
  });

  it('loads partially damaged data, skipping only the bad records', async () => {
    const good = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    S().openNewClient();
    const raw = { state: { ...pickState(), clients: [...S().clients, { broken: true }, null] }, version: 2 };
    storage.setItem(STORAGE_KEY, JSON.stringify(raw));
    await useStore.persist.rehydrate();
    expect(useStorageStatus.getState().loadNotice).toMatch(/couldn't be read/);
    expect(S().clients.length).toBeGreaterThan(10);
    void good;
  });

  it('reports a failed save when storage is full', async () => {
    storage.quotaBytes = 10;
    addClient('Too Big');
    await flushStorage();
    expect(useStorageStatus.getState().saveError).toMatch(/NOT saved|could not be saved/);
    storage.quotaBytes = Infinity;
  });
});

describe('large workspaces fit in browser storage', () => {
  it('compresses a multi-year workspace far below the ~5 MB quota and reloads it intact', async () => {
    const base = S().appointments[0];
    const appointments = Array.from({ length: 15000 }, (_, i) => ({ ...base, id: `yr_a${i}`, clientId: 'cl_sarah', date: isoDaysFromNow(-(i % 1500)), status: 'completed' as const }));
    useStore.setState({ appointments: [...S().appointments, ...appointments] });
    storage.quotaBytes = 5_000_000;
    await flushStorage();
    expect(useStorageStatus.getState().saveError).toBeNull();
    const raw = storage.getItem(STORAGE_KEY)!;
    expect(raw.startsWith('GZ1:')).toBe(true);
    expect(raw.length).toBeLessThan(1_000_000);
    const count = S().appointments.length;
    useStore.setState({ appointments: [] });
    await useStore.persist.rehydrate();
    expect(S().appointments.length).toBe(count);
    storage.quotaBytes = Infinity;
  });

  it('keeps a compressed recovery copy before destructive actions even when data is large', async () => {
    const base = S().appointments[0];
    useStore.setState({ appointments: Array.from({ length: 15000 }, (_, i) => ({ ...base, id: `rc_a${i}` })) });
    storage.quotaBytes = 5_000_000;
    await flushStorage();
    S().clearAllData();
    confirm();
    await vi.waitFor(() => expect(S().appointments).toHaveLength(0), { timeout: 10000 });
    expect(storage.getItem(RECOVERY_KEY)!.startsWith('GZ1:')).toBe(true);
    await S().restoreRecovery();
    confirm();
    await vi.waitFor(() => expect(S().appointments).toHaveLength(15000), { timeout: 10000 });
    storage.quotaBytes = Infinity;
  });
});

describe('demo → real workspace', () => {
  it('setup with "start fresh" gives an empty, non-demo workspace', () => {
    S().startSetup();
    S().updateObBiz('name', 'Glow Studio');
    S().obNext();
    S().obNext();
    S().setObTeamType('solo');
    S().finishSetup();
    expect(S().business.name).toBe('Glow Studio');
    expect(S().clients).toHaveLength(0);
    expect(S().appointments).toHaveLength(0);
    expect(S().payments).toHaveLength(0);
    expect(S().expenses).toHaveLength(0);
    expect(S().demoMode).toBe(false);
  });

  it('setup that keeps demo data archives replaced staff/services so history still has names', () => {
    S().startSetup();
    S().updateObBiz('name', 'Glow Studio');
    S().obNext();
    S().setObServiceMode('scratch');
    S().addObService();
    const row = S().onboardingBiz.serviceDraft[0];
    S().updateObServiceField(row.id, 'name', 'Signature Cut');
    S().updateObServiceField(row.id, 'price', 80);
    S().updateObBiz('startFresh', false);
    S().obNext();
    S().finishSetup();
    const past = S().appointments.find((a) => a.serviceIds.includes('svc_balayage'))!;
    expect(sel.serviceNames(S(), past.serviceIds)).toContain('Balayage');
    expect(S().services.find((s) => s.id === 'svc_balayage')!.active).toBe(false);
    expect(sel.staffName(S(), past.staffId)).toMatch(/Mia Chen/);
  });

  it('onboarding refuses to continue without a business name or services', () => {
    S().startSetup();
    S().obNext();
    expect(S().onboardingStep).toBe(1);
    S().updateObBiz('name', 'X');
    S().obNext();
    S().setObServiceMode('scratch');
    S().obNext();
    expect(S().onboardingStep).toBe(2);
  });
});

describe('large datasets', () => {
  it('keeps dashboard, search and client lists fast with thousands of records', () => {
    const clients = Array.from({ length: 3000 }, (_, i) => ({ ...S().clients[0], id: `big_c${i}`, name: `Client ${i}`, phone: `(555) 000-${String(i).padStart(4, '0')}`, email: `c${i}@x.com`, lastVisit: isoDaysFromNow(-(i % 200)) }));
    const base = S().appointments[0];
    const appointments = Array.from({ length: 20000 }, (_, i) => ({ ...base, id: `big_a${i}`, clientId: `big_c${i % 3000}`, date: isoDaysFromNow((i % 400) - 200), status: (i % 3 === 0 ? 'completed' : 'confirmed') as 'completed' | 'confirmed' }));
    useStore.setState({ clients, appointments });
    const t0 = performance.now();
    sel.getNeedsAttention(S());
    sel.getRetentionGroups(S());
    sel.getSearchResults(S(), 'client 29');
    clients.slice(0, 200).forEach((c) => {
      sel.getOutstandingForClient(S(), c.id);
      sel.getNextApptForClient(S(), c.id);
    });
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(2000);
  });
});

function pickState() {
  const s = S();
  return { business: s.business, staff: s.staff, services: s.services, clients: s.clients, appointments: s.appointments, inventory: s.inventory, payments: s.payments, expenses: s.expenses, waitlist: s.waitlist, content: s.content, giftCards: s.giftCards, loyaltyRewards: s.loyaltyRewards, demoMode: s.demoMode, onboardingComplete: true, lastBackupAt: null };
}
