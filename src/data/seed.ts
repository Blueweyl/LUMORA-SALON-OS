import { makeId } from '../lib/id';
import { isoDaysAgo, isoDaysFromNow, isoWeeksAgo, todayISO } from '../lib/dates';
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
  Service,
  StaffMember,
  WaitlistEntry,
} from '../types';

export const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD — US Dollar ($)' },
  { code: 'CAD', symbol: '$', label: 'CAD — Canadian Dollar ($)' },
  { code: 'GBP', symbol: '£', label: 'GBP — British Pound (£)' },
  { code: 'EUR', symbol: '€', label: 'EUR — Euro (€)' },
  { code: 'AUD', symbol: '$', label: 'AUD — Australian Dollar ($)' },
  { code: 'NZD', symbol: '$', label: 'NZD — New Zealand Dollar ($)' },
  { code: 'ZAR', symbol: 'R', label: 'ZAR — South African Rand (R)' },
  { code: 'PHP', symbol: '₱', label: 'PHP — Philippine Peso (₱)' },
];

export function defaultBusiness(): Business {
  return {
    name: "Mia's Beauty Studio",
    currencyCode: 'USD',
    currencySymbol: '$',
    hours: 'Tue–Sat, 9:00 AM – 6:00 PM',
    openDays: [2, 3, 4, 5, 6],
    openTime: '09:00',
    closeTime: '18:00',
    teamType: 'team',
    depositPct: 25,
    bufferMin: 15,
    cancellationWindowHrs: 24,
    rebookWeeks: 6,
  };
}

export function seedStaff(): StaffMember[] {
  return [
    { id: 'st_mia', name: 'Mia Chen', role: 'Owner · Colorist', color: '#7a2f57', initials: 'MC' },
    { id: 'st_jordan', name: 'Jordan Lee', role: 'Stylist', color: '#3f6e63', initials: 'JL' },
    { id: 'st_ava', name: 'Ava Torres', role: 'Nail & Lash Tech', color: '#8a6a2f', initials: 'AT' },
  ];
}

export function seedServices(): Service[] {
  const s = (partial: Omit<Service, 'active' | 'targetMargin'> & { targetMargin?: number }): Service => ({
    active: true,
    targetMargin: 0.35,
    ...partial,
  });
  return [
    s({ id: 'svc_balayage', name: 'Balayage', category: 'Hair Color', duration: 105, price: 150, materials: 22, laborHours: 1.5, hourlyRate: 50, overhead: 18 }),
    s({ id: 'svc_cut', name: 'Haircut & Style', category: 'Hair', duration: 45, price: 65, materials: 3, laborHours: 0.75, hourlyRate: 42, overhead: 6 }),
    s({ id: 'svc_roottouch', name: 'Root Touch-Up', category: 'Hair Color', duration: 90, price: 95, materials: 15, laborHours: 1, hourlyRate: 45, overhead: 10 }),
    s({ id: 'svc_highlight', name: 'Full Highlight', category: 'Hair Color', duration: 150, price: 175, materials: 28, laborHours: 2.5, hourlyRate: 50, overhead: 20 }),
    s({ id: 'svc_blowout', name: 'Blowout', category: 'Hair', duration: 30, price: 40, materials: 2, laborHours: 0.5, hourlyRate: 40, overhead: 4 }),
    s({ id: 'svc_keratin', name: 'Keratin Smoothing', category: 'Hair', duration: 180, price: 220, materials: 45, laborHours: 3, hourlyRate: 45, overhead: 25 }),
    s({ id: 'svc_gelmani', name: 'Gel Manicure', category: 'Nails', duration: 45, price: 45, materials: 6, laborHours: 0.75, hourlyRate: 30, overhead: 4 }),
    s({ id: 'svc_pedicure', name: 'Classic Pedicure', category: 'Nails', duration: 60, price: 55, materials: 8, laborHours: 1, hourlyRate: 30, overhead: 5 }),
    s({ id: 'svc_lashlift', name: 'Lash Lift & Tint', category: 'Lash & Brow', duration: 60, price: 85, materials: 10, laborHours: 1, hourlyRate: 45, overhead: 6 }),
    s({ id: 'svc_browtint', name: 'Brow Shape & Tint', category: 'Lash & Brow', duration: 30, price: 35, materials: 4, laborHours: 0.5, hourlyRate: 40, overhead: 3 }),
  ];
}

