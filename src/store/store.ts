import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { makeId } from '../lib/id';
import { todayISO, addDays, toISODate } from '../lib/dates';
import { pointsForSpend, tierForPoints } from '../lib/loyalty';
import { formatHoursLabel, nextOpenDay } from '../lib/hours';
import { checkBooking } from '../lib/scheduling';
import { canSaveDraft, evaluateDraft } from '../lib/booking';
import { apptBill, apptPaid, apptPaymentCap, activeStaff, clientName, getNextApptForClient, inventoryUsage, lastCompletedAppt, rebookWeeksFor } from '../lib/selectors';
import { OPEN_STATUSES, findDuplicatePayment, isUntouchedCard, isUsableCard, newCardCode, withPoints } from '../lib/finance';
import { backupFileName, buildBackup, parseBackup, repairDomain } from '../lib/backup';
import { STORAGE_KEY, flushStorage, markHydrated, persistStorage, readRecoverySnapshot, saveRecoverySnapshot, useStorageStatus } from '../lib/storage';
import {
  CURRENCIES,
  defaultBusiness,
  seedAppointments,
  seedClients,
  seedContent,
  seedExpenses,
  seedGiftCards,
  seedInventory,
  seedLoyaltyRewards,
  seedPayments,
  seedServices,
  seedStaff,
  seedWaitlist,
} from '../data/seed';
import { defaultCheckoutDraft, defaultNewApptDraft, defaultNewClientDraft, defaultOnboardingBiz, defaultRecordPaymentDraft } from './defaults';
import type { AppState, ConfirmChoice, Domain, ServiceDraftRow } from './types';
import type { Client, ClientNote, ClientPhoto, Service, StaffMember, InventoryItem, Expense, Appointment, AppointmentStatus, Payment, ContentItem, ContentStage, DepositOutcome, GiftCard } from '../types';

function buildDomain(): Domain {
  const appointments = seedAppointments();
  return {
    business: defaultBusiness(),
    staff: seedStaff(),
    services: seedServices(),
    clients: seedClients(),
    appointments,
    inventory: seedInventory(),
    payments: seedPayments(appointments),
    expenses: seedExpenses(),
    waitlist: seedWaitlist(),
    content: seedContent(),
    giftCards: seedGiftCards(),
    loyaltyRewards: seedLoyaltyRewards(),
    demoMode: true,
    onboardingComplete: false,
    lastBackupAt: null,
  };
}

function initialUI() {
  return {
    showOnboarding: true,
    onboardingStep: 0,
    onboardingBiz: defaultOnboardingBiz(),

    section: 'home' as const,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 900 : false,
    showSidebarMobile: false,

    search: '',
    showQuickAdd: false,
    showSettings: false,
    settingsTab: 'Business' as const,

    moneyTab: 'Overview' as const,
    growTab: 'Campaigns' as const,
    bookingsView: 'Day' as const,
    staffFilter: 'all',
    bookingsDate: todayISO(),

    selectedClientId: null,
    clientTab: 'Overview' as const,

    showNewClient: false,
    newClientDraft: defaultNewClientDraft(),
    justAddedClientId: null,

    showNewAppt: false,
    editingApptId: null,
    newApptDraft: defaultNewApptDraft(),
    newApptPrefillClientId: null,

    apptDetailId: null,
    checkoutDraft: defaultCheckoutDraft(),
    justCompletedApptId: null,

    cancellationRescueApptId: null,

    pricingServiceId: 'svc_balayage',

    showRecordPayment: false,
    recordPaymentDraft: defaultRecordPaymentDraft(),

    showArchivedClients: false,
    pendingImport: null,

    copyMessage: null,
    confirmDialog: null,
    toastMsg: '',
    toastId: 0,

    rebookTargetClientId: null,
  };
}

const DOMAIN_KEYS: (keyof Domain)[] = ['business', 'staff', 'services', 'clients', 'appointments', 'inventory', 'payments', 'expenses', 'waitlist', 'content', 'giftCards', 'loyaltyRewards', 'demoMode', 'onboardingComplete', 'lastBackupAt'];

export function pickDomain(s: Domain): Domain {
  const out = {} as Record<string, unknown>;
  DOMAIN_KEYS.forEach((k) => {
    out[k] = s[k];
  });
  return out as unknown as Domain;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const nonNeg = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);
const STAFF_COLORS = ['#7a2f57', '#3f6e63', '#8a6a2f', '#42527a'];
const initialsOf = (name: string) => name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
const digits = (v: string) => v.replace(/\D/g, '');
/** Same phone number regardless of formatting or a leading country code. */
const samePhone = (a: string, b: string) => {
  const x = digits(a);
  const y = digits(b);
  if (x.length < 7 || y.length < 7) return false;
  return x.length >= 10 && y.length >= 10 ? x.slice(-10) === y.slice(-10) : x === y;
};

/** Puts gift-card/credit money from these (now voided) payments back on the cards they came from. */
function restoreCards(cards: GiftCard[], voided: Payment[]): GiftCard[] {
  const back = new Map<string, number>();
  voided.forEach((p) => {
    if (p.method === 'Gift card' && p.giftCardId) back.set(p.giftCardId, (back.get(p.giftCardId) || 0) + p.amount);
  });
  if (back.size === 0) return cards;
  return cards.map((c) => (back.has(c.id) ? { ...c, balance: round2(Math.min(c.initialValue, c.balance + (back.get(c.id) || 0))) } : c));
}

/** Paid/settled flags always follow the payments that are still valid. */
function syncApptFlags(appointments: Appointment[], payments: Payment[], apptIds: (string | null | undefined)[]): Appointment[] {
  const ids = new Set(apptIds.filter(Boolean) as string[]);
  if (ids.size === 0) return appointments;
  return appointments.map((a) => {
    if (!ids.has(a.id)) return a;
    const paid = apptPaid({ payments }, a.id);
    const balancePaid = a.status === 'completed' && paid >= apptBill(a) - 0.005;
    const depositPaid = paid > 0.004;
    return balancePaid === a.balancePaid && depositPaid === a.depositPaid ? a : { ...a, balancePaid, depositPaid };
  });
}

