import type {
  Appointment,
  AppointmentStatus,
  Business,
  Client,
  ContentItem,
  Expense,
  GiftCard,
  InventoryItem,
  LoyaltyReward,
  Payment,
  Service,
  StaffMember,
  WaitlistEntry,
} from '../types';
import type { Domain } from '../store/types';
import { formatHoursLabel, parseHoursText } from './hours';

/**
 * Lumora keeps everything in this browser's localStorage. This module owns the
 * shape of that data: it repairs whatever is stored (tolerant, used on startup)
 * and validates backup files (strict, used before an import overwrites anything).
 */

export const BACKUP_APP_ID = 'lumora-salon-os';
// 3: gift card redemptions, store credit, deposit outcomes, points history, per-service rebook cycles.
export const BACKUP_SCHEMA_VERSION = 3;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  businessName: string;
  data: Domain;
}

export interface RepairReport {
  domain: Domain;
  dropped: number; // records that were unusable and removed
  problems: string[]; // human-readable notes, capped
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, def = ''): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : def);
const num = (v: unknown, def = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : def;
};
const nonNeg = (v: unknown, def = 0) => Math.max(0, num(v, def));
const bool = (v: unknown, def = false): boolean => (typeof v === 'boolean' ? v : def);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const isDate = (v: unknown): v is string => typeof v === 'string' && ISO_DATE.test(v);
const dateOr = (v: unknown, def: string) => (isDate(v) ? v : typeof v === 'string' && ISO_DATE.test(v.slice(0, 10)) ? v.slice(0, 10) : def);
const dateOrNull = (v: unknown) => (isDate(v) ? v : typeof v === 'string' && ISO_DATE.test(v.slice(0, 10)) ? v.slice(0, 10) : null);
const idOk = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

const STATUSES: AppointmentStatus[] = ['unconfirmed', 'confirmed', 'checked-in', 'in-service', 'completed', 'cancelled', 'no-show'];
const PAYMENT_TYPES: Payment['type'][] = ['deposit', 'balance', 'full', 'product', 'package', 'gift-card'];

const TODAY = () => new Date().toISOString().slice(0, 10);

function defaultBusinessShape(): Business {
  return {
    name: 'My Beauty Business',
    currencyCode: 'USD',
    currencySymbol: '$',
    hours: 'Tue–Sat, 9:00 AM – 6:00 PM',
    openDays: [2, 3, 4, 5, 6],
    openTime: '09:00',
    closeTime: '18:00',
    teamType: 'solo',
    depositPct: 25,
    bufferMin: 15,
    cancellationWindowHrs: 24,
    rebookWeeks: 6,
  };
}

export function normalizeBusiness(v: unknown): Business {
  const d = defaultBusinessShape();
  if (!isObj(v)) return d;
  const hoursText = str(v.hours, d.hours);
  const parsed = parseHoursText(hoursText);
  const openDaysRaw = Array.isArray(v.openDays) ? v.openDays.filter((x): x is number => typeof x === 'number' && x >= 0 && x <= 6) : null;
  const openDays = openDaysRaw ? [...new Set(openDaysRaw)].sort() : parsed.openDays;
  let openTime = typeof v.openTime === 'string' && HH_MM.test(v.openTime) ? v.openTime : parsed.openTime;
  let closeTime = typeof v.closeTime === 'string' && HH_MM.test(v.closeTime) ? v.closeTime : parsed.closeTime;
  if (closeTime <= openTime) {
    openTime = d.openTime;
    closeTime = d.closeTime;
  }
  return {
    name: str(v.name, d.name).trim() || d.name,
    currencyCode: str(v.currencyCode, d.currencyCode),
    currencySymbol: str(v.currencySymbol, d.currencySymbol),
    hours: formatHoursLabel(openDays, openTime, closeTime),
    openDays,
    openTime,
    closeTime,
    teamType: v.teamType === 'team' ? 'team' : 'solo',
    depositPct: Math.min(100, nonNeg(v.depositPct, d.depositPct)),
    bufferMin: Math.min(240, nonNeg(v.bufferMin, d.bufferMin)),
    cancellationWindowHrs: nonNeg(v.cancellationWindowHrs, d.cancellationWindowHrs),
    rebookWeeks: Math.max(1, Math.min(52, num(v.rebookWeeks, d.rebookWeeks))),
  };
}

function normStaff(v: unknown): StaffMember | null {
  if (!isObj(v) || !idOk(v.id)) return null;
  const name = str(v.name).trim() || 'Team member';
  return {
    id: v.id,
    name,
    role: str(v.role),
    color: str(v.color, '#7a2f57'),
    initials: str(v.initials) || name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase(),
    ...(v.archived === true ? { archived: true } : {}),
  };
}