export function seedInventory(): InventoryItem[] {
  return [
    { id: 'inv_lightener', name: 'Lightener (Blondor)', qty: 420, unit: 'g', cost: 68, retailPrice: 0, supplier: 'Wella Professional', reorderLevel: 150, expiration: isoDaysFromNow(240), usagePerService: { svc_balayage: 60, svc_highlight: 70 } },
    { id: 'inv_toner', name: 'Toner / Glaze', qty: 300, unit: 'ml', cost: 34, retailPrice: 0, supplier: 'Wella Professional', reorderLevel: 100, expiration: isoDaysFromNow(300), usagePerService: { svc_balayage: 30, svc_highlight: 30, svc_roottouch: 20 } },
    { id: 'inv_foils', name: 'Foils', qty: 40, unit: 'sheets', cost: 12, retailPrice: 0, supplier: 'Framar', reorderLevel: 50, expiration: null, usagePerService: { svc_balayage: 20, svc_highlight: 24 } },
    { id: 'inv_gloves', name: 'Nitrile Gloves', qty: 220, unit: 'pair', cost: 9, retailPrice: 0, supplier: 'SalonSupply Co.', reorderLevel: 80, expiration: null, usagePerService: { svc_balayage: 2, svc_highlight: 2, svc_roottouch: 2, svc_keratin: 2 } },
    { id: 'inv_color7n', name: 'Permanent Color 7N', qty: 2, unit: 'tube', cost: 11, retailPrice: 0, supplier: "L'Oréal Pro", reorderLevel: 5, expiration: isoDaysFromNow(400), usagePerService: { svc_roottouch: 1 } },
    { id: 'inv_gelpolish', name: 'Gel Polish Top Coat', qty: 5, unit: 'bottle', cost: 14, retailPrice: 0, supplier: 'OPI', reorderLevel: 2, expiration: null, usagePerService: { svc_gelmani: 0.05 } },
    { id: 'inv_pedisalt', name: 'Pedicure Soak Salts', qty: 1200, unit: 'g', cost: 22, retailPrice: 0, supplier: 'SpaEssentials', reorderLevel: 300, expiration: null, usagePerService: { svc_pedicure: 50 } },
    { id: 'inv_lashkit', name: 'Lash Lift Kit Pods', qty: 18, unit: 'kit', cost: 4, retailPrice: 0, supplier: 'Elleeb', reorderLevel: 10, expiration: isoDaysFromNow(500), usagePerService: { svc_lashlift: 1 } },
    { id: 'inv_browtint', name: 'Brow Tint', qty: 9, unit: 'application', cost: 3, retailPrice: 0, supplier: 'RefectoCil', reorderLevel: 6, expiration: isoDaysFromNow(200), usagePerService: { svc_browtint: 1 } },
    { id: 'inv_keratinsol', name: 'Keratin Solution', qty: 600, unit: 'ml', cost: 58, retailPrice: 0, supplier: 'Brazilian Blowout', reorderLevel: 400, expiration: isoDaysFromNow(365), usagePerService: { svc_keratin: 120 } },
    { id: 'inv_shampoo', name: 'Retail Shampoo 250ml', qty: 24, unit: 'bottle', cost: 8, retailPrice: 24, supplier: 'Wella Professional', reorderLevel: 6, expiration: null, usagePerService: {} },
    { id: 'inv_oil', name: 'Retail Hair Oil', qty: 16, unit: 'bottle', cost: 7, retailPrice: 22, supplier: "L'Oréal Pro", reorderLevel: 5, expiration: null, usagePerService: {} },
  ];
}

