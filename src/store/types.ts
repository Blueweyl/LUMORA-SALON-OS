import type { BackupSummary } from '../lib/backup';
import type {
  Appointment,
  Business,
  Client,
  ContentItem,
  Expense,
  GiftCard,
  InventoryItem,
  LoyaltyReward,
  Payment,
  SectionKey,
  Service,
  StaffMember,
  WaitlistEntry,
} from '../types';

export type MoneyTab = 'Overview' | 'Pricing' | 'Payments' | 'Expenses' | 'Inventory';
export type GrowTab = 'Campaigns' | 'Retention' | 'Loyalty' | 'Reviews' | 'Content';
export type BookingsView = 'Day' | 'Week' | 'Month' | 'Agenda';
export type ClientTab = 'Overview' | 'History' | 'Beauty Profile' | 'Photos' | 'Notes' | 'Payments';
export type SettingsTab = 'Business' | 'Services' | 'Team' | 'Booking' | 'Loyalty' | 'Data';

export interface ServiceDraftRow {
  id: string;
  name: string;
  category: string;
  duration: number;
  price: number;
  materials: number;
  laborHours: number;
  overhead: number;
  advanced: boolean;
}

export interface OnboardingBiz {
  name: string;
  currencyCode: string;
  teamType: 'solo' | 'team';
  serviceMode: 'suggested' | 'scratch';
  serviceDraft: ServiceDraftRow[];
  staffNames: string[];
  hours: string;
  openDays: number[];
  openTime: string;
  closeTime: string;
  depositPct: number;
  bufferMin: number;
  startFresh: boolean; // clear demo clients/bookings when setup finishes
}

export interface NewClientDraft {
  name: string;
  phone: string;
  email: string;
  birthday: string;
  preferredStaffId: string;
  allergies: string;
  notes: string;
}

export interface NewApptDraft {
  clientId: string;
  serviceIds: string[];
  staffId: string;
  date: string;
  time: string;
  discount: number;
  deposit: number;
  notes: string;
  recurring: 'none' | 'weekly' | 'biweekly' | 'monthly';
  depositMethod: 'Card' | 'Cash';
  allowOutsideHours: boolean;
}

export interface CheckoutDraft {
  tip: number;
  payMethod: 'Card' | 'Cash';
  productSelections: Record<string, number>; // inventoryItemId -> qty
}

export interface ConfirmDialogState {
  title: string;
  message: string;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface CopyMessageState {
  title: string;
  message: string;
}

export interface Domain {
  business: Business;
  staff: StaffMember[];
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
  inventory: InventoryItem[];
  payments: Payment[];
  expenses: Expense[];
  waitlist: WaitlistEntry[];
  content: ContentItem[];
  giftCards: GiftCard[];
  loyaltyRewards: LoyaltyReward[];
  demoMode: boolean;
  onboardingComplete: boolean;
  lastBackupAt: string | null;
}

export interface PendingImport {
  fileName: string;
  domain: Domain;
  summary: BackupSummary;
}

export interface UIState {
  showOnboarding: boolean;
  onboardingStep: number; // 0 welcome, 1-5 steps, 6 ready
  onboardingBiz: OnboardingBiz;

  section: SectionKey;
  isMobile: boolean;
  showSidebarMobile: boolean;

  search: string;
  showQuickAdd: boolean;
  showSettings: boolean;
  settingsTab: SettingsTab;

  moneyTab: MoneyTab;
  growTab: GrowTab;
  bookingsView: BookingsView;
  staffFilter: string; // 'all' or staff id
  bookingsDate: string;

  selectedClientId: string | null;
  clientTab: ClientTab;

  showNewClient: boolean;
  newClientDraft: NewClientDraft;
  justAddedClientId: string | null;

  showNewAppt: boolean;
  editingApptId: string | null; // set when the appointment modal is rescheduling an existing booking
  newApptDraft: NewApptDraft;
  newApptPrefillClientId: string | null;

  apptDetailId: string | null;
  checkoutDraft: CheckoutDraft;
  justCompletedApptId: string | null;

  cancellationRescueApptId: string | null;

  pricingServiceId: string;

  showRecordPayment: boolean;
  recordPaymentDraft: { clientId: string; apptId: string; amount: number; method: 'Card' | 'Cash'; type: 'full' | 'deposit' | 'balance' | 'product' | 'package' | 'gift-card'; note: string };

  showArchivedClients: boolean;
  pendingImport: PendingImport | null;

  copyMessage: CopyMessageState | null;
  confirmDialog: ConfirmDialogState | null;
  toastMsg: string;
  toastId: number; // bumps on every toast so a repeated message re-announces

  rebookTargetClientId: string | null;
}

export type AppState = Domain & UIState;
