import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { makeId } from '../lib/id';
import { todayISO, isoWeeksFromNow } from '../lib/dates';
import { pointsForSpend, tierForPoints } from '../lib/loyalty';
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
import type { AppState, Domain, ServiceDraftRow } from './types';
import type { Client, ClientNote, ClientPhoto, Service, StaffMember, InventoryItem, Expense, Appointment, AppointmentStatus, Payment, ContentItem, ContentStage } from '../types';

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
    newApptDraft: defaultNewApptDraft(),
    newApptPrefillClientId: null,

    apptDetailId: null,
    checkoutDraft: defaultCheckoutDraft(),
    justCompletedApptId: null,

    cancellationRescueApptId: null,

    pricingServiceId: 'svc_balayage',

    showRecordPayment: false,
    recordPaymentDraft: defaultRecordPaymentDraft(),

    copyMessage: null,
    confirmDialog: null,
    toastMsg: '',

    rebookTargetClientId: null,
  };
}

export interface Actions {
  toast: (msg: string) => void;
  askConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string, cancelLabel?: string, destructive?: boolean) => void;
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
  finishSetup: () => void;
  finishAndAddAppt: () => void;
  goAddFirstClient: () => void;

  askResetDemo: () => void;
  resetDemo: () => void;

  openNewClient: () => void;
  closeNewClient: () => void;
  updateNewClientField: (field: keyof AppState['newClientDraft'], value: string) => void;
  saveNewClient: () => void;
  bookForJustAdded: () => void;
  openJustAddedProfile: () => void;
  dismissJustAdded: () => void;
  openClient: (id: string) => void;
  closeClientProfile: () => void;
  setClientTab: (tab: AppState['clientTab']) => void;
  addClientNote: (clientId: string, text: string) => void;
  addClientPhoto: (clientId: string, label: string, kind: 'before' | 'after') => void;
  updateBeautyProfileField: (clientId: string, field: keyof Client['beautyProfile'], value: string) => void;
  deleteClient: (id: string) => void;

  setBookingsView: (v: AppState['bookingsView']) => void;
  setStaffFilter: (id: string) => void;
  setBookingsDate: (date: string) => void;
  shiftBookingsDate: (dir: 1 | -1) => void;
  goToday: () => void;

  openNewAppt: (prefill?: Partial<AppState['newApptDraft']>) => void;
  closeNewAppt: () => void;
  updateNewApptField: <K extends keyof AppState['newApptDraft']>(field: K, value: AppState['newApptDraft'][K]) => void;
  toggleNewApptService: (serviceId: string) => void;
  saveNewAppt: () => void;

  openApptDetail: (id: string) => void;
  closeApptDetail: () => void;
  apptAction: (id: string, action: 'confirm' | 'checkin' | 'start' | 'cancel' | 'noshow') => void;
  updateCheckoutTip: (v: number) => void;
  setCheckoutPayMethod: (v: 'Card' | 'Cash') => void;
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

  addExpense: (e: Omit<Expense, 'id'>) => void;
  deleteExpense: (id: string) => void;

  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateInventoryField: (id: string, field: keyof InventoryItem, value: string | number | null) => void;
  deleteInventoryItem: (id: string) => void;
  restockInventory: (id: string, amount: number) => void;

  recordPayment: (p: Omit<Payment, 'id' | 'date'>) => void;
  openRecordPayment: (clientId?: string) => void;
  closeRecordPayment: () => void;
  updateRecordPaymentField: <K extends keyof AppState['recordPaymentDraft']>(field: K, value: AppState['recordPaymentDraft'][K]) => void;
  saveRecordPayment: () => void;

  setGrowTab: (t: AppState['growTab']) => void;
  redeemReward: (clientId: string, rewardId: string) => void;
  addContentItem: (c: Omit<ContentItem, 'id' | 'stage' | 'date'>) => void;
  moveContentStage: (id: string, stage: ContentStage) => void;
  deleteContentItem: (id: string) => void;

  updateBusinessField: <K extends keyof AppState['business']>(field: K, value: AppState['business'][K]) => void;
  addStaff: (name: string, role: string) => void;
  updateStaff: (id: string, field: keyof StaffMember, value: string) => void;
  removeStaff: (id: string) => void;
  clearAllData: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<AppState & Actions>()(
  persist(
    (set, get) => ({
      ...buildDomain(),
      ...initialUI(),

      toast: (msg) => {
        clearTimeout(toastTimer);
        set({ toastMsg: '' });
        setTimeout(() => set({ toastMsg: msg }), 10);
        toastTimer = setTimeout(() => set({ toastMsg: '' }), 2800);
      },
      askConfirm: (title, message, onConfirm, confirmLabel, cancelLabel, destructive) =>
        set({ confirmDialog: { title, message, onConfirm, confirmLabel: confirmLabel || 'Confirm', cancelLabel: cancelLabel || 'Cancel', destructive } }),
      closeConfirm: () => set({ confirmDialog: null }),
      runConfirm: () => {
        const cb = get().confirmDialog?.onConfirm;
        set({ confirmDialog: null });
        cb?.();
      },

      setSection: (s) => set({ section: s, selectedClientId: null, showSidebarMobile: false }),
      setMobile: (v) => set({ isMobile: v }),
      toggleSidebarMobile: () => set((s) => ({ showSidebarMobile: !s.showSidebarMobile })),
      closeSidebarMobile: () => set({ showSidebarMobile: false }),

      setSearch: (v) => set({ search: v }),
      toggleQuickAdd: () => set((s) => ({ showQuickAdd: !s.showQuickAdd })),
      closeQuickAdd: () => set({ showQuickAdd: false }),
      openSettings: (tab) => set({ showSettings: true, settingsTab: tab || 'Business', showQuickAdd: false }),
      closeSettings: () => set({ showSettings: false }),
      setSettingsTab: (tab) => set({ settingsTab: tab }),

      dismissOnboarding: () => set({ showOnboarding: false, onboardingComplete: true }),
      startSetup: () => set({ onboardingStep: 1, onboardingBiz: { ...defaultOnboardingBiz(), name: get().business.name } }),
      obBack: () => set((s) => ({ onboardingStep: Math.max(0, s.onboardingStep - 1) })),
      obNext: () =>
        set((s) => {
          let next = s.onboardingStep + 1;
          if (next === 3 && s.onboardingBiz.teamType === 'solo') next = 4;
          if (next > 5) next = 6;
          let onboardingBiz = s.onboardingBiz;
          if (next === 2 && onboardingBiz.serviceMode === 'suggested' && onboardingBiz.serviceDraft.length === 0) {
            onboardingBiz = { ...onboardingBiz, serviceDraft: s.services.map((sv) => ({ id: sv.id, name: sv.name, category: sv.category, duration: sv.duration, price: sv.price, materials: sv.materials, laborHours: sv.laborHours, overhead: sv.overhead, advanced: false })) };
          }
          return { onboardingStep: next, onboardingBiz };
        }),
      updateObBiz: (field, value) => set((s) => ({ onboardingBiz: { ...s.onboardingBiz, [field]: value } })),
      setObTeamType: (v) => set((s) => ({ onboardingBiz: { ...s.onboardingBiz, teamType: v } })),
      setObServiceMode: (v) =>
        set((s) => ({
          onboardingBiz: {
            ...s.onboardingBiz,
            serviceMode: v,
            serviceDraft:
              v === 'suggested'
                ? s.services.map((sv) => ({ id: sv.id, name: sv.name, category: sv.category, duration: sv.duration, price: sv.price, materials: sv.materials, laborHours: sv.laborHours, overhead: sv.overhead, advanced: false }))
                : [],
          },
        })),
      addObService: () =>
        set((s) => ({
          onboardingBiz: {
            ...s.onboardingBiz,
            serviceDraft: [...s.onboardingBiz.serviceDraft, { id: makeId('svc'), name: 'New Service', category: 'Hair', duration: 30, price: 0, materials: 0, laborHours: 0.5, overhead: 0, advanced: false }],
          },
        })),
      removeObService: (id) => set((s) => ({ onboardingBiz: { ...s.onboardingBiz, serviceDraft: s.onboardingBiz.serviceDraft.filter((x) => x.id !== id) } })),
      updateObServiceField: (id, field, value) =>
        set((s) => ({ onboardingBiz: { ...s.onboardingBiz, serviceDraft: s.onboardingBiz.serviceDraft.map((x) => (x.id === id ? { ...x, [field]: value } : x)) } })),
      toggleObServiceAdvanced: (id) =>
        set((s) => ({ onboardingBiz: { ...s.onboardingBiz, serviceDraft: s.onboardingBiz.serviceDraft.map((x) => (x.id === id ? { ...x, advanced: !x.advanced } : x)) } })),
      updateObStaffName: (i, value) =>
        set((s) => {
          const names = [...s.onboardingBiz.staffNames];
          names[i] = value;
          return { onboardingBiz: { ...s.onboardingBiz, staffNames: names } };
        }),
      addObStaffField: () => set((s) => ({ onboardingBiz: { ...s.onboardingBiz, staffNames: [...s.onboardingBiz.staffNames, ''] } })),
      removeObStaffField: (i) => set((s) => ({ onboardingBiz: { ...s.onboardingBiz, staffNames: s.onboardingBiz.staffNames.filter((_, idx) => idx !== i) } })),

      finishSetup: () =>
        set((s) => {
          const biz = s.onboardingBiz;
          const currency = CURRENCIES.find((c) => c.code === biz.currencyCode) || CURRENCIES[0];
          const business = { ...s.business, name: biz.name || s.business.name, currencyCode: currency.code, currencySymbol: currency.symbol, teamType: biz.teamType, hours: biz.hours, depositPct: biz.depositPct, bufferMin: biz.bufferMin };
          let services = s.services;
          if (biz.serviceDraft.length > 0) {
            services = biz.serviceDraft.map((sv) => ({ id: sv.id, name: sv.name, category: sv.category || 'General', duration: sv.duration, price: sv.price, materials: sv.materials, laborHours: sv.laborHours, hourlyRate: 40, overhead: sv.overhead, active: true, targetMargin: 0.35 }));
          }
          let staff = s.staff;
          if (biz.teamType === 'solo') {
            staff = [{ id: 'st_you', name: 'You', role: 'Owner · Stylist', color: '#7a2f57', initials: 'YOU' }];
          } else {
            const names = biz.staffNames.map((n) => n.trim()).filter(Boolean);
            if (names.length > 0) {
              staff = names.map((n, i) => ({ id: makeId('st'), name: n, role: i === 0 ? 'Owner' : 'Staff', color: ['#7a2f57', '#3f6e63', '#8a6a2f', '#42527a'][i % 4], initials: n.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() }));
            }
          }
          return { business, services, staff, showOnboarding: false, onboardingComplete: true, onboardingStep: 0 };
        }),
      finishAndAddAppt: () => {
        get().finishSetup();
        get().openNewAppt();
      },
      goAddFirstClient: () => {
        set({ showSettings: false });
        get().openNewClient();
      },

      askResetDemo: () =>
        get().askConfirm('Reset demo data?', 'This restores the original demo business, clients, and appointments. Any custom changes you made will be lost.', () => get().resetDemo(), 'Reset Demo', 'Cancel', true),
      resetDemo: () => {
        set({ ...buildDomain(), ...initialUI() });
        get().toast('Demo data reset');
      },

      openNewClient: () => set({ showNewClient: true, newClientDraft: defaultNewClientDraft() }),
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
      saveNewClient: () => {
        const d = get().newClientDraft;
        if (!d.name.trim()) {
          get().toast('Add a client name to continue');
          return;
        }
        const id = makeId('cl');
        const client: Client = {
          id,
          name: d.name.trim(),
          phone: d.phone,
          email: d.email,
          birthday: d.birthday,
          createdAt: todayISO(),
          lastVisit: null,
          nextVisit: null,
          lifetimeSpend: 0,
          visits: 0,
          vipTier: 'none',
          loyaltyPoints: 0,
          beautyProfile: { hairType: '', skinType: '', nailType: '', allergies: d.allergies || 'None known', formulas: '', productsUsed: '', patchTestDate: '', preferences: '', preferredStaffId: d.preferredStaffId },
          notes: d.notes ? [{ id: makeId('note'), date: todayISO(), text: d.notes, author: 'You' }] : [],
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

      openClient: (id) => set({ selectedClientId: id, clientTab: 'Overview', section: 'clients' }),
      closeClientProfile: () => set({ selectedClientId: null }),
      setClientTab: (tab) => set({ clientTab: tab }),
      addClientNote: (clientId, text) => {
        if (!text.trim()) return;
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
      deleteClient: (id) =>
        get().askConfirm('Delete this client?', 'This removes their profile, history, and notes. This cannot be undone.', () => {
          set((s) => ({ clients: s.clients.filter((c) => c.id !== id), selectedClientId: s.selectedClientId === id ? null : s.selectedClientId }));
          get().toast('Client deleted');
        }, 'Delete', 'Cancel', true),

      setBookingsView: (v) => set({ bookingsView: v }),
      setStaffFilter: (id) => set({ staffFilter: id }),
      setBookingsDate: (date) => set({ bookingsDate: date }),
      shiftBookingsDate: (dir) =>
        set((s) => {
          const d = new Date(s.bookingsDate + 'T00:00:00');
          const step = s.bookingsView === 'Week' ? 7 : s.bookingsView === 'Month' ? 30 : 1;
          d.setDate(d.getDate() + dir * step);
          return { bookingsDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };
        }),
      goToday: () => set({ bookingsDate: todayISO() }),

      openNewAppt: (prefill) =>
        set((s) => ({
          showNewAppt: true,
          newApptDraft: { ...defaultNewApptDraft(), staffId: s.staff[0]?.id || '', date: s.bookingsDate || todayISO(), ...prefill },
        })),
      closeNewAppt: () => set({ showNewAppt: false }),
      updateNewApptField: (field, value) => set((s) => ({ newApptDraft: { ...s.newApptDraft, [field]: value } })),
      toggleNewApptService: (serviceId) =>
        set((s) => {
          const has = s.newApptDraft.serviceIds.includes(serviceId);
          return { newApptDraft: { ...s.newApptDraft, serviceIds: has ? s.newApptDraft.serviceIds.filter((x) => x !== serviceId) : [...s.newApptDraft.serviceIds, serviceId] } };
        }),
      saveNewAppt: () => {
        const s = get();
        const d = s.newApptDraft;
        if (!d.clientId || d.serviceIds.length === 0 || !d.staffId) {
          get().toast('Select a client, at least one service, and staff to continue');
          return;
        }
        const services = s.services.filter((sv) => d.serviceIds.includes(sv.id));
        const price = services.reduce((sum, sv) => sum + sv.price, 0);
        const duration = services.reduce((sum, sv) => sum + sv.duration, 0);
        const newAppt: Appointment = {
          id: makeId('ap'),
          clientId: d.clientId,
          staffId: d.staffId,
          serviceIds: d.serviceIds,
          date: d.date,
          time: d.time,
          durationMin: duration,
          price,
          discount: d.discount,
          deposit: d.deposit,
          depositPaid: d.deposit > 0,
          balancePaid: false,
          status: 'confirmed',
          notes: d.notes,
          recurring: d.recurring,
          createdAt: todayISO(),
          tip: 0,
          productsSold: [],
        };
        const payments = [...s.payments];
        if (d.deposit > 0) {
          payments.push({ id: makeId('pay'), clientId: d.clientId, apptId: newAppt.id, amount: d.deposit, method: 'Card', type: 'deposit', date: todayISO() });
        }
        set({ appointments: [...s.appointments, newAppt], payments, showNewAppt: false });
        get().toast('Appointment booked');
      },

      openApptDetail: (id) => set({ apptDetailId: id, checkoutDraft: defaultCheckoutDraft() }),
      closeApptDetail: () => set({ apptDetailId: null }),
      apptAction: (id, action) => {
        const map: Record<typeof action, AppointmentStatus> = {
          confirm: 'confirmed',
          checkin: 'checked-in',
          start: 'in-service',
          cancel: 'cancelled',
          noshow: 'no-show',
        } as const;
        if (action === 'cancel') {
          get().askConfirm('Cancel this appointment?', 'The client will need to be notified separately. This frees up the time slot.', () => {
            set((s) => ({ appointments: s.appointments.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a)), apptDetailId: null, cancellationRescueApptId: id }));
          }, 'Cancel Appointment', 'Keep Appointment', true);
          return;
        }
        set((s) => ({ appointments: s.appointments.map((a) => (a.id === id ? { ...a, status: map[action] } : a)) }));
        if (action === 'noshow') {
          const appt = get().appointments.find((a) => a.id === id);
          if (appt) {
            set((s) => ({ clients: s.clients.map((c) => (c.id === appt.clientId ? { ...c, noShowCount: c.noShowCount + 1 } : c)) }));
          }
          set({ apptDetailId: null });
        }
      },
      updateCheckoutTip: (v) => set((s) => ({ checkoutDraft: { ...s.checkoutDraft, tip: v } })),
      setCheckoutPayMethod: (v) => set((s) => ({ checkoutDraft: { ...s.checkoutDraft, payMethod: v } })),
      setCheckoutProductQty: (itemId, qty) =>
        set((s) => ({ checkoutDraft: { ...s.checkoutDraft, productSelections: { ...s.checkoutDraft.productSelections, [itemId]: Math.max(0, qty) } } })),
      completeCheckout: () => {
        const s = get();
        const appt = s.appointments.find((a) => a.id === s.apptDetailId);
        if (!appt) return;
        const services = s.services.filter((sv) => appt.serviceIds.includes(sv.id));

        // Deduct service-linked inventory usage
        const usageTotals: Record<string, number> = {};
        services.forEach((sv) => {
          s.inventory.forEach((item) => {
            const used = item.usagePerService[sv.id];
            if (used) usageTotals[item.id] = (usageTotals[item.id] || 0) + used;
          });
        });

        const productLines = Object.entries(s.checkoutDraft.productSelections)
          .filter(([, qty]) => qty > 0)
          .map(([itemId, qty]) => {
            const item = s.inventory.find((i) => i.id === itemId)!;
            return { itemId, qty, price: item.retailPrice };
          });
        const productsTotal = productLines.reduce((sum, l) => sum + l.qty * l.price, 0);

        const inventory = s.inventory.map((item) => {
          let qty = item.qty;
          if (usageTotals[item.id]) qty -= usageTotals[item.id];
          const sold = productLines.find((l) => l.itemId === item.id);
          if (sold) qty -= sold.qty;
          return { ...item, qty: Math.max(0, qty) };
        });

        const remaining = appt.price - appt.discount - appt.deposit;
        const chargeNow = Math.max(0, remaining) + productsTotal + s.checkoutDraft.tip;
        const payments = [...s.payments];
        if (chargeNow > 0) {
          payments.push({ id: makeId('pay'), clientId: appt.clientId, apptId: appt.id, amount: chargeNow, method: s.checkoutDraft.payMethod, type: appt.deposit > 0 ? 'balance' : 'full', date: todayISO() });
        }

        const spendAmount = appt.price - appt.discount;
        const clients = s.clients.map((c) => {
          if (c.id !== appt.clientId) return c;
          const newPoints = c.loyaltyPoints + pointsForSpend(spendAmount);
          return {
            ...c,
            lifetimeSpend: c.lifetimeSpend + spendAmount,
            visits: c.visits + 1,
            lastVisit: appt.date,
            loyaltyPoints: newPoints,
            vipTier: tierForPoints(newPoints),
          };
        });

        const appointments = s.appointments.map((a) => (a.id === appt.id ? { ...a, status: 'completed' as AppointmentStatus, balancePaid: true, tip: s.checkoutDraft.tip, productsSold: productLines } : a));

        set({ appointments, inventory, payments, clients, apptDetailId: null, justCompletedApptId: appt.id, checkoutDraft: defaultCheckoutDraft() });
        get().toast('Checkout complete');
      },
      closeCompleteScreen: () => set({ justCompletedApptId: null }),
      rebookClient: (clientId, apptId) => {
        const s = get();
        const prevAppt = apptId ? s.appointments.find((a) => a.id === apptId) : undefined;
        set({ justCompletedApptId: null, section: 'bookings' });
        get().openNewAppt({
          clientId,
          serviceIds: prevAppt ? prevAppt.serviceIds : [],
          staffId: prevAppt ? prevAppt.staffId : s.staff[0]?.id || '',
          date: isoWeeksFromNow(s.business.rebookWeeks),
        });
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
        set((s) => ({ waitlist: [...s.waitlist, { id: makeId('wl'), clientId, serviceIds, note, createdAt: todayISO() }] }));
        get().toast('Added to waitlist');
      },
      removeFromWaitlist: (id) => set((s) => ({ waitlist: s.waitlist.filter((w) => w.id !== id) })),
      showCopyMessage: (title, message) => set({ copyMessage: { title, message } }),
      closeCopyMessage: () => set({ copyMessage: null }),

      setMoneyTab: (t) => set({ moneyTab: t }),
      addService: () =>
        set((s) => ({
          services: [...s.services, { id: makeId('svc'), name: 'New Service', category: 'General', duration: 30, price: 0, materials: 0, laborHours: 0.5, hourlyRate: 40, overhead: 0, active: true, targetMargin: 0.35 }],
        })),
      updateServiceField: (id, field, value) => set((s) => ({ services: s.services.map((sv) => (sv.id === id ? { ...sv, [field]: value } : sv)) })),
      moveService: (id, dir) =>
        set((s) => {
          const idx = s.services.findIndex((sv) => sv.id === id);
          const swapIdx = idx + dir;
          if (idx < 0 || swapIdx < 0 || swapIdx >= s.services.length) return {};
          const arr = [...s.services];
          [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
          return { services: arr };
        }),
      duplicateService: (id) =>
        set((s) => {
          const sv = s.services.find((x) => x.id === id);
          if (!sv) return {};
          const copy = { ...sv, id: makeId('svc'), name: `${sv.name} (copy)` };
          const idx = s.services.findIndex((x) => x.id === id);
          const arr = [...s.services];
          arr.splice(idx + 1, 0, copy);
          return { services: arr };
        }),
      archiveToggleService: (id) => set((s) => ({ services: s.services.map((sv) => (sv.id === id ? { ...sv, active: !sv.active } : sv)) })),
      setPricingServiceId: (id) => set({ pricingServiceId: id }),
      applySuggestedPrice: (id) =>
        set((s) => {
          const sv = s.services.find((x) => x.id === id);
          if (!sv) return {};
          const cost = sv.materials + sv.laborHours * sv.hourlyRate + sv.overhead;
          const suggested = Math.round((cost / (1 - sv.targetMargin)) * 100) / 100;
          return { services: s.services.map((x) => (x.id === id ? { ...x, price: suggested } : x)) };
        }),

      addExpense: (e) => set((s) => ({ expenses: [{ ...e, id: makeId('ex') }, ...s.expenses] })),
      deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),

      addInventoryItem: (item) => set((s) => ({ inventory: [...s.inventory, { ...item, id: makeId('inv') }] })),
      updateInventoryField: (id, field, value) => set((s) => ({ inventory: s.inventory.map((i) => (i.id === id ? { ...i, [field]: value } : i)) })),
      deleteInventoryItem: (id) => set((s) => ({ inventory: s.inventory.filter((i) => i.id !== id) })),
      restockInventory: (id, amount) => {
        set((s) => ({ inventory: s.inventory.map((i) => (i.id === id ? { ...i, qty: i.qty + amount } : i)) }));
        get().toast('Stock updated');
      },

      recordPayment: (p) => {
        set((s) => ({ payments: [{ ...p, id: makeId('pay'), date: todayISO() }, ...s.payments] }));
        get().toast('Payment recorded');
      },
      openRecordPayment: (clientId) => set({ showRecordPayment: true, recordPaymentDraft: { ...defaultRecordPaymentDraft(), clientId: clientId || '' } }),
      closeRecordPayment: () => set({ showRecordPayment: false }),
      updateRecordPaymentField: (field, value) => set((s) => ({ recordPaymentDraft: { ...s.recordPaymentDraft, [field]: value } })),
      saveRecordPayment: () => {
        const d = get().recordPaymentDraft;
        if (!d.clientId || d.amount <= 0) {
          get().toast('Choose a client and an amount');
          return;
        }
        get().recordPayment({ clientId: d.clientId, apptId: null, amount: d.amount, method: d.method, type: d.type, note: d.note || undefined });
        set({ showRecordPayment: false });
      },

      setGrowTab: (t) => set({ growTab: t }),
      redeemReward: (clientId, rewardId) => {
        const s = get();
        const reward = s.loyaltyRewards.find((r) => r.id === rewardId);
        const client = s.clients.find((c) => c.id === clientId);
        if (!reward || !client) return;
        if (client.loyaltyPoints < reward.pointsCost) {
          get().toast('Not enough points yet for this reward');
          return;
        }
        set((st) => ({ clients: st.clients.map((c) => (c.id === clientId ? { ...c, loyaltyPoints: c.loyaltyPoints - reward.pointsCost } : c)) }));
        get().toast(`Redeemed: ${reward.label}`);
      },
      addContentItem: (c) => set((s) => ({ content: [{ ...c, id: makeId('ct'), stage: 'idea', date: null }, ...s.content] })),
      moveContentStage: (id, stage) => set((s) => ({ content: s.content.map((c) => (c.id === id ? { ...c, stage } : c)) })),
      deleteContentItem: (id) => set((s) => ({ content: s.content.filter((c) => c.id !== id) })),

      updateBusinessField: (field, value) => set((s) => ({ business: { ...s.business, [field]: value } })),
      addStaff: (name, role) =>
        set((s) => ({ staff: [...s.staff, { id: makeId('st'), name, role, color: ['#7a2f57', '#3f6e63', '#8a6a2f', '#42527a'][s.staff.length % 4], initials: name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() }] })),
      updateStaff: (id, field, value) => set((s) => ({ staff: s.staff.map((st) => (st.id === id ? { ...st, [field]: value } : st)) })),
      removeStaff: (id) => set((s) => ({ staff: s.staff.filter((st) => st.id !== id) })),
      clearAllData: () =>
        get().askConfirm('Clear all client & booking data?', 'This removes every client, appointment, and payment so you can start fresh with your real business. Your business settings and services stay.', () => {
          set({ clients: [], appointments: [], payments: [], waitlist: [], content: seedContent().map((c) => ({ ...c, stage: 'idea' as ContentStage, date: null })) });
          get().toast('Workspace cleared — ready for your real clients');
        }, 'Clear Data', 'Cancel', true),
    }),
    {
      name: 'lumora-salon-os-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        business: state.business,
        staff: state.staff,
        services: state.services,
        clients: state.clients,
        appointments: state.appointments,
        inventory: state.inventory,
        payments: state.payments,
        expenses: state.expenses,
        waitlist: state.waitlist,
        content: state.content,
        giftCards: state.giftCards,
        loyaltyRewards: state.loyaltyRewards,
        demoMode: state.demoMode,
        onboardingComplete: state.onboardingComplete,
        showOnboarding: state.onboardingComplete ? false : state.showOnboarding,
      }),
    },
  ),
);