function normService(v: unknown): Service | null {
  if (!isObj(v) || !idOk(v.id)) return null;
  return {
    id: v.id,
    name: str(v.name).trim() || 'Service',
    category: str(v.category).trim() || 'General',
    duration: Math.max(5, num(v.duration, 30)),
    price: nonNeg(v.price),
    materials: nonNeg(v.materials),
    laborHours: nonNeg(v.laborHours),
    hourlyRate: nonNeg(v.hourlyRate, 40),
    overhead: nonNeg(v.overhead),
    active: bool(v.active, true),
    targetMargin: Math.min(0.95, Math.max(0, num(v.targetMargin, 0.35))),
    ...(num(v.rebookWeeks, 0) >= 1 ? { rebookWeeks: Math.min(52, Math.round(num(v.rebookWeeks))) } : {}),
  };
}

let repairSeq = 0;
function normClient(v: unknown): Client | null {
  if (!isObj(v)) return null;
  const name = str(v.name).trim();
  if (!name) return null;
  // Early demo data could save clients without an id; give them one rather than losing them.
  if (!idOk(v.id)) v = { ...v, id: `cl_repaired_${Date.now().toString(36)}_${(repairSeq += 1)}` };
  if (!isObj(v) || !idOk(v.id)) return null;
  const bp = isObj(v.beautyProfile) ? v.beautyProfile : {};
  const vip = ['none', 'silver', 'gold', 'platinum'].includes(str(v.vipTier)) ? (v.vipTier as Client['vipTier']) : 'none';
  const birthday = typeof v.birthday === 'string' && /^\d{2}-\d{2}$/.test(v.birthday) ? v.birthday : '';
  return {
    id: v.id,
    name,
    phone: str(v.phone),
    email: str(v.email),
    birthday,
    createdAt: dateOr(v.createdAt, TODAY()),
    lastVisit: dateOrNull(v.lastVisit),
    nextVisit: null,
    lifetimeSpend: nonNeg(v.lifetimeSpend),
    visits: Math.floor(nonNeg(v.visits)),
    vipTier: vip,
    loyaltyPoints: Math.floor(nonNeg(v.loyaltyPoints)),
    beautyProfile: {
      hairType: str(bp.hairType),
      skinType: str(bp.skinType),
      nailType: str(bp.nailType),
      allergies: str(bp.allergies),
      formulas: str(bp.formulas),
      productsUsed: str(bp.productsUsed),
      patchTestDate: str(bp.patchTestDate),
      preferences: str(bp.preferences),
      preferredStaffId: str(bp.preferredStaffId),
    },
    notes: (Array.isArray(v.notes) ? v.notes : [])
      .filter(isObj)
      .filter((n) => idOk(n.id))
      .map((n) => ({ id: n.id as string, date: dateOr(n.date, TODAY()), text: str(n.text), author: str(n.author, 'You') })),
    photos: (Array.isArray(v.photos) ? v.photos : [])
      .filter(isObj)
      .filter((p) => idOk(p.id))
      .map((p) => ({ id: p.id as string, date: dateOr(p.date, TODAY()), label: str(p.label), kind: p.kind === 'before' ? 'before' : 'after', color: str(p.color, '#caa26a') })),
    noShowCount: Math.floor(nonNeg(v.noShowCount)),
    cancellationCount: Math.floor(nonNeg(v.cancellationCount)),
    status: v.status === 'lead' || v.status === 'inactive' ? v.status : 'active',
    ...(typeof v.referredBy === 'string' ? { referredBy: v.referredBy } : {}),
    ...(v.archived === true ? { archived: true } : {}),
    ...(Array.isArray(v.pointsLog)
      ? {
          pointsLog: v.pointsLog
            .filter(isObj)
            .filter((e) => idOk(e.id) && Number.isFinite(num(e.delta, NaN)))
            .map((e) => ({ id: e.id as string, date: dateOr(e.date, TODAY()), delta: Math.round(num(e.delta)), reason: str(e.reason), ...(idOk(e.apptId) ? { apptId: e.apptId } : {}) })),
        }
      : {}),
  };
}