function emptyBeautyProfile(over: Partial<Client['beautyProfile']> = {}) {
  return {
    hairType: '',
    skinType: '',
    nailType: '',
    allergies: 'None known',
    formulas: '',
    productsUsed: '',
    patchTestDate: '',
    preferences: '',
    preferredStaffId: '',
    ...over,
  };
}

let clientSeq = 0;
function client(over: Partial<Client> & { name: string }): Client {
  clientSeq += 1;
  return {
    phone: `(415) 555-${String(1000 + clientSeq).slice(-4)}`,
    email: `${over.name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
    birthday: '',
    createdAt: isoDaysAgo(400),
    lastVisit: null,
    nextVisit: null,
    lifetimeSpend: 0,
    visits: 0,
    vipTier: 'none',
    loyaltyPoints: 0,
    beautyProfile: emptyBeautyProfile(),
    notes: [],
    photos: [],
    noShowCount: 0,
    cancellationCount: 0,
    status: 'active',
    ...over,
    // Set after the spread: callers may pass `id: undefined`, which must not wipe the generated id.
    id: over.id ?? makeId('cl'),
  };
}

export function seedClients(): Client[] {
  const list: Client[] = [];

  // ---- Hero clients referenced across the app ----
  list.push(
    client({
      id: 'cl_sarah',
      name: 'Sarah Mitchell',
      phone: '(415) 555-0142',
      birthday: '11-08',
      lastVisit: isoWeeksAgo(6),
      lifetimeSpend: 2460,
      visits: 17,
      vipTier: 'gold',
      loyaltyPoints: 920,
      beautyProfile: emptyBeautyProfile({
        hairType: 'Fine, low-porosity, naturally level 6',
        allergies: 'None known',
        formulas: 'Balayage: Wella Blondor 20vol, toner T18 + 6RV 1:2, 20 min',
        productsUsed: 'Wella Fusion mask, Kerastase Elixir Ultime',
        patchTestDate: isoDaysAgo(70),
        preferences: 'Loves a soft, natural money-piece. Sensitive scalp — light tension on blow-dry.',
        preferredStaffId: 'st_mia',
      }),
      notes: [
        { id: makeId('note'), date: isoWeeksAgo(6), text: 'Wants to go slightly warmer next visit. Loved the toner shade.', author: 'Mia Chen' },
        { id: makeId('note'), date: isoWeeksAgo(12), text: 'Getting married in June — plan a trial style 2 weeks before.', author: 'Mia Chen' },
      ],
      photos: [
        { id: makeId('ph'), date: isoWeeksAgo(6), label: 'Balayage refresh', kind: 'after', color: '#caa26a' },
        { id: makeId('ph'), date: isoWeeksAgo(6), label: 'Before', kind: 'before', color: '#8a6a4a' },
      ],
    }),
  );

  list.push(
    client({
      id: 'cl_emma',
      name: 'Emma Rodriguez',
      phone: '(415) 555-0187',
      birthday: '04-22',
      lastVisit: isoDaysAgo(2),
      lifetimeSpend: 860,
      visits: 9,
      vipTier: 'silver',
      loyaltyPoints: 340,
      beautyProfile: emptyBeautyProfile({ hairType: 'Medium, level 5 base', allergies: 'PPD sensitivity — patch test every color visit' }),
      notes: [{ id: makeId('note'), date: isoDaysAgo(2), text: 'Balance still due from last color service.', author: 'Mia Chen' }],
    }),
  );

  list.push(
    client({
      id: 'cl_jessica',
      name: 'Jessica Park',
      phone: '(415) 555-0119',
      birthday: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })(),
      lastVisit: isoWeeksAgo(5),
      lifetimeSpend: 1180,
      visits: 11,
      vipTier: 'gold',
      loyaltyPoints: 610,
      beautyProfile: emptyBeautyProfile({ nailType: 'Natural, medium length, prone to breakage', preferredStaffId: 'st_ava' }),
    }),
  );

  list.push(
    client({
      id: 'cl_priya',
      name: 'Priya Nair',
      birthday: '09-30',
      lastVisit: isoDaysAgo(1),
      lifetimeSpend: 420,
      visits: 5,
      vipTier: 'none',
      loyaltyPoints: 180,
      beautyProfile: emptyBeautyProfile({ nailType: 'Gel-friendly, no allergies' }),
    }),
  );

  list.push(
    client({
      id: 'cl_david',
      name: 'David Kim',
      birthday: '02-14',
      lastVisit: isoDaysAgo(3),
      lifetimeSpend: 310,
      visits: 6,
      vipTier: 'none',
      loyaltyPoints: 95,
    }),
  );

  list.push(
    client({
      id: 'cl_lauren',
      name: 'Lauren Wallace',
      birthday: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 9);
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })(),
      lastVisit: isoWeeksAgo(9),
      lifetimeSpend: 1940,
      visits: 14,
      vipTier: 'platinum',
      loyaltyPoints: 1240,
      beautyProfile: emptyBeautyProfile({ hairType: 'Thick, level 4 base, coarse', preferredStaffId: 'st_mia' }),
    }),
  );

  list.push(
    client({
      id: 'cl_natalie',
      name: 'Natalie Brooks',
      birthday: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 16);
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })(),
      lastVisit: isoWeeksAgo(4),
      lifetimeSpend: 640,
      visits: 7,
      vipTier: 'silver',
      loyaltyPoints: 410,
    }),
  );

  list.push(
    client({
      id: 'cl_olivia',
      name: 'Olivia Chen',
      birthday: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 24);
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })(),
      lastVisit: isoWeeksAgo(2),
      lifetimeSpend: 275,
      visits: 3,
      vipTier: 'none',
      loyaltyPoints: 120,
    }),
  );

  // ---- Filler clients: overdue / due-now / due-soon (rebook opportunities) ----
  const overdueNames = [
    'Grace Thompson', 'Maria Gonzalez', 'Isabella Wright', 'Chloe Adams', 'Sofia Ramirez',
    'Hannah Lee', 'Victoria Scott', 'Ella Martinez', 'Zoe Bennett', 'Abigail Turner',
    'Mia Foster', 'Nora Campbell',
  ];
  const overdueIds: Record<string, string> = { 'Grace Thompson': 'cl_grace0', 'Maria Gonzalez': 'cl_maria1' };
  overdueNames.forEach((name, i) => {
    const weeksAgoLastVisit = 7 + i; // 7..18 weeks ago -> overdue relative to 6wk cadence, under 90 days for most
    list.push(
      client({
        id: overdueIds[name],
        name,
        lastVisit: isoWeeksAgo(weeksAgoLastVisit),
        lifetimeSpend: 180 + i * 65,
        visits: 2 + (i % 5),
        vipTier: i % 6 === 0 ? 'silver' : 'none',
        loyaltyPoints: 60 + i * 20,
      }),
    );
  });

  // ---- Lost clients: inactive 90+ days ----
  const lostNames = [
    'Rachel Green', 'Brianna Hayes', 'Kayla Simmons', 'Taylor Morgan', 'Alexis Reed',
    'Samantha Cole', 'Destiny Ward', 'Julia Sanders', 'Amber Price', 'Courtney Diaz',
    'Madison Cruz', 'Peyton Long', 'Savannah Ross', 'Vanessa Myers',
  ];
  lostNames.forEach((name, i) => {
    list.push(
      client({
        name,
        lastVisit: isoDaysAgo(95 + i * 12),
        lifetimeSpend: 90 + i * 40,
        visits: 1 + (i % 4),
        status: i % 5 === 0 ? 'inactive' : 'active',
        loyaltyPoints: 20 + i * 10,
      }),
    );
  });

  // ---- Upcoming / recently booked clients ----
  const upcomingNames = ['Ben Carter', 'Ethan Brooks', 'Ivy Sullivan', 'Ruby Coleman'];
  const upcomingIds: Record<string, string> = { 'Ben Carter': 'cl_ben', 'Ethan Brooks': 'cl_ethan', 'Ivy Sullivan': 'cl_ivy', 'Ruby Coleman': 'cl_ruby' };
  upcomingNames.forEach((name, i) => {
    list.push(
      client({
        id: upcomingIds[name],
        name,
        lastVisit: isoWeeksAgo(2 + i),
        lifetimeSpend: 210 + i * 55,
        visits: 3 + i,
        vipTier: i === 0 ? 'gold' : 'none',
        loyaltyPoints: 140 + i * 30,
      }),
    );
  });

  return list;
}

function appt(over: Partial<Appointment> & Pick<Appointment, 'clientId' | 'staffId' | 'serviceIds' | 'date' | 'time' | 'durationMin' | 'price'>): Appointment {
  return {
    id: makeId('ap'),
    discount: 0,
    deposit: 0,
    depositPaid: false,
    balancePaid: false,
    status: 'confirmed',
    notes: '',
    recurring: 'none',
    createdAt: isoDaysAgo(3),
    tip: 0,
    productsSold: [],
    ...over,
  };
}

export function seedAppointments(): Appointment[] {
  const today = todayISO();
  const list: Appointment[] = [];

  // Today's schedule
  list.push(appt({ clientId: 'cl_priya', staffId: 'st_ava', serviceIds: ['svc_gelmani'], date: today, time: '09:00', durationMin: 45, price: 45, status: 'completed', deposit: 0, depositPaid: true, balancePaid: true }));
  list.push(appt({ clientId: 'cl_emma', staffId: 'st_mia', serviceIds: ['svc_roottouch'], date: today, time: '09:15', durationMin: 90, price: 95, discount: 0, deposit: 20, depositPaid: true, balancePaid: false, status: 'completed' }));
  list.push(appt({ clientId: 'cl_sarah', staffId: 'st_mia', serviceIds: ['svc_balayage', 'svc_cut'], date: today, time: '10:30', durationMin: 150, price: 215, discount: 30, deposit: 50, depositPaid: true, balancePaid: false, status: 'confirmed' }));
  list.push(appt({ clientId: 'cl_olivia', staffId: 'st_jordan', serviceIds: ['svc_blowout'], date: today, time: '13:00', durationMin: 30, price: 40, deposit: 0, depositPaid: true, balancePaid: false, status: 'confirmed' }));
  list.push(appt({ clientId: 'cl_david', staffId: 'st_ava', serviceIds: ['svc_lashlift'], date: today, time: '14:00', durationMin: 60, price: 85, deposit: 20, depositPaid: true, balancePaid: false, status: 'unconfirmed' }));
  list.push(appt({ clientId: 'cl_natalie', staffId: 'st_jordan', serviceIds: ['svc_cut', 'svc_blowout'], date: today, time: '15:30', durationMin: 75, price: 105, deposit: 0, depositPaid: true, balancePaid: false, status: 'confirmed' }));

  // Upcoming appointments (next 2 weeks)
  list.push(appt({ clientId: 'cl_lauren', staffId: 'st_mia', serviceIds: ['svc_highlight'], date: isoDaysFromNow(2), time: '11:00', durationMin: 150, price: 175, deposit: 44, depositPaid: true, balancePaid: false, status: 'confirmed' }));
  list.push(appt({ clientId: 'cl_ben', staffId: 'st_ava', serviceIds: ['svc_pedicure'], date: isoDaysFromNow(1), time: '10:00', durationMin: 60, price: 55, deposit: 0, depositPaid: true, balancePaid: false, status: 'confirmed' }));
  list.push(appt({ clientId: 'cl_ethan', staffId: 'st_jordan', serviceIds: ['svc_cut'], date: isoDaysFromNow(4), time: '16:00', durationMin: 45, price: 65, deposit: 0, depositPaid: true, balancePaid: false, status: 'unconfirmed' }));
  list.push(appt({ clientId: 'cl_ivy', staffId: 'st_ava', serviceIds: ['svc_browtint'], date: isoDaysFromNow(6), time: '12:30', durationMin: 30, price: 35, deposit: 0, depositPaid: true, balancePaid: false, status: 'confirmed' }));
  list.push(appt({ clientId: 'cl_ruby', staffId: 'st_mia', serviceIds: ['svc_roottouch'], date: isoDaysFromNow(8), time: '09:30', durationMin: 90, price: 95, deposit: 24, depositPaid: true, balancePaid: false, status: 'confirmed' }));

  // A cancelled appointment today for Cancellation Rescue demo
  list.push(appt({ clientId: 'cl_natalie', staffId: 'st_mia', serviceIds: ['svc_balayage'], date: isoDaysFromNow(2), time: '13:00', durationMin: 105, price: 150, deposit: 0, depositPaid: false, balancePaid: false, status: 'cancelled', cancelReason: 'Client rescheduled for a later date' }));

  // Past history for hero clients (for History / profile tabs)
  list.push(appt({ clientId: 'cl_sarah', staffId: 'st_mia', serviceIds: ['svc_balayage', 'svc_cut'], date: isoWeeksAgo(6), time: '10:00', durationMin: 150, price: 215, discount: 30, deposit: 50, depositPaid: true, balancePaid: true, status: 'completed', notes: 'Toned slightly warmer per request.' }));
  list.push(appt({ clientId: 'cl_sarah', staffId: 'st_mia', serviceIds: ['svc_roottouch'], date: isoWeeksAgo(12), time: '10:00', durationMin: 90, price: 95, deposit: 24, depositPaid: true, balancePaid: true, status: 'completed' }));
  list.push(appt({ clientId: 'cl_lauren', staffId: 'st_mia', serviceIds: ['svc_highlight'], date: isoWeeksAgo(9), time: '11:00', durationMin: 150, price: 175, deposit: 44, depositPaid: true, balancePaid: true, status: 'completed' }));
  list.push(appt({ clientId: 'cl_jessica', staffId: 'st_ava', serviceIds: ['svc_gelmani', 'svc_pedicure'], date: isoWeeksAgo(5), time: '13:30', durationMin: 105, price: 100, deposit: 0, depositPaid: true, balancePaid: true, status: 'completed' }));

  return list;
}

export function seedPayments(appointments: Appointment[]): Payment[] {
  const list: Payment[] = [];
  appointments.forEach((a) => {
    if (a.deposit > 0 && a.depositPaid) {
      list.push({ id: makeId('pay'), clientId: a.clientId, apptId: a.id, amount: a.deposit, method: 'Card', type: 'deposit', date: a.createdAt });
    }
    if (a.status === 'completed' && a.balancePaid) {
      const remaining = a.price - a.discount - a.deposit;
      if (remaining > 0) {
        list.push({ id: makeId('pay'), clientId: a.clientId, apptId: a.id, amount: remaining, method: 'Card', type: a.deposit > 0 ? 'balance' : 'full', date: a.date });
      }
    }
  });
  return list;
}

export function seedExpenses(): Expense[] {
  return [
    { id: makeId('ex'), name: 'Studio Rent', category: 'Rent', amount: 1800, date: isoDaysAgo(20) },
    { id: makeId('ex'), name: 'Color & Styling Supplies', category: 'Supplies', amount: 340, date: isoDaysAgo(14) },
    { id: makeId('ex'), name: 'Instagram Ads', category: 'Marketing', amount: 120, date: isoDaysAgo(10) },
    { id: makeId('ex'), name: 'Electricity & Water', category: 'Utilities', amount: 165, date: isoDaysAgo(8) },
    { id: makeId('ex'), name: 'Booking Software', category: 'Software', amount: 39, date: isoDaysAgo(5) },
    { id: makeId('ex'), name: 'Continuing Education — Color Class', category: 'Education', amount: 220, date: isoDaysAgo(28) },
    { id: makeId('ex'), name: 'Retail Restock — Shampoo/Oil', category: 'Supplies', amount: 210, date: isoDaysAgo(3) },
    { id: makeId('ex'), name: 'Laundry Service', category: 'Utilities', amount: 60, date: isoDaysAgo(2) },
  ];
}

export function seedWaitlist(): WaitlistEntry[] {
  return [
    { id: makeId('wl'), clientId: 'cl_natalie', serviceIds: ['svc_balayage'], note: 'Flexible any weekday afternoon', createdAt: isoDaysAgo(5) },
    { id: makeId('wl'), clientId: 'cl_grace0', serviceIds: ['svc_balayage', 'svc_cut'], note: 'Prefers Mia, mornings only', createdAt: isoDaysAgo(9) },
    { id: makeId('wl'), clientId: 'cl_maria1', serviceIds: ['svc_highlight'], note: 'Any staff, weekends preferred', createdAt: isoDaysAgo(4) },
  ];
}

export function seedContent(): ContentItem[] {
  return [
    { id: makeId('ct'), title: "Sarah's balayage transformation", platform: 'Instagram', template: 'Before/After', stage: 'posted', date: isoDaysAgo(6) },
    { id: makeId('ct'), title: 'Lauren — full highlight glow-up', platform: 'Instagram', template: 'Transformation', stage: 'scheduled', date: isoDaysFromNow(2) },
    { id: makeId('ct'), title: 'Tomorrow 2pm opened up — Balayage slot', platform: 'Instagram', template: 'Last-Minute Opening', stage: 'draft', date: null },
    { id: makeId('ct'), title: 'Introducing Keratin Smoothing', platform: 'Facebook', template: 'New Service', stage: 'idea', date: null },
    { id: makeId('ct'), title: '5-star review from Priya', platform: 'Instagram', template: 'Review', stage: 'posted', date: isoDaysAgo(11) },
    { id: makeId('ct'), title: 'Our favorite styling oil restock', platform: 'Pinterest', template: 'Product Spotlight', stage: 'idea', date: null },
    { id: makeId('ct'), title: "Jessica's birthday month offer", platform: 'TikTok', template: 'Birthday Promo', stage: 'draft', date: null },
    { id: makeId('ct'), title: 'Fall color trends at the studio', platform: 'Pinterest', template: 'Seasonal Offer', stage: 'scheduled', date: isoDaysFromNow(5) },
  ];
}

export function seedGiftCards(): GiftCard[] {
  return [
    { id: makeId('gc'), code: 'LUM-8341', initialValue: 100, balance: 45, purchasedBy: 'Sarah Mitchell', issuedDate: isoDaysAgo(60), kind: 'gift' },
    { id: makeId('gc'), code: 'LUM-2290', initialValue: 50, balance: 50, purchasedBy: 'Lauren Wallace', issuedDate: isoDaysAgo(10), kind: 'gift' },
  ];
}

export function seedLoyaltyRewards(): LoyaltyReward[] {
  return [
    { id: makeId('rw'), label: '$10 off your next visit', pointsCost: 500 },
    { id: makeId('rw'), label: 'Free Blowout', pointsCost: 700 },
    { id: makeId('rw'), label: '$25 off your next visit', pointsCost: 1000 },
    { id: makeId('rw'), label: 'Free deluxe add-on of your choice', pointsCost: 1200 },
  ];
}
