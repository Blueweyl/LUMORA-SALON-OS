export type ID = string;

export type VipTier = 'none' | 'silver' | 'gold' | 'platinum';

export interface StaffMember {
  id: ID;
  name: string;
  role: string;
  color: string; // hex accent used for calendar chips
  initials: string;
  archived?: boolean; // hidden from new bookings, kept for history
}

export interface Service {
  id: ID;
  name: string;
  category: string;
  duration: number; // minutes
  price: number;
  materials: number;
  laborHours: number;
  hourlyRate: number;
  overhead: number;
  active: boolean;
  targetMargin: number; // 0-1
}

export interface BeautyProfile {
  hairType: string;
  skinType: string;
  nailType: string;
  allergies: string;
  formulas: string;
  productsUsed: string;
  patchTestDate: string;
  preferences: string;
  preferredStaffId: ID | '';
}

export interface ClientNote {
  id: ID;
  date: string; // ISO date
  text: string;
  author: string;
}

export interface ClientPhoto {
  id: ID;
  date: string;
  label: string;
  kind: 'before' | 'after';
  color: string; // placeholder swatch color
}

export interface Client {
  id: ID;
  name: string;
  phone: string;
  email: string;
  birthday: string; // MM-DD
  createdAt: string;
  lastVisit: string | null;
  nextVisit: string | null; // appointment id lookup done via appointments
  lifetimeSpend: number;
  visits: number;
  vipTier: VipTier;
  loyaltyPoints: number;
  beautyProfile: BeautyProfile;
  notes: ClientNote[];
  photos: ClientPhoto[];
  noShowCount: number;
  cancellationCount: number;
  status: 'active' | 'lead' | 'inactive';
  referredBy?: string;
  archived?: boolean; // hidden from lists/booking, kept for history
}

export type AppointmentStatus =
  | 'unconfirmed'
  | 'confirmed'
  | 'checked-in'
  | 'in-service'
  | 'completed'
  | 'cancelled'
  | 'no-show';

export interface ProductSoldLine {
  itemId: ID;
  qty: number;
  price: number;
  name?: string; // snapshot so history survives item edits/removal
}

export interface Appointment {
  id: ID;
  clientId: ID;
  staffId: ID;
  serviceIds: ID[];
  date: string; // YYYY-MM-DD
  time: string; // HH:MM 24h
  durationMin: number;
  price: number;
  discount: number;
  deposit: number;
  depositPaid: boolean;
  balancePaid: boolean;
  status: AppointmentStatus;
  notes: string;
  recurring: 'none' | 'weekly' | 'biweekly' | 'monthly';
  createdAt: string;
  tip: number;
  productsSold: ProductSoldLine[];
  cancelReason?: string;
}

export interface InventoryItem {
  id: ID;
  name: string;
  qty: number;
  unit: string;
  cost: number;
  retailPrice: number;
  supplier: string;
  reorderLevel: number;
  expiration: string | null;
  usagePerService: Record<ID, number>; // serviceId -> amount consumed per service
}

export interface Payment {
  id: ID;
  clientId: ID;
  apptId: ID | null;
  amount: number;
  method: 'Card' | 'Cash';
  type: 'deposit' | 'balance' | 'full' | 'product' | 'package' | 'gift-card';
  date: string;
  note?: string;
  tip?: number; // portion of amount that is a tip (not applied to the bill)
  voided?: boolean; // voided payments are kept for audit but excluded from totals
  voidedAt?: string;
}

export interface Expense {
  id: ID;
  name: string;
  category: string;
  amount: number;
  date: string;
}

export interface WaitlistEntry {
  id: ID;
  clientId: ID;
  serviceIds: ID[];
  note: string;
  createdAt: string;
}

export type ContentStage = 'idea' | 'draft' | 'scheduled' | 'posted';
export type ContentPlatform = 'Instagram' | 'TikTok' | 'Pinterest' | 'Facebook';

export interface ContentItem {
  id: ID;
  title: string;
  platform: ContentPlatform;
  template: string;
  stage: ContentStage;
  date: string | null;
}

export interface GiftCard {
  id: ID;
  code: string;
  initialValue: number;
  balance: number;
  purchasedBy: string;
  issuedDate: string;
}

export interface LoyaltyReward {
  id: ID;
  label: string;
  pointsCost: number;
}

export interface Business {
  name: string;
  currencyCode: string;
  currencySymbol: string;
  hours: string; // human-readable label, derived from openDays/openTime/closeTime
  openDays: number[]; // 0 = Sunday … 6 = Saturday
  openTime: string; // HH:MM
  closeTime: string; // HH:MM
  teamType: 'solo' | 'team';
  depositPct: number;
  bufferMin: number;
  cancellationWindowHrs: number;
  rebookWeeks: number;
}

export type SectionKey = 'home' | 'clients' | 'bookings' | 'money' | 'grow';

export interface RecentActivityEntry {
  id: ID;
  text: string;
  date: string;
}