function normAppointment(v: unknown): Appointment | null {
  if (!isObj(v) || !idOk(v.id) || !idOk(v.clientId) || !isDate(v.date)) return null;
  if (typeof v.time !== 'string' || !HH_MM.test(v.time)) return null;
  const status = STATUSES.includes(v.status as AppointmentStatus) ? (v.status as AppointmentStatus) : 'confirmed';
  const price = nonNeg(v.price);
  const discount = Math.min(price, nonNeg(v.discount));
  const deposit = Math.min(price - discount, nonNeg(v.deposit));
  const recurring = ['none', 'weekly', 'biweekly', 'monthly'].includes(str(v.recurring)) ? (v.recurring as Appointment['recurring']) : 'none';
  return {
    id: v.id,
    clientId: v.clientId,
    staffId: str(v.staffId),
    serviceIds: strArr(v.serviceIds),
    date: v.date,
    time: v.time,
    durationMin: Math.max(5, num(v.durationMin, 30)),
    price,
    discount,
    deposit,
    depositPaid: bool(v.depositPaid, deposit > 0),
    balancePaid: bool(v.balancePaid),
    status,
    notes: str(v.notes),
    recurring,
    createdAt: dateOr(v.createdAt, v.date),
    tip: nonNeg(v.tip),
    productsSold: (Array.isArray(v.productsSold) ? v.productsSold : [])
      .filter(isObj)
      .filter((l) => idOk(l.itemId) && nonNeg(l.qty) > 0)
      .map((l) => ({ itemId: l.itemId as string, qty: nonNeg(l.qty), price: nonNeg(l.price), ...(typeof l.name === 'string' ? { name: l.name } : {}) })),
    ...(typeof v.cancelReason === 'string' ? { cancelReason: v.cancelReason } : {}),
    ...(v.depositOutcome === 'kept' || v.depositOutcome === 'refunded' || v.depositOutcome === 'credit' ? { depositOutcome: v.depositOutcome } : {}),
  };
}

function normInventory(v: unknown): InventoryItem | null {
  if (!isObj(v) || !idOk(v.id)) return null;
  const usage: Record<string, number> = {};
  if (isObj(v.usagePerService)) {
    Object.entries(v.usagePerService).forEach(([k, amt]) => {
      const n = num(amt, 0);
      if (n > 0) usage[k] = n;
    });
  }
  return {
    id: v.id,
    name: str(v.name).trim() || 'Item',
    qty: nonNeg(v.qty),
    unit: str(v.unit, 'unit') || 'unit',
    cost: nonNeg(v.cost),
    retailPrice: nonNeg(v.retailPrice),
    supplier: str(v.supplier),
    reorderLevel: nonNeg(v.reorderLevel),
    expiration: dateOrNull(v.expiration),
    usagePerService: usage,
  };
}

function normPayment(v: unknown): Payment | null {
  if (!isObj(v) || !idOk(v.id) || !idOk(v.clientId)) return null;
  const amount = num(v.amount, NaN);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return {
    id: v.id,
    clientId: v.clientId,
    apptId: idOk(v.apptId) ? v.apptId : null,
    amount,
    method: v.method === 'Cash' ? 'Cash' : v.method === 'Gift card' ? 'Gift card' : 'Card',
    type: PAYMENT_TYPES.includes(v.type as Payment['type']) ? (v.type as Payment['type']) : 'full',
    date: dateOr(v.date, TODAY()),
    ...(typeof v.note === 'string' && v.note ? { note: v.note } : {}),
    ...(nonNeg(v.tip) > 0 ? { tip: Math.min(amount, nonNeg(v.tip)) } : {}),
    ...(v.voided === true ? { voided: true, voidedAt: dateOr(v.voidedAt, TODAY()) } : {}),
    ...(typeof v.createdAt === 'string' && !Number.isNaN(Date.parse(v.createdAt)) ? { createdAt: v.createdAt } : {}),
    ...(idOk(v.giftCardId) ? { giftCardId: v.giftCardId } : {}),
  };
}

function normExpense(v: unknown): Expense | null {
  if (!isObj(v) || !idOk(v.id)) return null;
  const amount = num(v.amount, NaN);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return { id: v.id, name: str(v.name).trim() || 'Expense', category: str(v.category, 'Other') || 'Other', amount, date: dateOr(v.date, TODAY()) };
}

function normWaitlist(v: unknown): WaitlistEntry | null {
  if (!isObj(v) || !idOk(v.id) || !idOk(v.clientId)) return null;
  return { id: v.id, clientId: v.clientId, serviceIds: strArr(v.serviceIds), note: str(v.note), createdAt: dateOr(v.createdAt, TODAY()) };
}