export interface Actions {
  toast: (msg: string) => void;
  askConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string, cancelLabel?: string, destructive?: boolean) => void;
  askChoice: (title: string, message: string, choices: ConfirmChoice[], initial: string, onConfirm: (choice: string) => void, confirmLabel?: string, destructive?: boolean) => void;
  setConfirmChoice: (v: string) => void;
  closeConfirm: () => void;
  runConfirm: () => void;

  setSection: (s: AppState['section']) => void;
  setMobile: (v: boolean) => void;
  toggleSidebarMobile: () => void;
  closeSidebarMobile: () => void;

  setSearch: (v: string) => void;
  toggleQuickAdd: () => void;
  closeQuickAdd: () => void;
  openSettings: (tab?: AppState['settingsTab']) => void;
  closeSettings: () => void;
  setSettingsTab: (tab: AppState['settingsTab']) => void;

  dismissOnboarding: () => void;
  startSetup: () => void;
  obBack: () => void;
  obNext: () => void;
  updateObBiz: <K extends keyof AppState['onboardingBiz']>(field: K, value: AppState['onboardingBiz'][K]) => void;
  setObTeamType: (v: 'solo' | 'team') => void;
  setObServiceMode: (v: 'suggested' | 'scratch') => void;
  addObService: () => void;
  removeObService: (id: string) => void;
  updateObServiceField: (id: string, field: keyof ServiceDraftRow, value: string | number | boolean) => void;
  toggleObServiceAdvanced: (id: string) => void;
  updateObStaffName: (i: number, value: string) => void;
  addObStaffField: () => void;
  removeObStaffField: (i: number) => void;
  toggleObOpenDay: (day: number) => void;
  finishSetup: () => void;
  finishAndAddAppt: () => void;
  goAddFirstClient: () => void;

  askResetDemo: () => void;
  resetDemo: () => Promise<void>;

  openNewClient: () => void;
  closeNewClient: () => void;
  updateNewClientField: (field: keyof AppState['newClientDraft'], value: string) => void;
  saveNewClient: (force?: boolean) => void;
  bookForJustAdded: () => void;
  openJustAddedProfile: () => void;
  dismissJustAdded: () => void;
  openClient: (id: string, tab?: AppState['clientTab']) => void;
  closeClientProfile: () => void;
  setClientTab: (tab: AppState['clientTab']) => void;
  updateClientField: (clientId: string, field: 'name' | 'phone' | 'email' | 'birthday', value: string) => void;
  saveClientContact: (clientId: string, form: { name: string; phone: string; email: string; birthday: string }, onSaved: () => void, force?: boolean) => void;
  addClientNote: (clientId: string, text: string) => void;
  addClientPhoto: (clientId: string, label: string, kind: 'before' | 'after') => void;
  updateBeautyProfileField: (clientId: string, field: keyof Client['beautyProfile'], value: string) => void;
  archiveClient: (id: string) => void;
  restoreClient: (id: string) => void;
  deleteClient: (id: string) => void;
  setShowArchivedClients: (v: boolean) => void;

  setBookingsView: (v: AppState['bookingsView']) => void;
  setStaffFilter: (id: string) => void;
  setBookingsDate: (date: string) => void;
  shiftBookingsDate: (dir: 1 | -1) => void;
  goToday: () => void;

  openNewAppt: (prefill?: Partial<AppState['newApptDraft']>) => void;
  openReschedule: (apptId: string) => void;
  closeNewAppt: () => void;
  updateNewApptField: <K extends keyof AppState['newApptDraft']>(field: K, value: AppState['newApptDraft'][K]) => void;
  toggleNewApptService: (serviceId: string) => void;
  saveNewAppt: () => void;

  openApptDetail: (id: string) => void;
  closeApptDetail: () => void;
  apptAction: (id: string, action: 'confirm' | 'checkin' | 'start' | 'cancel' | 'noshow') => void;
  updateCheckoutTip: (v: number) => void;
  setCheckoutPayMethod: (v: 'Card' | 'Cash') => void;
  setCheckoutGiftCard: (id: string) => void;
  setCheckoutProductQty: (itemId: string, qty: number) => void;
  completeCheckout: () => void;
  closeCompleteScreen: () => void;
  rebookClient: (clientId: string, apptId?: string) => void;
  rebookFromModal: () => void;

  copyWaitlistMessage: (waitlistId: string) => void;
  addToWaitlist: (clientId: string, serviceIds: string[], note: string) => void;
  removeFromWaitlist: (id: string) => void;
  showCopyMessage: (title: string, message: string) => void;
  closeCopyMessage: () => void;

  setMoneyTab: (t: AppState['moneyTab']) => void;
  addService: () => void;
  updateServiceField: (id: string, field: keyof Service, value: string | number | boolean) => void;
  moveService: (id: string, dir: -1 | 1) => void;
  duplicateService: (id: string) => void;
  archiveToggleService: (id: string) => void;
  setPricingServiceId: (id: string) => void;
  applySuggestedPrice: (id: string) => void;

  addExpense: (e: Omit<Expense, 'id'>) => boolean;
  deleteExpense: (id: string) => void;

  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateInventoryField: (id: string, field: keyof InventoryItem, value: string | number | null) => void;
  setInventoryUsage: (itemId: string, serviceId: string, amount: number) => void;
  deleteInventoryItem: (id: string) => void;
  restockInventory: (id: string, amount: number) => void;

  recordPayment: (p: Omit<Payment, 'id' | 'date'>) => void;
  voidPayment: (id: string) => void;
  openRecordPayment: (clientId?: string, apptId?: string, type?: AppState['recordPaymentDraft']['type']) => void;
  voidGiftCard: (cardId: string) => void;
  closeRecordPayment: () => void;
  updateRecordPaymentField: <K extends keyof AppState['recordPaymentDraft']>(field: K, value: AppState['recordPaymentDraft'][K]) => void;
  saveRecordPayment: (force?: boolean) => void;

  setGrowTab: (t: AppState['growTab']) => void;
  redeemReward: (clientId: string, rewardId: string) => void;
  addContentItem: (c: Omit<ContentItem, 'id' | 'stage' | 'date'>) => void;
  moveContentStage: (id: string, stage: ContentStage) => void;
  deleteContentItem: (id: string) => void;

  updateBusinessField: <K extends keyof AppState['business']>(field: K, value: AppState['business'][K]) => void;
  toggleOpenDay: (day: number) => void;
  setBusinessHours: (openTime: string, closeTime: string) => void;
  addStaff: (name: string, role: string) => void;
  updateStaff: (id: string, field: keyof StaffMember, value: string) => void;
  removeStaff: (id: string) => void;
  restoreStaff: (id: string) => void;
  clearAllData: () => void;

  exportBackup: () => void;
  beginImport: (fileName: string, text: string) => void;
  cancelImport: () => void;
  confirmImport: () => Promise<void>;
  restoreRecovery: () => Promise<void>;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<AppState & Actions>()(
  persist(
    (set, get) => {
      /** Keeps a copy of the current workspace so a destructive action can be undone from Settings → Data. */
      const snapshot = async (reason: string) => {
        await flushStorage();
        return saveRecoverySnapshot(pickDomain(get()), reason);
      };

      const applyDomain = (domain: Domain) =>
        set({ ...domain, ...initialUI(), showOnboarding: !domain.onboardingComplete, pricingServiceId: domain.services[0]?.id ?? '' });

      return {
        ...buildDomain(),
        ...initialUI(),

        toast: (msg) => {
          clearTimeout(toastTimer);
          set((s) => ({ toastMsg: msg, toastId: s.toastId + 1 }));
          toastTimer = setTimeout(() => set({ toastMsg: '' }), 3600);
        },
        askConfirm: (title, message, onConfirm, confirmLabel, cancelLabel, destructive) =>
          set({ confirmDialog: { title, message, onConfirm, confirmLabel: confirmLabel || 'Confirm', cancelLabel: cancelLabel || 'Cancel', destructive } }),
        askChoice: (title, message, choices, initial, onConfirm, confirmLabel, destructive) =>
          set({ confirmDialog: { title, message, onConfirm: () => {}, onConfirmChoice: onConfirm, choices, choice: initial, confirmLabel: confirmLabel || 'Confirm', cancelLabel: 'Go Back', destructive } }),
        setConfirmChoice: (v) => set((s) => (s.confirmDialog ? { confirmDialog: { ...s.confirmDialog, choice: v } } : {})),
        closeConfirm: () => set({ confirmDialog: null }),
        runConfirm: () => {
          const d = get().confirmDialog;
          if (!d) return; // already handled (double click)
          set({ confirmDialog: null });
          if (d.onConfirmChoice) d.onConfirmChoice(d.choice || '');
          else d.onConfirm();
        },

        setSection: (s) => set({ section: s, selectedClientId: null, showSidebarMobile: false }),
        setMobile: (v) => set({ isMobile: v }),
        toggleSidebarMobile: () => set((s) => ({ showSidebarMobile: !s.showSidebarMobile })),
        closeSidebarMobile: () => set({ showSidebarMobile: false }),

        setSearch: (v) => set({ search: v }),
        toggleQuickAdd: () => set((s) => ({ showQuickAdd: !s.showQuickAdd })),
        closeQuickAdd: () => set({ showQuickAdd: false }),
        openSettings: (tab) => set({ showSettings: true, settingsTab: tab || 'Business', showQuickAdd: false, showSidebarMobile: false }),
        closeSettings: () => set({ showSettings: false }),
        setSettingsTab: (tab) => set({ settingsTab: tab }),

        /* ---------------- onboarding ---------------- */

        dismissOnboarding: () => set({ showOnboarding: false, onboardingComplete: true }),
        startSetup: () => set({ onboardingStep: 1, onboardingBiz: defaultOnboardingBiz() }),
        obBack: () =>
          set((s) => {
            let prev = s.onboardingStep - 1;
            if (prev === 3 && s.onboardingBiz.teamType === 'solo') prev = 2;
            return { onboardingStep: Math.max(0, prev) };
          }),
        obNext: () => {
          const s = get();
          const biz = s.onboardingBiz;
          const step = s.onboardingStep;
          if (step === 1 && !biz.name.trim()) return get().toast('Add your business name to continue');
          if (step === 2) {
            const rows = biz.serviceDraft;
            if (rows.length === 0) return get().toast('Add at least one service to continue');
            if (rows.some((r) => !r.name.trim())) return get().toast('Every service needs a name');
            if (rows.some((r) => !(r.duration >= 5))) return get().toast('Each service needs a duration of at least 5 minutes');
            if (rows.some((r) => !(r.price >= 0))) return get().toast('Prices can’t be negative');
          }
          if (step === 3 && biz.staffNames.every((n) => !n.trim())) return get().toast('Add at least one team member');
          if (step === 4) {
            if (biz.openDays.length === 0) return get().toast('Choose at least one day you’re open');
            if (!(biz.closeTime > biz.openTime)) return get().toast('Closing time must be after opening time');
          }
          set((st) => {
            let next = st.onboardingStep + 1;
            if (next === 3 && st.onboardingBiz.teamType === 'solo') next = 4;
            if (next > 5) next = 6;
            let onboardingBiz = st.onboardingBiz;
            if (next === 2 && onboardingBiz.serviceMode === 'suggested' && onboardingBiz.serviceDraft.length === 0) {
              onboardingBiz = { ...onboardingBiz, serviceDraft: seedServices().map((sv) => ({ id: sv.id, name: sv.name, category: sv.category, duration: sv.duration, price: sv.price, materials: sv.materials, laborHours: sv.laborHours, overhead: sv.overhead, advanced: false })) };
            }
            return { onboardingStep: next, onboardingBiz };
          });
        },
        updateObBiz: (field, value) => set((s) => ({ onboardingBiz: { ...s.onboardingBiz, [field]: value } })),
        setObTeamType: (v) => set((s) => ({ onboardingBiz: { ...s.onboardingBiz, teamType: v } })),
        setObServiceMode: (v) =>
          set((s) => ({
            onboardingBiz: {
              ...s.onboardingBiz,
              serviceMode: v,
              serviceDraft:
                v === 'suggested'
                  ? seedServices().map((sv) => ({ id: sv.id, name: sv.name, category: sv.category, duration: sv.duration, price: sv.price, materials: sv.materials, laborHours: sv.laborHours, overhead: sv.overhead, advanced: false }))
                  : [],
            },
          })),
        addObService: () =>
          set((s) => ({
            onboardingBiz: {
              ...s.onboardingBiz,
              serviceDraft: [...s.onboardingBiz.serviceDraft, { id: makeId('svc'), name: '', category: 'General', duration: 30, price: 0, materials: 0, laborHours: 0.5, overhead: 0, advanced: false }],
            },
          })),
        removeObService: (id) => set((s) => ({ onboardingBiz: { ...s.onboardingBiz, serviceDraft: s.onboardingBiz.serviceDraft.filter((x) => x.id !== id) } })),
        updateObServiceField: (id, field, value) =>
          set((s) => ({ onboardingBiz: { ...s.onboardingBiz, serviceDraft: s.onboardingBiz.serviceDraft.map((x) => (x.id === id ? { ...x, [field]: typeof value === 'number' ? nonNeg(value) : value } : x)) } })),
        toggleObServiceAdvanced: (id) =>
          set((s) => ({ onboardingBiz: { ...s.onboardingBiz, serviceDraft: s.onboardingBiz.serviceDraft.map((x) => (x.id === id ? { ...x, advanced: !x.advanced } : x)) } })),
        updateObStaffName: (i, value) =>
          set((s) => {
            const names = [...s.onboardingBiz.staffNames];
            names[i] = value;
            return { onboardingBiz: { ...s.onboardingBiz, staffNames: names } };
          }),
        addObStaffField: () => set((s) => ({ onboardingBiz: { ...s.onboardingBiz, staffNames: [...s.onboardingBiz.staffNames, ''] } })),
        removeObStaffField: (i) => set((s) => ({ onboardingBiz: { ...s.onboardingBiz, staffNames: s.onboardingBiz.staffNames.length > 1 ? s.onboardingBiz.staffNames.filter((_, idx) => idx !== i) : [''] } })),
        toggleObOpenDay: (day) =>
          set((s) => {
            const days = s.onboardingBiz.openDays.includes(day) ? s.onboardingBiz.openDays.filter((d) => d !== day) : [...s.onboardingBiz.openDays, day].sort();
            return { onboardingBiz: { ...s.onboardingBiz, openDays: days } };
          }),

        finishSetup: () => {
          const s = get();
          const biz = s.onboardingBiz;
          const currency = CURRENCIES.find((c) => c.code === biz.currencyCode) || CURRENCIES[0];
          const business = {
            ...s.business,
            name: biz.name.trim() || s.business.name,
            currencyCode: currency.code,
            currencySymbol: currency.symbol,
            teamType: biz.teamType,
            openDays: biz.openDays,
            openTime: biz.openTime,
            closeTime: biz.closeTime,
            hours: formatHoursLabel(biz.openDays, biz.openTime, biz.closeTime),
            depositPct: biz.depositPct,
            bufferMin: nonNeg(biz.bufferMin),
          };

          // Records that keep demo history intact are archived instead of dropped.
          const keepHistory = !biz.startFresh;
          const usedServiceIds = new Set(keepHistory ? s.appointments.flatMap((a) => a.serviceIds) : []);
          const usedStaffIds = new Set(keepHistory ? s.appointments.map((a) => a.staffId) : []);

          let services: Service[] = biz.serviceDraft.map((sv) => ({ id: sv.id, name: sv.name.trim(), category: sv.category.trim() || 'General', duration: Math.max(5, sv.duration), price: nonNeg(sv.price), materials: nonNeg(sv.materials), laborHours: nonNeg(sv.laborHours), hourlyRate: 40, overhead: nonNeg(sv.overhead), active: true, targetMargin: 0.35 }));
          const draftIds = new Set(services.map((sv) => sv.id));
          services = [...services, ...s.services.filter((sv) => !draftIds.has(sv.id) && usedServiceIds.has(sv.id)).map((sv) => ({ ...sv, active: false }))];

          let staff: StaffMember[];
          if (biz.teamType === 'solo') {
            staff = [{ id: 'st_you', name: 'You', role: 'Owner · Stylist', color: STAFF_COLORS[0], initials: 'YOU' }];
          } else {
            staff = biz.staffNames
              .map((n) => n.trim())
              .filter(Boolean)
              .map((n, i) => ({ id: makeId('st'), name: n, role: i === 0 ? 'Owner' : 'Staff', color: STAFF_COLORS[i % 4], initials: initialsOf(n) }));
          }
          staff = [...staff, ...s.staff.filter((st) => usedStaffIds.has(st.id) && !staff.some((x) => x.id === st.id)).map((st) => ({ ...st, archived: true }))];

          const fresh = biz.startFresh
            ? { clients: [], appointments: [], payments: [], expenses: [], waitlist: [], giftCards: [], content: [], inventory: [], demoMode: false }
            : {};
          // Inventory usage links only make sense for services that still exist.
          const inventory = s.inventory.map((item) => ({ ...item, usagePerService: Object.fromEntries(Object.entries(item.usagePerService).filter(([sid]) => services.some((sv) => sv.id === sid))) }));
          set({ business, services, staff, inventory, ...fresh, showOnboarding: false, onboardingComplete: true, onboardingStep: 0, pricingServiceId: services[0]?.id ?? '', staffFilter: 'all' });
        },
        finishAndAddAppt: () => {
          get().finishSetup();
          if (get().clients.length === 0) get().openNewClient();
          else get().openNewAppt();
        },
        goAddFirstClient: () => {
          set({ showSettings: false });
          get().openNewClient();
        },

        askResetDemo: () =>
          get().askConfirm(
            'Replace everything with demo data?',
            get().demoMode
              ? 'This restores the original demo business, clients and appointments. A recovery copy of your current data is kept in Settings → Data.'
              : 'This REPLACES your real business data with the demo business. A recovery copy of your current data is kept in Settings → Data, but export a backup first to be safe.',
            () => get().resetDemo(),
            'Reset to Demo',
            'Cancel',
            true,
          ),
        resetDemo: async () => {
          await snapshot('Before resetting to demo data');
          set({ ...buildDomain(), ...initialUI() });
          get().toast('Demo data restored');
        },

        /* ---------------- clients ---------------- */

        openNewClient: () => set({ showNewClient: true, newClientDraft: defaultNewClientDraft(), showQuickAdd: false }),
        closeNewClient: () => {
          const d = get().newClientDraft;
          const dirty = d.name || d.phone || d.email || d.notes;
          if (dirty) {
            get().askConfirm('Discard unsaved changes?', "This client hasn't been saved yet. Discard your entries?", () => set({ showNewClient: false }), 'Discard', 'Keep Editing', true);
          } else {
            set({ showNewClient: false });
          }
        },
        updateNewClientField: (field, value) => set((s) => ({ newClientDraft: { ...s.newClientDraft, [field]: value } })),
        saveNewClient: (force) => {
          const d = get().newClientDraft;
          const name = d.name.trim();
          if (!name) {
            get().toast('Add a client name to continue');
            return;
          }
          const email = d.email.trim();
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            get().toast('That email address doesn’t look right');
            return;
          }
          if (!force) {
            const dup = get().clients.find((c) => samePhone(c.phone, d.phone) || (email && c.email.trim().toLowerCase() === email.toLowerCase()) || c.name.trim().toLowerCase() === name.toLowerCase());
            if (dup) {
              get().askConfirm(
                'This client may already exist',
                `${dup.name}${dup.archived ? ' (archived)' : ''} has the same ${samePhone(dup.phone, d.phone) ? 'phone number' : email && dup.email.trim().toLowerCase() === email.toLowerCase() ? 'email' : 'name'}. Add a new client anyway?`,
                () => get().saveNewClient(true),
                'Add Anyway',
                'Go Back',
              );
              return;
            }
          }
          const id = makeId('cl');
          const client: Client = {
            id,
            name,
            phone: d.phone.trim(),
            email,
            birthday: d.birthday,
            createdAt: todayISO(),
            lastVisit: null,
            nextVisit: null,
            lifetimeSpend: 0,
            visits: 0,
            vipTier: 'none',
            loyaltyPoints: 0,
            beautyProfile: { hairType: '', skinType: '', nailType: '', allergies: d.allergies.trim() || 'None known', formulas: '', productsUsed: '', patchTestDate: '', preferences: '', preferredStaffId: d.preferredStaffId },
            notes: d.notes.trim() ? [{ id: makeId('note'), date: todayISO(), text: d.notes.trim(), author: 'You' }] : [],
            photos: [],
            noShowCount: 0,
            cancellationCount: 0,
            status: 'active',
          };
          set((s) => ({ clients: [client, ...s.clients], showNewClient: false, justAddedClientId: id }));
          get().toast('Client added');
        },
        bookForJustAdded: () => {
          const id = get().justAddedClientId;
          set({ justAddedClientId: null });
          if (id) get().openNewAppt({ clientId: id });
        },
        openJustAddedProfile: () => {
          const id = get().justAddedClientId;
          set({ justAddedClientId: null });
          if (id) get().openClient(id);
        },
        dismissJustAdded: () => set({ justAddedClientId: null }),

        openClient: (id, tab) => set({ selectedClientId: id, clientTab: tab || 'Overview', section: 'clients', showSidebarMobile: false }),
        closeClientProfile: () => set({ selectedClientId: null }),
        setClientTab: (tab) => set({ clientTab: tab }),
        updateClientField: (clientId, field, value) => set((s) => ({ clients: s.clients.map((c) => (c.id === clientId ? { ...c, [field]: value } : c)) })),
        saveClientContact: (clientId, form, onSaved, force) => {
          const name = form.name.trim();
          const email = form.email.trim();
          if (!name) return get().toast('Name can’t be empty');
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return get().toast('That email address doesn’t look right');
          if (!force) {
            const dup = get().clients.find((c) => c.id !== clientId && (samePhone(c.phone, form.phone) || (email && c.email.trim().toLowerCase() === email.toLowerCase())));
            if (dup) {
              get().askConfirm(
                'Another client has these details',
                `${dup.name}${dup.archived ? ' (archived)' : ''} already uses this ${samePhone(dup.phone, form.phone) ? 'phone number' : 'email'}. Save anyway, or cancel and check whether they're the same person.`,
                () => get().saveClientContact(clientId, form, onSaved, true),
                'Save Anyway',
                'Cancel',
              );
              return;
            }
          }
          set((s) => ({ clients: s.clients.map((c) => (c.id === clientId ? { ...c, name, phone: form.phone.trim(), email, birthday: form.birthday } : c)) }));
          get().toast('Client details saved');
          onSaved();
        },
        addClientNote: (clientId, text) => {
          if (!text.trim()) {
            get().toast('Type a note first');
            return;
          }
          const note: ClientNote = { id: makeId('note'), date: todayISO(), text: text.trim(), author: 'You' };
          set((s) => ({ clients: s.clients.map((c) => (c.id === clientId ? { ...c, notes: [note, ...c.notes] } : c)) }));
          get().toast('Note added');
        },
        addClientPhoto: (clientId, label, kind) => {
          const palette = ['#caa26a', '#8a6a4a', '#b98a6b', '#7c5a45', '#c99a7c'];
          const photo: ClientPhoto = { id: makeId('ph'), date: todayISO(), label, kind, color: palette[Math.floor(Math.random() * palette.length)] };
          set((s) => ({ clients: s.clients.map((c) => (c.id === clientId ? { ...c, photos: [photo, ...c.photos] } : c)) }));
          get().toast('Photo added');
        },
        updateBeautyProfileField: (clientId, field, value) =>
          set((s) => ({ clients: s.clients.map((c) => (c.id === clientId ? { ...c, beautyProfile: { ...c.beautyProfile, [field]: value } } : c)) })),
        archiveClient: (id) => {
          const s = get();
          const client = s.clients.find((c) => c.id === id);
          if (!client) return;
          const upcoming = s.appointments.filter((a) => a.clientId === id && ['unconfirmed', 'confirmed', 'checked-in', 'in-service'].includes(a.status) && a.date >= todayISO());
          get().askConfirm(
            `Archive ${client.name}?`,
            `They'll be hidden from your client list and booking, but their visits and payments stay in your history and reports. You can restore them anytime.${upcoming.length ? ` Their ${upcoming.length} upcoming appointment${upcoming.length === 1 ? '' : 's'} will be cancelled.` : ''}`,
            () => {
              set((st) => ({
                clients: st.clients.map((c) => (c.id === id ? { ...c, archived: true } : c)),
                appointments: st.appointments.map((a) => (upcoming.some((u) => u.id === a.id) ? { ...a, status: 'cancelled' as AppointmentStatus, cancelReason: 'Client archived' } : a)),
                waitlist: st.waitlist.filter((w) => w.clientId !== id),
              }));
              get().toast(`${client.name} archived`);
            },
            'Archive Client',
            'Cancel',
            true,
          );
        },
        restoreClient: (id) => {
          set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, archived: false } : c)) }));
          get().toast('Client restored');
        },
        deleteClient: (id) => {
          const s = get();
          const client = s.clients.find((c) => c.id === id);
          if (!client) return;
          const hasHistory = s.appointments.some((a) => a.clientId === id) || s.payments.some((p) => p.clientId === id);
          if (hasHistory) {
            get().toast('This client has visit or payment history — archive them instead');
            return;
          }
          get().askConfirm(`Delete ${client.name} permanently?`, 'They have no appointments or payments, so nothing else is affected. This cannot be undone.', () => {
            set((st) => ({ clients: st.clients.filter((c) => c.id !== id), waitlist: st.waitlist.filter((w) => w.clientId !== id), selectedClientId: st.selectedClientId === id ? null : st.selectedClientId }));
            get().toast('Client deleted');
          }, 'Delete', 'Cancel', true);
        },
        setShowArchivedClients: (v) => set({ showArchivedClients: v }),

        /* ---------------- bookings ---------------- */

        setBookingsView: (v) => set({ bookingsView: v }),
        setStaffFilter: (id) => set({ staffFilter: id }),
        setBookingsDate: (date) => set({ bookingsDate: date }),
        shiftBookingsDate: (dir) =>
          set((s) => {
            const d = new Date(s.bookingsDate + 'T00:00:00');
            if (s.bookingsView === 'Month') {
              const target = new Date(d.getFullYear(), d.getMonth() + dir, 1);
              return { bookingsDate: toISODate(target) };
            }
            const step = s.bookingsView === 'Week' ? 7 : 1;
            return { bookingsDate: toISODate(addDays(d, dir * step)) };
          }),
        goToday: () => set({ bookingsDate: todayISO() }),

        openNewAppt: (prefill) =>
          set((s) => {
            const staff = activeStaff(s);
            const client = prefill?.clientId ? s.clients.find((c) => c.id === prefill.clientId) : undefined;
            const preferred = client?.beautyProfile.preferredStaffId;
            const staffId = prefill?.staffId && staff.some((st) => st.id === prefill.staffId) ? prefill.staffId : preferred && staff.some((st) => st.id === preferred) ? preferred : s.staffFilter !== 'all' && staff.some((st) => st.id === s.staffFilter) ? s.staffFilter : staff[0]?.id || '';
            const baseDate = s.bookingsDate && s.bookingsDate >= todayISO() ? s.bookingsDate : todayISO();
            return {
              showNewAppt: true,
              editingApptId: null,
              showQuickAdd: false,
              newApptDraft: { ...defaultNewApptDraft(), date: baseDate, ...prefill, staffId, serviceIds: (prefill?.serviceIds || []).filter((id) => s.services.some((sv) => sv.id === id && sv.active)) },
            };
          }),
        openReschedule: (apptId) =>
          set((s) => {
            const a = s.appointments.find((x) => x.id === apptId);
            if (!a) return {};
            return {
              showNewAppt: true,
              editingApptId: a.id,
              apptDetailId: null,
              newApptDraft: { ...defaultNewApptDraft(), clientId: a.clientId, serviceIds: a.serviceIds, staffId: a.staffId, date: a.date, time: a.time, discount: a.discount, deposit: a.deposit, notes: a.notes, recurring: 'none' },
            };
          }),
        closeNewAppt: () => set({ showNewAppt: false, editingApptId: null }),
        updateNewApptField: (field, value) =>
          set((s) => {
            let v = value;
            if ((field === 'discount' || field === 'deposit') && typeof value === 'number') v = round2(nonNeg(value)) as typeof value;
            return { newApptDraft: { ...s.newApptDraft, [field]: v } };
          }),
        toggleNewApptService: (serviceId) =>
          set((s) => {
            const has = s.newApptDraft.serviceIds.includes(serviceId);
            return { newApptDraft: { ...s.newApptDraft, serviceIds: has ? s.newApptDraft.serviceIds.filter((x) => x !== serviceId) : [...s.newApptDraft.serviceIds, serviceId] } };
          }),
        saveNewAppt: () => {
          const s = get();
          const d = s.newApptDraft;
          const ev = evaluateDraft(s);
          if (!canSaveDraft(ev, d.allowOutsideHours)) {
            get().toast(ev.blocking[0] || ev.hoursIssue || 'Check the appointment details');
            return;
          }

          if (ev.editing) {
            const prev = ev.editing;
            const moved = prev.date !== d.date || prev.time !== d.time || prev.staffId !== d.staffId;
            set((st) => ({
              appointments: st.appointments.map((a) => (a.id === prev.id ? { ...a, date: d.date, time: d.time, staffId: d.staffId, notes: d.notes } : a)),
              showNewAppt: false,
              editingApptId: null,
              bookingsDate: d.date,
            }));
            get().toast(moved ? 'Appointment rescheduled' : 'Appointment updated');
            return;
          }

          const base: Appointment = {
            id: makeId('ap'),
            clientId: d.clientId,
            staffId: d.staffId,
            serviceIds: d.serviceIds,
            date: d.date,
            time: d.time,
            durationMin: ev.duration,
            price: ev.price,
            discount: d.discount,
            deposit: d.deposit,
            depositPaid: d.deposit > 0,
            balancePaid: false,
            status: 'confirmed',
            notes: d.notes.trim(),
            recurring: d.recurring,
            createdAt: todayISO(),
            tip: 0,
            productsSold: [],
          };
          const created: Appointment[] = [base];
          let skipped = 0;
          if (d.recurring !== 'none') {
            const count = d.recurring === 'weekly' ? 11 : d.recurring === 'biweekly' ? 5 : 2;
            for (let i = 1; i <= count; i++) {
              const start = new Date(d.date + 'T00:00:00');
              const date = d.recurring === 'monthly' ? toISODate(new Date(start.getFullYear(), start.getMonth() + i, start.getDate())) : toISODate(addDays(start, i * (d.recurring === 'weekly' ? 7 : 14)));
              const check = checkBooking([...s.appointments, ...created], s.business, { staffId: d.staffId, date, time: d.time, durationMin: ev.duration });
              if (check.conflicts.length > 0 || (check.hoursIssue && !d.allowOutsideHours)) {
                skipped += 1;
                continue;
              }
              // Deposits are taken once, on the first visit of the series.
              created.push({ ...base, id: makeId('ap'), date, deposit: 0, depositPaid: false });
            }
          }
          const payments = [...s.payments];
          if (d.deposit > 0) {
            payments.push({ id: makeId('pay'), clientId: d.clientId, apptId: base.id, amount: d.deposit, method: d.depositMethod, type: 'deposit', date: todayISO() });
          }
          set({ appointments: [...s.appointments, ...created], payments, showNewAppt: false, bookingsDate: d.date });
          if (created.length > 1) get().toast(`Booked ${created.length} appointments${skipped ? ` · ${skipped} skipped (conflict or closed)` : ''}`);
          else if (d.recurring !== 'none' && skipped) get().toast(`Appointment booked · ${skipped} repeat${skipped === 1 ? '' : 's'} skipped (conflict or closed)`);
          else get().toast(d.deposit > 0 ? 'Appointment booked · deposit recorded' : 'Appointment booked');
        },

        openApptDetail: (id) => set({ apptDetailId: id, checkoutDraft: defaultCheckoutDraft(), showQuickAdd: false }),
        closeApptDetail: () => set({ apptDetailId: null }),
        apptAction: (id, action) => {
          const appt = get().appointments.find((a) => a.id === id);
          if (!appt) return;
          const open = ['unconfirmed', 'confirmed', 'checked-in', 'in-service'].includes(appt.status);
          if (!open) {
            get().toast('This appointment is already closed');
            return;
          }
          const future = appt.date > todayISO();
          if ((action === 'checkin' || action === 'start') && future) {
            get().toast('You can check in on the day of the appointment');
            return;
          }
          if (action === 'noshow' && future) {
            get().toast('A no-show can only be marked on or after the appointment day');
            return;
          }
          if (action === 'cancel' || action === 'noshow') {
            const status: AppointmentStatus = action === 'cancel' ? 'cancelled' : 'no-show';
            const held = apptPaid(get(), id);
            const close = (outcome?: DepositOutcome) => {
              const st = get();
              const cur = st.appointments.find((a) => a.id === id);
              if (!cur || !OPEN_STATUSES.includes(cur.status)) return; // closed meanwhile (double click)
              const linked = st.payments.filter((p) => p.apptId === id && !p.voided);
              let payments = st.payments;
              let giftCards = st.giftCards;
              if (outcome === 'refunded') {
                const ids = new Set(linked.map((p) => p.id));
                payments = payments.map((p) => (ids.has(p.id) ? { ...p, voided: true, voidedAt: todayISO(), note: [p.note, `Refunded — appointment ${action === 'cancel' ? 'cancelled' : 'no-show'}`].filter(Boolean).join(' · ') } : p));
                // Money paid from a gift card goes back onto that card.
                giftCards = restoreCards(giftCards, linked);
              } else if (outcome === 'credit') {
                // Anything paid from a gift card goes straight back onto that card; only new money becomes store credit.
                const fromCards = linked.filter((p) => p.method === 'Gift card');
                if (fromCards.length) {
                  const ids = new Set(fromCards.map((p) => p.id));
                  payments = payments.map((p) => (ids.has(p.id) ? { ...p, voided: true, voidedAt: todayISO(), note: [p.note, 'Returned to card — appointment cancelled'].filter(Boolean).join(' · ') } : p));
                  giftCards = restoreCards(giftCards, fromCards);
                }
                const creditAmt = round2(linked.filter((p) => p.method !== 'Gift card').reduce((n, p) => n + p.amount - (p.tip || 0), 0));
                if (creditAmt > 0) {
                  giftCards = [{ id: makeId('gc'), code: newCardCode(giftCards, 'CR'), initialValue: creditAmt, balance: creditAmt, purchasedBy: clientName(st, cur.clientId), issuedDate: todayISO(), kind: 'credit', clientId: cur.clientId, sourceApptId: id }, ...giftCards];
                }
              }
              set((x) => ({
                payments,
                giftCards,
                appointments: x.appointments.map((a) => (a.id === id ? { ...a, status, ...(outcome ? { depositOutcome: outcome, depositPaid: outcome !== 'refunded' } : {}) } : a)),
                clients: x.clients.map((c) => (c.id === cur.clientId ? (action === 'cancel' ? { ...c, cancellationCount: c.cancellationCount + 1 } : { ...c, noShowCount: c.noShowCount + 1 }) : c)),
                apptDetailId: null,
                ...(action === 'cancel' ? { cancellationRescueApptId: id } : {}),
              }));
              const money = `${st.business.currencySymbol}${held.toFixed(2)}`;
              const what = action === 'cancel' ? 'Appointment cancelled' : 'Marked as no-show';
              const newCredit = giftCards.find((g) => g.sourceApptId === id && g.kind === 'credit' && !st.giftCards.includes(g));
              get().toast(
                !outcome
                  ? what
                  : outcome === 'kept'
                    ? `${what} · ${money} deposit kept as a fee`
                    : outcome === 'refunded'
                      ? `${what} · ${money} deposit refunded (voided)`
                      : newCredit
                        ? `${what} · ${st.business.currencySymbol}${newCredit.initialValue.toFixed(2)} added to store credit`
                        : `${what} · deposit returned to the gift card it was paid from`,
              );
            };
            if (held <= 0) {
              if (action === 'cancel') get().askConfirm('Cancel this appointment?', 'The client will need to be notified separately. This frees up the time slot.', () => close(), 'Cancel Appointment', 'Keep Appointment', true);
              else get().askConfirm('Mark as no-show?', 'This closes the appointment and adds a no-show to the client’s record.', () => close(), 'Mark No-Show', 'Cancel', true);
              return;
            }
            // A deposit was paid: the owner decides, once, what happens to that money.
            const cur = get().business.currencySymbol;
            const hoursAway = (new Date(`${appt.date}T${appt.time}:00`).getTime() - Date.now()) / 3600000;
            const late = action === 'noshow' || hoursAway < get().business.cancellationWindowHrs;
            get().askChoice(
              action === 'cancel' ? 'Cancel this appointment?' : 'Mark as no-show?',
              `${clientName(get(), appt.clientId).split(' ')[0]} paid a ${cur}${held.toFixed(2)} deposit. What should happen to it?${action === 'cancel' && late ? ` This is inside your ${get().business.cancellationWindowHrs}h cancellation window.` : ''}`,
              [
                { value: 'kept', label: 'Keep it as a cancellation fee', hint: 'Stays in your revenue.' },
                { value: 'credit', label: 'Move it to store credit', hint: 'The client can use it at a future checkout.' },
                { value: 'refunded', label: 'Refund it', hint: 'Voids the deposit payment — give the money back yourself.' },
              ],
              late ? 'kept' : 'credit',
              (choice) => close(choice as DepositOutcome),
              action === 'cancel' ? 'Cancel Appointment' : 'Mark No-Show',
              true,
            );
            return;
          }
          const map = { confirm: 'confirmed', checkin: 'checked-in', start: 'in-service' } as const;
          set((s) => ({ appointments: s.appointments.map((a) => (a.id === id ? { ...a, status: map[action] } : a)) }));
          get().toast(action === 'confirm' ? 'Appointment confirmed' : action === 'checkin' ? 'Client checked in' : 'Service started');
        },
        updateCheckoutTip: (v) => set((s) => ({ checkoutDraft: { ...s.checkoutDraft, tip: round2(nonNeg(v)) } })),
        setCheckoutPayMethod: (v) => set((s) => ({ checkoutDraft: { ...s.checkoutDraft, payMethod: v } })),
        setCheckoutGiftCard: (id) => set((s) => ({ checkoutDraft: { ...s.checkoutDraft, giftCardId: id } })),
        setCheckoutProductQty: (itemId, qty) => {
          const item = get().inventory.find((i) => i.id === itemId);
          if (!item) return;
          const capped = Math.max(0, Math.min(Math.floor(qty), Math.floor(item.qty)));
          if (qty > capped && qty > 0) get().toast(`Only ${Math.floor(item.qty)} ${item.name} in stock`);
          set((s) => ({ checkoutDraft: { ...s.checkoutDraft, productSelections: { ...s.checkoutDraft.productSelections, [itemId]: capped } } }));
        },
        completeCheckout: () => {
          const s = get();
          const appt = s.appointments.find((a) => a.id === s.apptDetailId);
          if (!appt) return;
          // Guard against double-submits and stale modals: only open appointments can be checked out, once.
          if (!['confirmed', 'checked-in', 'in-service'].includes(appt.status)) {
            get().toast('This appointment has already been checked out');
            return;
          }
          if (appt.date > todayISO()) {
            get().toast('Checkout is available on the day of the appointment');
            return;
          }

          const productLines = Object.entries(s.checkoutDraft.productSelections)
            .filter(([, qty]) => qty > 0)
            .map(([itemId, qty]) => {
              const item = s.inventory.find((i) => i.id === itemId);
              return item ? { itemId, qty: Math.min(qty, Math.floor(item.qty)), price: item.retailPrice, name: item.name } : null;
            })
            .filter((l): l is NonNullable<typeof l> => Boolean(l && l.qty > 0));

          const usage = inventoryUsage(s.inventory, appt.serviceIds);
          const shortages: string[] = [];
          const inventory = s.inventory.map((item) => {
            let qty = item.qty;
            if (usage[item.id]) qty -= usage[item.id];
            const sold = productLines.find((l) => l.itemId === item.id);
            if (sold) qty -= sold.qty;
            if (qty < 0) shortages.push(item.name);
            return qty === item.qty ? item : { ...item, qty: Math.max(0, round2(qty)) };
          });

          const completedAppt: Appointment = { ...appt, status: 'completed', tip: s.checkoutDraft.tip, productsSold: productLines };
          const bill = apptBill(completedAppt);
          const alreadyPaid = apptPaid(s, appt.id);
          const due = round2(Math.max(0, bill - alreadyPaid));
          const tip = s.checkoutDraft.tip;
          const payType = alreadyPaid > 0 ? 'balance' : 'full';
          const createdAt = new Date().toISOString();
          const payments = [...s.payments];
          let giftCards = s.giftCards;

          // Gift card / store credit is applied first (never more than its balance or the bill); the rest + tip is charged normally.
          let fromCard = 0;
          if (s.checkoutDraft.giftCardId) {
            const card = s.giftCards.find((c) => c.id === s.checkoutDraft.giftCardId);
            if (!isUsableCard(card)) {
              get().toast('That gift card has no balance left — choose another way to pay');
              return;
            }
            fromCard = round2(Math.min(card.balance, due));
            if (fromCard > 0) {
              payments.push({ id: makeId('pay'), clientId: appt.clientId, apptId: appt.id, amount: fromCard, method: 'Gift card', type: payType, date: todayISO(), createdAt, giftCardId: card.id, note: `${card.kind === 'credit' ? 'Store credit' : 'Gift card'} ${card.code}` });
              giftCards = giftCards.map((c) => (c.id === card.id ? { ...c, balance: round2(c.balance - fromCard) } : c));
            }
          }
          const chargeNow = round2(due - fromCard + tip);
          if (chargeNow > 0) {
            payments.push({ id: makeId('pay'), clientId: appt.clientId, apptId: appt.id, amount: chargeNow, method: s.checkoutDraft.payMethod, type: payType, date: todayISO(), createdAt, ...(tip > 0 ? { tip } : {}) });
          }

          // Paid more up front than the final bill (e.g. services changed after the deposit): the difference becomes store credit, never lost.
          const overpaid = round2(alreadyPaid - bill);
          if (overpaid > 0.004) {
            giftCards = [{ id: makeId('gc'), code: newCardCode(giftCards, 'CR'), initialValue: overpaid, balance: overpaid, purchasedBy: clientName(s, appt.clientId), issuedDate: todayISO(), kind: 'credit', clientId: appt.clientId, sourceApptId: appt.id }, ...giftCards];
          }

          const earned = pointsForSpend(bill);
          const clients = s.clients.map((c) => {
            if (c.id !== appt.clientId) return c;
            const next = withPoints(c, earned, `Visit ${appt.date} · ${s.business.currencySymbol}${bill.toFixed(2)} spent`, appt.id);
            // Redeeming points never demotes a client: the tier only moves up.
            const tier = tierForPoints(next.loyaltyPoints);
            const rank = ['none', 'silver', 'gold', 'platinum'];
            return {
              ...next,
              lifetimeSpend: round2(c.lifetimeSpend + bill),
              visits: c.visits + 1,
              lastVisit: !c.lastVisit || appt.date > c.lastVisit ? appt.date : c.lastVisit,
              vipTier: rank.indexOf(tier) > rank.indexOf(c.vipTier) ? tier : c.vipTier,
            };
          });

          const appointments = syncApptFlags(
            s.appointments.map((a) => (a.id === appt.id ? completedAppt : a)),
            payments,
            [appt.id],
          );

          set({ appointments, inventory, payments, giftCards, clients, apptDetailId: null, justCompletedApptId: appt.id, checkoutDraft: defaultCheckoutDraft() });
          const notes = [shortages.length ? `check stock: ${shortages.slice(0, 2).join(', ')}` : '', overpaid > 0.004 ? `${s.business.currencySymbol}${overpaid.toFixed(2)} overpaid → store credit` : ''].filter(Boolean);
          get().toast(`Checkout complete${notes.length ? ` · ${notes.join(' · ')}` : ''}`);
        },
        closeCompleteScreen: () => set({ justCompletedApptId: null }),
        rebookClient: (clientId, apptId) => {
          const s = get();
          const upcoming = getNextApptForClient(s, clientId);
          const prevAppt = apptId ? s.appointments.find((a) => a.id === apptId) : lastCompletedAppt(s, clientId);
          const from = prevAppt && prevAppt.date > todayISO() ? prevAppt.date : todayISO();
          const weeks = prevAppt ? rebookWeeksFor(s, prevAppt.serviceIds) : s.business.rebookWeeks;
          const target = nextOpenDay(s.business, toISODate(addDays(from, weeks * 7)));
          set({ justCompletedApptId: null, section: 'bookings', selectedClientId: null });
          get().openNewAppt({
            clientId,
            serviceIds: prevAppt ? prevAppt.serviceIds : [],
            staffId: prevAppt ? prevAppt.staffId : undefined,
            date: target,
            time: prevAppt ? prevAppt.time : '10:00',
          });
          if (upcoming) get().toast(`Heads up: already booked for ${upcoming.date}`);
        },
        rebookFromModal: () => {
          const id = get().justCompletedApptId;
          const appt = get().appointments.find((a) => a.id === id);
          if (appt) get().rebookClient(appt.clientId, appt.id);
        },

        copyWaitlistMessage: (waitlistId) => {
          const s = get();
          const w = s.waitlist.find((x) => x.id === waitlistId);
          if (!w) return;
          const client = s.clients.find((c) => c.id === w.clientId);
          const svcNames = s.services.filter((sv) => w.serviceIds.includes(sv.id)).map((sv) => sv.name).join(' + ');
          const msg = `Hi ${client?.name.split(' ')[0] || 'there'}! A spot just opened up for ${svcNames || 'your requested service'} at ${s.business.name}. Reply to grab it — first come, first served. 💛`;
          get().showCopyMessage('Copy Message', msg);
        },
        addToWaitlist: (clientId, serviceIds, note) => {
          if (get().waitlist.some((w) => w.clientId === clientId)) {
            get().toast('Already on the waitlist');
            return;
          }
          set((s) => ({ waitlist: [...s.waitlist, { id: makeId('wl'), clientId, serviceIds, note, createdAt: todayISO() }] }));
          get().toast('Added to waitlist');
        },
        removeFromWaitlist: (id) => {
          set((s) => ({ waitlist: s.waitlist.filter((w) => w.id !== id) }));
          get().toast('Removed from waitlist');
        },
        showCopyMessage: (title, message) => set({ copyMessage: { title, message } }),
        closeCopyMessage: () => set({ copyMessage: null }),

        /* ---------------- services & pricing ---------------- */

        setMoneyTab: (t) => set({ moneyTab: t }),
        addService: () => {
          const id = makeId('svc');
          set((s) => ({
            services: [...s.services, { id, name: 'New Service', category: 'General', duration: 30, price: 0, materials: 0, laborHours: 0.5, hourlyRate: 40, overhead: 0, active: true, targetMargin: 0.35 }],
          }));
          get().toast('Service added — set its name and price');
        },
        updateServiceField: (id, field, value) =>
          set((s) => ({
            services: s.services.map((sv) => {
              if (sv.id !== id) return sv;
              if (field === 'rebookWeeks') {
                const w = Math.round(nonNeg(Number(value)));
                const rest = { ...sv };
                delete rest.rebookWeeks;
                return w >= 1 ? { ...rest, rebookWeeks: Math.min(52, w) } : rest;
              }
              let v = value;
              if (typeof value === 'number') v = field === 'duration' ? Math.max(5, Math.round(nonNeg(value))) : field === 'targetMargin' ? Math.min(0.95, nonNeg(value)) : nonNeg(value);
              return { ...sv, [field]: v };
            }),
          })),
        moveService: (id, dir) =>
          set((s) => {
            const idx = s.services.findIndex((sv) => sv.id === id);
            const swapIdx = idx + dir;
            if (idx < 0 || swapIdx < 0 || swapIdx >= s.services.length) return {};
            const arr = [...s.services];
            [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
            return { services: arr };
          }),
        duplicateService: (id) => {
          const sv = get().services.find((x) => x.id === id);
          if (!sv) return;
          set((s) => {
            const copy = { ...sv, id: makeId('svc'), name: `${sv.name} (copy)` };
            const idx = s.services.findIndex((x) => x.id === id);
            const arr = [...s.services];
            arr.splice(idx + 1, 0, copy);
            return { services: arr };
          });
          get().toast('Service duplicated');
        },
        archiveToggleService: (id) => {
          const sv = get().services.find((x) => x.id === id);
          if (!sv) return;
          if (sv.active && get().services.filter((x) => x.active).length === 1) {
            get().toast('Keep at least one active service');
            return;
          }
          set((s) => ({ services: s.services.map((x) => (x.id === id ? { ...x, active: !x.active } : x)) }));
          get().toast(sv.active ? `${sv.name} archived — past appointments keep it` : `${sv.name} restored`);
        },
        setPricingServiceId: (id) => set({ pricingServiceId: id }),
        applySuggestedPrice: (id) => {
          const sv = get().services.find((x) => x.id === id);
          if (!sv) return;
          const cost = sv.materials + sv.laborHours * sv.hourlyRate + sv.overhead;
          const suggested = round2(cost / (1 - Math.min(0.95, sv.targetMargin)));
          set((s) => ({ services: s.services.map((x) => (x.id === id ? { ...x, price: suggested } : x)) }));
          get().toast(`Price updated to ${get().business.currencySymbol}${suggested.toFixed(2)} — existing bookings keep their price`);
        },

        /* ---------------- expenses & inventory ---------------- */

        addExpense: (e) => {
          if (!e.name.trim() || !(e.amount > 0)) {
            get().toast('Add an expense name and an amount above zero');
            return false;
          }
          set((s) => ({ expenses: [{ ...e, name: e.name.trim(), amount: round2(e.amount), id: makeId('ex') }, ...s.expenses] }));
          get().toast('Expense added');
          return true;
        },
        deleteExpense: (id) => {
          const e = get().expenses.find((x) => x.id === id);
          if (!e) return;
          get().askConfirm('Delete this expense?', `${e.name} (${get().business.currencySymbol}${e.amount.toFixed(2)}) will be removed from your reports.`, () => {
            set((s) => ({ expenses: s.expenses.filter((x) => x.id !== id) }));
            get().toast('Expense deleted');
          }, 'Delete', 'Cancel', true);
        },

        addInventoryItem: (item) => {
          set((s) => ({ inventory: [...s.inventory, { ...item, id: makeId('inv') }] }));
          get().toast('Item added — set its name and stock');
        },
        updateInventoryField: (id, field, value) =>
          set((s) => ({ inventory: s.inventory.map((i) => (i.id === id ? { ...i, [field]: typeof value === 'number' ? round2(nonNeg(value)) : value } : i)) })),
        setInventoryUsage: (itemId, serviceId, amount) =>
          set((s) => ({
            inventory: s.inventory.map((i) => {
              if (i.id !== itemId) return i;
              const usage = { ...i.usagePerService };
              const n = round2(nonNeg(amount));
              if (n > 0) usage[serviceId] = n;
              else delete usage[serviceId];
              return { ...i, usagePerService: usage };
            }),
          })),
        deleteInventoryItem: (id) => {
          const item = get().inventory.find((i) => i.id === id);
          if (!item) return;
          get().askConfirm(`Remove ${item.name}?`, 'It will no longer be tracked or deducted at checkout. Past sales keep their product name and price.', () => {
            set((s) => ({ inventory: s.inventory.filter((i) => i.id !== id) }));
            get().toast('Item removed');
          }, 'Remove', 'Cancel', true);
        },
        restockInventory: (id, amount) => {
          if (!(amount > 0)) {
            get().toast('Enter how many you received');
            return;
          }
          set((s) => ({ inventory: s.inventory.map((i) => (i.id === id ? { ...i, qty: round2(i.qty + amount) } : i)) }));
          get().toast('Stock updated');
        },

        /* ---------------- payments ---------------- */

        recordPayment: (p) => {
          set((s) => ({ payments: [{ ...p, amount: round2(p.amount), id: makeId('pay'), date: todayISO(), createdAt: new Date().toISOString() }, ...s.payments] }));
          get().toast('Payment recorded');
        },
        voidPayment: (id) => {
          const s = get();
          const p = s.payments.find((x) => x.id === id);
          if (!p || p.voided) return;
          const cur = s.business.currencySymbol;
          // A gift card sale is undone by voiding the card itself (only while nothing has been spent from it).
          if (p.type === 'gift-card' && p.giftCardId) {
            get().voidGiftCard(p.giftCardId);
            return;
          }
          const appt = p.apptId ? s.appointments.find((a) => a.id === p.apptId) : undefined;
          if (appt?.depositOutcome === 'credit') {
            const credit = s.giftCards.find((c) => c.sourceApptId === appt.id && c.kind === 'credit' && !c.voided);
            if (credit) {
              get().toast(`This deposit became store credit ${credit.code}. Refund it from Money → Payments → Gift Cards & Credit.`);
              return;
            }
          }
          const fromCard = p.method === 'Gift card';
          const detail = fromCard
            ? `${cur}${p.amount.toFixed(2)} goes back onto the gift card / credit it was paid from.`
            : `${cur}${p.amount.toFixed(2)} will be removed from revenue.`;
          get().askConfirm('Void this payment?', `${detail} It stays visible (struck through) for your records.${p.apptId ? ' If it paid for a visit, that amount becomes owed again.' : ''}`, () => {
            const now = get().payments.find((x) => x.id === id);
            if (!now || now.voided) return;
            set((x) => {
              const payments = x.payments.map((y) => (y.id === id ? { ...y, voided: true, voidedAt: todayISO() } : y));
              return {
                payments,
                giftCards: restoreCards(x.giftCards, [now]),
                appointments: syncApptFlags(x.appointments, payments, [now.apptId]),
              };
            });
            get().toast(fromCard ? 'Payment voided · balance returned to the card' : 'Payment voided');
          }, 'Void Payment', 'Cancel', true);
        },
        voidGiftCard: (cardId) => {
          const s = get();
          const card = s.giftCards.find((c) => c.id === cardId);
          if (!card || card.voided) return;
          const cur = s.business.currencySymbol;
          if (!isUntouchedCard(card)) {
            get().toast(`${card.code} has already been used (${cur}${(card.initialValue - card.balance).toFixed(2)} spent), so it can't be voided. Void the payments made with it first.`);
            return;
          }
          const sale = s.payments.filter((p) => !p.voided && p.type === 'gift-card' && p.giftCardId === cardId);
          const deposits = card.kind === 'credit' && card.sourceApptId ? s.payments.filter((p) => !p.voided && p.apptId === card.sourceApptId && p.method !== 'Gift card') : [];
          const isDepositCredit = deposits.length > 0;
          const title = card.kind === 'credit' ? 'Refund this store credit?' : 'Void this gift card?';
          const msg = card.kind === 'credit'
            ? `${cur}${card.balance.toFixed(2)} of store credit (${card.code}) will be removed${isDepositCredit ? ' and the deposit it came from marked as refunded' : ''}. Give the money back to the client yourself.`
            : `${card.code} (${cur}${card.initialValue.toFixed(2)}) will be cancelled${sale.length ? ' and its sale removed from revenue' : ''}. Give the money back to the buyer yourself.`;
          get().askConfirm(title, msg, () => {
            const voidIds = new Set([...sale, ...(isDepositCredit ? deposits : [])].map((p) => p.id));
            set((x) => {
              const payments = x.payments.map((p) => (voidIds.has(p.id) ? { ...p, voided: true, voidedAt: todayISO(), note: [p.note, card.kind === 'credit' ? 'Refunded (store credit)' : 'Gift card voided'].filter(Boolean).join(' · ') } : p));
              const voidedNow = x.payments.filter((p) => voidIds.has(p.id));
              return {
                payments,
                giftCards: restoreCards(x.giftCards, voidedNow).map((c) => (c.id === cardId ? { ...c, voided: true, balance: 0 } : c)),
                appointments: isDepositCredit
                  ? x.appointments.map((a) => (a.id === card.sourceApptId ? { ...a, depositOutcome: 'refunded' as DepositOutcome, depositPaid: false } : a))
                  : x.appointments,
              };
            });
            get().toast(card.kind === 'credit' ? 'Store credit refunded' : 'Gift card voided');
          }, card.kind === 'credit' ? 'Refund Credit' : 'Void Gift Card', 'Cancel', true);
        },
        openRecordPayment: (clientId, apptId, type) => {
          const appt = apptId ? get().appointments.find((a) => a.id === apptId) : undefined;
          const amount = appt ? apptPaymentCap(get(), appt) : 0;
          set({
            showRecordPayment: true,
            showQuickAdd: false,
            recordPaymentDraft: { ...defaultRecordPaymentDraft(), clientId: clientId || '', apptId: appt ? appt.id : '', amount, type: type || (appt ? (appt.status === 'completed' ? 'balance' : 'deposit') : 'full') },
          });
        },
        closeRecordPayment: () => set({ showRecordPayment: false }),
        updateRecordPaymentField: (field, value) =>
          set((s) => {
            const next = { ...s.recordPaymentDraft, [field]: typeof value === 'number' ? round2(nonNeg(value)) : value };
            if (field === 'clientId') {
              next.apptId = '';
              next.giftCardId = '';
            }
            if (field === 'apptId') {
              const a = s.appointments.find((x) => x.id === value);
              if (a) {
                next.amount = apptPaymentCap(s, a);
                next.type = a.status === 'completed' ? 'balance' : 'deposit';
              } else if (next.type === 'balance' || next.type === 'deposit') next.type = 'full';
            }
            if (field === 'type' && value === 'gift-card') {
              next.apptId = '';
              if (next.method === 'Gift card') next.method = 'Card';
            }
            if (field === 'method' && value !== 'Gift card') next.giftCardId = '';
            return { recordPaymentDraft: next };
          }),
        saveRecordPayment: (force) => {
          const s = get();
          const d = s.recordPaymentDraft;
          const cur = s.business.currencySymbol;
          const amount = round2(d.amount);
          if (!d.clientId || !(amount > 0)) {
            get().toast('Choose a client and an amount above zero');
            return;
          }
          const appt = d.apptId ? s.appointments.find((a) => a.id === d.apptId && a.clientId === d.clientId) : undefined;
          if (d.apptId && !appt) {
            get().toast('That visit is no longer available — choose it again');
            return;
          }
          if ((d.type === 'balance' || d.type === 'deposit') && !appt) {
            get().toast(d.type === 'balance' ? 'Choose which unpaid visit this payment is for' : 'Choose which booking this deposit is for');
            return;
          }
          if (appt) {
            const cap = apptPaymentCap(s, appt);
            if (cap <= 0) {
              get().toast('Nothing is owed on that visit');
              return;
            }
            if (amount > cap + 0.005) {
              get().toast(`That's more than the ${cur}${cap.toFixed(2)} owed for this visit. Record ${cur}${cap.toFixed(2)}, or add extra as a tip at checkout.`);
              return;
            }
          }
          let card: GiftCard | undefined;
          if (d.method === 'Gift card') {
            if (d.type === 'gift-card') {
              get().toast('A gift card can’t be bought with another gift card');
              return;
            }
            card = s.giftCards.find((c) => c.id === d.giftCardId);
            if (!isUsableCard(card)) {
              get().toast('Choose a gift card or credit with a balance');
              return;
            }
            if (amount > card.balance + 0.005) {
              get().toast(`${card.code} only has ${cur}${card.balance.toFixed(2)} left`);
              return;
            }
          }
          const type = d.type;
          const candidate = { clientId: d.clientId, apptId: appt ? appt.id : null, amount, type, method: d.method };
          const dup = !force && findDuplicatePayment(s.payments, candidate);
          if (dup) {
            get().askConfirm(
              'This looks like a duplicate',
              `A ${cur}${amount.toFixed(2)} ${d.method.toLowerCase()} payment from ${clientName(s, d.clientId)} was already recorded today${appt ? ' for this visit' : ''}. Record it again?`,
              () => get().saveRecordPayment(true),
              'Record Again',
              'Don’t Record',
            );
            return;
          }

          const createdAt = new Date().toISOString();
          const payId = makeId('pay');
          let giftCards = s.giftCards;
          let soldCode = '';
          let giftCardId: string | undefined;
          if (type === 'gift-card') {
            const newCard: GiftCard = { id: makeId('gc'), code: newCardCode(s.giftCards), initialValue: amount, balance: amount, purchasedBy: clientName(s, d.clientId), issuedDate: todayISO(), kind: 'gift', clientId: d.clientId };
            giftCards = [newCard, ...giftCards];
            soldCode = newCard.code;
            giftCardId = newCard.id;
          } else if (card) {
            giftCardId = card.id;
            giftCards = giftCards.map((c) => (c.id === card.id ? { ...c, balance: round2(c.balance - amount) } : c));
          }
          const note = [d.note.trim(), soldCode ? `Gift card ${soldCode}` : card ? `${card.kind === 'credit' ? 'Store credit' : 'Gift card'} ${card.code}` : ''].filter(Boolean).join(' · ');
          const payment: Payment = { id: payId, clientId: d.clientId, apptId: appt ? appt.id : null, amount, method: d.method, type, date: todayISO(), createdAt, ...(note ? { note } : {}), ...(giftCardId ? { giftCardId } : {}) };
          set((x) => {
            const payments = [payment, ...x.payments];
            return { payments, giftCards, appointments: syncApptFlags(x.appointments, payments, [payment.apptId]), showRecordPayment: false };
          });
          if (soldCode) get().toast(`Gift card ${soldCode} sold · ${cur}${amount.toFixed(2)}`);
          else if (appt) {
            const left = apptPaymentCap(get(), get().appointments.find((a) => a.id === appt.id) || appt);
            get().toast(left > 0 ? `Payment recorded · ${cur}${left.toFixed(2)} still owed` : appt.status === 'completed' ? 'Payment recorded · visit paid in full' : 'Payment recorded');
          } else get().toast('Payment recorded');
        },

        /* ---------------- grow ---------------- */

        setGrowTab: (t) => set({ growTab: t }),
        redeemReward: (clientId, rewardId) => {
          const s = get();
          const reward = s.loyaltyRewards.find((r) => r.id === rewardId);
          const client = s.clients.find((c) => c.id === clientId);
          if (!reward || !client) return;
          if (client.loyaltyPoints < reward.pointsCost) {
            get().toast(`${client.name.split(' ')[0]} needs ${reward.pointsCost - client.loyaltyPoints} more points`);
            return;
          }
          set((st) => ({
            clients: st.clients.map((c) =>
              c.id === clientId ? { ...withPoints(c, -reward.pointsCost, `Redeemed: ${reward.label}`), notes: [{ id: makeId('note'), date: todayISO(), text: `Redeemed reward: ${reward.label} (−${reward.pointsCost} pts)`, author: 'Lumora' }, ...c.notes] } : c,
            ),
          }));
          get().toast(`Redeemed: ${reward.label}`);
        },
        addContentItem: (c) => {
          set((s) => ({ content: [{ ...c, id: makeId('ct'), stage: 'idea', date: null }, ...s.content] }));
          get().toast('Idea added');
        },
        moveContentStage: (id, stage) => set((s) => ({ content: s.content.map((c) => (c.id === id ? { ...c, stage } : c)) })),
        deleteContentItem: (id) => {
          set((s) => ({ content: s.content.filter((c) => c.id !== id) }));
          get().toast('Idea removed');
        },

        /* ---------------- settings ---------------- */

        updateBusinessField: (field, value) =>
          set((s) => {
            let v = value;
            if (typeof value === 'number') {
              if (field === 'rebookWeeks') v = Math.max(1, Math.min(52, Math.round(value) || 1)) as typeof value;
              else if (field === 'depositPct') v = Math.min(100, nonNeg(value)) as typeof value;
              else v = Math.min(field === 'bufferMin' ? 240 : 720, nonNeg(value)) as typeof value;
            }
            return { business: { ...s.business, [field]: v } };
          }),
        toggleOpenDay: (day) =>
          set((s) => {
            const openDays = s.business.openDays.includes(day) ? s.business.openDays.filter((d) => d !== day) : [...s.business.openDays, day].sort();
            return { business: { ...s.business, openDays, hours: formatHoursLabel(openDays, s.business.openTime, s.business.closeTime) } };
          }),
        setBusinessHours: (openTime, closeTime) => {
          if (!/^\d{2}:\d{2}$/.test(openTime) || !/^\d{2}:\d{2}$/.test(closeTime)) return;
          if (closeTime <= openTime) {
            get().toast('Closing time must be after opening time');
            return;
          }
          set((s) => ({ business: { ...s.business, openTime, closeTime, hours: formatHoursLabel(s.business.openDays, openTime, closeTime) } }));
        },
        addStaff: (name, role) => {
          set((s) => ({ staff: [...s.staff, { id: makeId('st'), name, role, color: STAFF_COLORS[s.staff.length % 4], initials: initialsOf(name) }], business: { ...s.business, teamType: 'team' } }));
          get().toast('Team member added');
        },
        updateStaff: (id, field, value) => set((s) => ({ staff: s.staff.map((st) => (st.id === id ? { ...st, [field]: value, ...(field === 'name' ? { initials: initialsOf(value) } : {}) } : st)) })),
        removeStaff: (id) => {
          const s = get();
          const member = s.staff.find((st) => st.id === id);
          if (!member) return;
          if (activeStaff(s).length <= 1) {
            get().toast('You need at least one active team member');
            return;
          }
          const upcoming = s.appointments.filter((a) => a.staffId === id && ['unconfirmed', 'confirmed', 'checked-in', 'in-service'].includes(a.status) && a.date >= todayISO());
          if (upcoming.length > 0) {
            get().toast(`${member.name} has ${upcoming.length} upcoming appointment${upcoming.length === 1 ? '' : 's'} — reschedule them first`);
            return;
          }
          get().askConfirm(`Remove ${member.name} from the team?`, 'They’ll be hidden from booking. Their past appointments and reports stay intact, and you can restore them anytime.', () => {
            set((st) => ({ staff: st.staff.map((x) => (x.id === id ? { ...x, archived: true } : x)), staffFilter: st.staffFilter === id ? 'all' : st.staffFilter }));
            get().toast(`${member.name} removed from the team`);
          }, 'Remove', 'Cancel', true);
        },
        restoreStaff: (id) => {
          set((s) => ({ staff: s.staff.map((x) => (x.id === id ? { ...x, archived: false } : x)) }));
          get().toast('Team member restored');
        },
        clearAllData: () =>
          get().askConfirm(
            'Clear all client & booking data?',
            'This removes every client, appointment, payment and expense so you can start fresh with your real business. Your business settings, services, team and inventory items stay. A recovery copy is kept in Settings → Data.',
            async () => {
              await snapshot('Before clearing client & booking data');
              set({ clients: [], appointments: [], payments: [], expenses: [], waitlist: [], giftCards: [], content: [], demoMode: false, selectedClientId: null });
              get().toast('Workspace cleared — ready for your real clients');
            },
            'Clear Data',
            'Cancel',
            true,
          ),

        /* ---------------- backup & restore ---------------- */

        exportBackup: () => {
          const now = new Date();
          const domain = pickDomain(get());
          try {
            const blob = new Blob([JSON.stringify(buildBackup({ ...domain, lastBackupAt: now.toISOString() }, now.toISOString()), null, 1)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = backupFileName(domain.business.name, now.toISOString());
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            set({ lastBackupAt: now.toISOString() });
            get().toast('Backup downloaded — keep it somewhere safe (email, cloud drive, USB)');
          } catch {
            get().toast('The backup could not be created in this browser');
          }
        },
        beginImport: (fileName, text) => {
          const result = parseBackup(text);
          if (!result.ok) {
            get().askConfirm('Backup not imported', result.error, () => {}, 'OK', 'Close');
            return;
          }
          set({ pendingImport: { fileName, domain: result.domain, summary: result.summary } });
        },
        cancelImport: () => set({ pendingImport: null }),
        confirmImport: async () => {
          const pending = get().pendingImport;
          if (!pending) return;
          const saved = await snapshot('Before importing a backup');
          if (!saved) {
            set({ pendingImport: null });
            get().toast('Could not save a recovery copy (storage full) — export a backup first, then import');
            return;
          }
          applyDomain({ ...pending.domain, lastBackupAt: pending.summary.exportedAt ?? get().lastBackupAt });
          await flushStorage();
          get().toast(`Backup restored — ${pending.summary.counts.clients} clients, ${pending.summary.counts.appointments} appointments`);
        },
        restoreRecovery: async () => {
          const snap = await readRecoverySnapshot();
          if (!snap) {
            get().toast('No recovery copy found');
            return;
          }
          const { domain, dropped } = repairDomain(snap.data);
          get().askConfirm('Restore the recovery copy?', `This replaces your current data with the copy saved ${new Date(snap.createdAt).toLocaleString()} (${snap.reason.toLowerCase()}): ${domain.clients.length} clients, ${domain.appointments.length} appointments. Your current data becomes the new recovery copy.`, async () => {
            await snapshot('Before restoring the recovery copy');
            applyDomain({ ...domain, onboardingComplete: true });
            await flushStorage();
            get().toast(dropped ? `Recovery copy restored (${dropped} unreadable records skipped)` : 'Recovery copy restored');
          }, 'Restore', 'Cancel', true);
        },
      };
    },
    {
      name: STORAGE_KEY,
      version: 2,
      storage: persistStorage as never,
      migrate: (persisted) => persisted as AppState,
      // Stored data is repaired record-by-record instead of trusted blindly, so one bad
      // record (or an older format) can't crash the app or wipe everything else.
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current;
        const p = persisted as Partial<AppState>;
        const { domain, dropped, problems } = repairDomain(p);
        if (dropped > 0) {
          useStorageStatus.setState({ loadNotice: `Some saved records couldn't be read and were skipped (${problems.join('; ')}). Everything else loaded normally.` });
        }
        const onboardingDone = domain.onboardingComplete;
        return {
          ...current,
          ...domain,
          showOnboarding: onboardingDone ? false : p.showOnboarding ?? true,
          pricingServiceId: domain.services.some((sv) => sv.id === current.pricingServiceId) ? current.pricingServiceId : domain.services[0]?.id ?? '',
        };
      },
      onRehydrateStorage: () => () => markHydrated(),
      partialize: (state) => ({
        ...pickDomain(state),
        showOnboarding: state.onboardingComplete ? false : state.showOnboarding,
      }),
    },
  ),
);

// Another tab/window saved changes: reload them so this tab never overwrites newer data with stale data.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || e.newValue === null) return;
    void useStore.persist.rehydrate();
    useStore.getState().toast('Updated with changes from another Lumora window');
  });
}

