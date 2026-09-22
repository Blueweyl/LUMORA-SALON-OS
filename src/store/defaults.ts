import { todayISO } from '../lib/dates';
import type { CheckoutDraft, NewApptDraft, NewClientDraft, OnboardingBiz } from './types';

export function defaultOnboardingBiz(): OnboardingBiz {
  return {
    name: '',
    currencyCode: 'USD',
    teamType: 'solo',
    serviceMode: 'suggested',
    serviceDraft: [],
    staffNames: [''],
    hours: 'Tue–Sat, 9:00 AM – 6:00 PM',
    depositPct: 25,
    bufferMin: 15,
  };
}

export function defaultNewClientDraft(): NewClientDraft {
  return { name: '', phone: '', email: '', birthday: '', preferredStaffId: '', allergies: '', notes: '' };
}

export function defaultNewApptDraft(): NewApptDraft {
  return {
    clientId: '',
    serviceIds: [],
    staffId: '',
    date: todayISO(),
    time: '10:00',
    discount: 0,
    deposit: 0,
    notes: '',
    recurring: 'none',
  };
}

export function defaultCheckoutDraft(): CheckoutDraft {
  return { tip: 0, payMethod: 'Card', productSelections: {} };
}

export function defaultRecordPaymentDraft() {
  return { clientId: '', amount: 0, method: 'Card' as const, type: 'full' as const, note: '' };
}