function normContent(v: unknown): ContentItem | null {
  if (!isObj(v) || !idOk(v.id)) return null;
  const stage = ['idea', 'draft', 'scheduled', 'posted'].includes(str(v.stage)) ? (v.stage as ContentItem['stage']) : 'idea';
  const platform = ['Instagram', 'TikTok', 'Pinterest', 'Facebook'].includes(str(v.platform)) ? (v.platform as ContentItem['platform']) : 'Instagram';
  return { id: v.id, title: str(v.title).trim() || 'Untitled', platform, template: str(v.template), stage, date: dateOrNull(v.date) };
}

function normGiftCard(v: unknown): GiftCard | null {
  if (!isObj(v) || !idOk(v.id)) return null;
  const initialValue = nonNeg(v.initialValue);
  const voided = v.voided === true;
  return {
    id: v.id,
    code: str(v.code).trim() || `LUM-${v.id.slice(-4).toUpperCase()}`,
    initialValue,
    balance: voided ? 0 : Math.min(initialValue, nonNeg(v.balance)),
    purchasedBy: str(v.purchasedBy),
    issuedDate: dateOr(v.issuedDate, TODAY()),
    ...(v.kind === 'credit' ? { kind: 'credit' as const } : { kind: 'gift' as const }),
    ...(idOk(v.clientId) ? { clientId: v.clientId } : {}),
    ...(voided ? { voided: true } : {}),
    ...(idOk(v.sourceApptId) ? { sourceApptId: v.sourceApptId } : {}),
  };
}

function normReward(v: unknown): LoyaltyReward | null {
  if (!isObj(v) || !idOk(v.id)) return null;
  return { id: v.id, label: str(v.label).trim() || 'Reward', pointsCost: Math.max(1, Math.floor(num(v.pointsCost, 100))) };
}

function collect<T extends { id: string }>(label: string, raw: unknown, norm: (v: unknown) => T | null, report: { dropped: number; problems: string[] }): T[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    report.dropped += 1;
    report.problems.push(`${label} list was not readable`);
    return [];
  }
  const seen = new Set<string>();
  const out: T[] = [];
  let bad = 0;
  raw.forEach((r) => {
    const n = norm(r);
    if (!n || seen.has(n.id)) {
      bad += 1;
      return;
    }
    seen.add(n.id);
    out.push(n);
  });
  if (bad > 0) {
    report.dropped += bad;
    report.problems.push(`${bad} ${label} record${bad === 1 ? '' : 's'} could not be read`);
  }
  return out;
}

/** Paid/settled flags are derived from payments; stored flags can be stale, so they are rebuilt whenever data is loaded. */
export function rebuildPaidFlags(appointments: Appointment[], payments: Payment[]): Appointment[] {
  const paid = new Map<string, number>();
  payments.forEach((p) => {
    if (!p.voided && p.apptId) paid.set(p.apptId, (paid.get(p.apptId) || 0) + p.amount - (p.tip || 0));
  });
  return appointments.map((a) => {
    const got = paid.get(a.id) || 0;
    const bill = Math.max(0, a.price - a.discount) + a.productsSold.reduce((n, l) => n + l.qty * l.price, 0);
    const balancePaid = a.status === 'completed' && got >= bill - 0.005;
    const depositPaid = got > 0.004;
    return balancePaid === a.balancePaid && depositPaid === a.depositPaid ? a : { ...a, balancePaid, depositPaid };
  });
}

/** Tolerant: turns any stored/imported object into a usable Domain, dropping unreadable records. */
export function repairDomain(raw: unknown): RepairReport {
  const report = { dropped: 0, problems: [] as string[] };
  const src: Obj = isObj(raw) ? raw : {};
  if (!isObj(raw)) {
    report.dropped += 1;
    report.problems.push('Saved data was not readable');
  }
  const domain: Domain = {
    business: normalizeBusiness(src.business),
    staff: collect('team', src.staff, normStaff, report),
    services: collect('service', src.services, normService, report),
    clients: collect('client', src.clients, normClient, report),
    appointments: collect('appointment', src.appointments, normAppointment, report),
    inventory: collect('inventory', src.inventory, normInventory, report),
    payments: collect('payment', src.payments, normPayment, report),
    expenses: collect('expense', src.expenses, normExpense, report),
    waitlist: collect('waitlist', src.waitlist, normWaitlist, report),
    content: collect('content', src.content, normContent, report),
    giftCards: collect('gift card', src.giftCards, normGiftCard, report),
    loyaltyRewards: collect('reward', src.loyaltyRewards, normReward, report),
    demoMode: bool(src.demoMode, false),
    onboardingComplete: bool(src.onboardingComplete, true),
    lastBackupAt: typeof src.lastBackupAt === 'string' ? src.lastBackupAt : null,
  };
  domain.appointments = rebuildPaidFlags(domain.appointments, domain.payments);
  if (domain.staff.length === 0) {
    domain.staff = [{ id: 'st_you', name: 'You', role: 'Owner', color: '#7a2f57', initials: 'YOU' }];
  }
  return { domain, dropped: report.dropped, problems: report.problems.slice(0, 6) };
}

export interface BackupSummary {
  businessName: string;
  exportedAt: string | null;
  schemaVersion: number;
  counts: { clients: number; appointments: number; payments: number; services: number; staff: number; inventory: number; expenses: number };
  warnings: string[];
}

export type BackupParseResult = { ok: true; domain: Domain; summary: BackupSummary } | { ok: false; error: string };

const REQUIRED_KEYS = ['business', 'staff', 'services', 'clients', 'appointments', 'payments'] as const;

/**
 * Strict: accepts only a Lumora backup (current format, or the raw storage
 * format older versions exported). Any unreadable record rejects the file so a
 * damaged backup can never silently overwrite good data.
 */
export function parseBackup(text: string): BackupParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't valid JSON. Choose a backup file exported from Lumora (lumora-backup-….json)." };
  }
  if (!isObj(json)) return { ok: false, error: "This file doesn't look like a Lumora backup." };

  let data: unknown;
  let exportedAt: string | null = null;
  let schemaVersion = 1;
  if (json.app === BACKUP_APP_ID) {
    schemaVersion = num(json.schemaVersion, 0);
    if (schemaVersion < 1) return { ok: false, error: 'This backup has an unknown format version.' };
    if (schemaVersion > BACKUP_SCHEMA_VERSION) return { ok: false, error: 'This backup was made by a newer version of Lumora. Update your Lumora file, then import again.' };
    data = json.data;
    exportedAt = typeof json.exportedAt === 'string' ? json.exportedAt : null;
  } else if (isObj(json.state)) {
    // Backups exported by the first release were the raw storage blob: { state, version }.
    data = json.state;
  } else {
    return { ok: false, error: "This file doesn't look like a Lumora backup." };
  }

  if (!isObj(data)) return { ok: false, error: 'The backup is missing its data section.' };
  const missing = REQUIRED_KEYS.filter((k) => !(k in data));
  if (missing.length > 0) return { ok: false, error: `The backup is incomplete (missing: ${missing.join(', ')}).` };
  const notArrays = REQUIRED_KEYS.filter((k) => k !== 'business' && !Array.isArray(data[k]));
  if (notArrays.length > 0 || !isObj(data.business)) return { ok: false, error: 'The backup is damaged — some sections are not in the expected format.' };

  const { domain, dropped, problems } = repairDomain(data);
  if (dropped > 0) return { ok: false, error: `The backup is damaged: ${problems.join('; ')}. Nothing was changed.` };

  const clientIds = new Set(domain.clients.map((c) => c.id));
  const orphanAppts = domain.appointments.filter((a) => !clientIds.has(a.clientId)).length;
  const warnings: string[] = [];
  const cardIds = new Set(domain.giftCards.map((g) => g.id));
  const lostCards = domain.payments.filter((p) => !p.voided && p.method === 'Gift card' && (!p.giftCardId || !cardIds.has(p.giftCardId))).length;
  if (lostCards > 0) warnings.push(`${lostCards} gift card payment${lostCards === 1 ? '' : 's'} refer to a gift card that isn't in this backup — the payments are kept, the card can't be used.`);
  if (orphanAppts > 0) warnings.push(`${orphanAppts} appointment${orphanAppts === 1 ? '' : 's'} belong to clients that were deleted before this backup was made — they'll show as "Deleted client".`);

  // A restored workspace should open straight into the app, not the welcome screen.
  domain.onboardingComplete = true;
  return {
    ok: true,
    domain,
    summary: {
      businessName: domain.business.name,
      exportedAt,
      schemaVersion,
      counts: {
        clients: domain.clients.length,
        appointments: domain.appointments.length,
        payments: domain.payments.length,
        services: domain.services.length,
        staff: domain.staff.length,
        inventory: domain.inventory.length,
        expenses: domain.expenses.length,
      },
      warnings,
    },
  };
}

export function buildBackup(domain: Domain, exportedAt: string): BackupFile {
  return { app: BACKUP_APP_ID, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt, businessName: domain.business.name, data: domain };
}

export function backupFileName(businessName: string, isoDateTime: string): string {
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'lumora';
  return `lumora-backup-${slug}-${isoDateTime.slice(0, 16).replace(/[:T]/g, '-')}.json`;
}
