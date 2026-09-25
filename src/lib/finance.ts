import type { Appointment, Client, GiftCard, Payment, PointsEntry } from '../types';
import { makeId } from './id';
import { todayISO } from './dates';

/**
 * Money rules shared by checkout, Record Payment, voids and reports, so every
 * screen agrees on what was paid, what is owed and what counts as money in.
 *
 * - A visit's paid amount = its non-voided payments minus tips.
 * - Paying from a gift card / store credit settles a bill but is NOT new money:
 *   the money came in when the card was sold (or the deposit was taken).
 * - Voided payments stay on record and are excluded everywhere.
 */

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Payments that brought new money into the business (cash/card, not voided). */
export function isMoneyIn(p: Payment): boolean {
  return !p.voided && p.method !== 'Gift card';
}

export function isUsableCard(card: GiftCard | undefined): card is GiftCard {
  return Boolean(card && !card.voided && card.balance > 0.004);
}

/** A gift card is untouched when nothing has been spent from it (so its sale can be voided cleanly). */
export function isUntouchedCard(card: GiftCard): boolean {
  return !card.voided && Math.abs(card.balance - card.initialValue) < 0.005;
}

export function newCardCode(existing: GiftCard[], prefix = 'LUM'): string {
  const used = new Set(existing.map((c) => c.code.toUpperCase()));
  for (let i = 0; i < 200; i++) {
    const code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!used.has(code)) return code;
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export function findCardByCode(cards: GiftCard[], code: string): GiftCard | undefined {
  const q = code.trim().toUpperCase();
  return q ? cards.find((c) => c.code.toUpperCase() === q) : undefined;
}

/** Payments recorded twice by accident: same client, visit, amount, type and method on the same day, within 10 minutes. */
export function findDuplicatePayment(payments: Payment[], p: Pick<Payment, 'clientId' | 'apptId' | 'amount' | 'type' | 'method'>, now = new Date()): Payment | undefined {
  const today = todayISO();
  return payments.find((x) => {
    if (x.voided || x.date !== today) return false;
    if (x.clientId !== p.clientId || (x.apptId || null) !== (p.apptId || null) || Math.abs(x.amount - p.amount) > 0.004 || x.type !== p.type || x.method !== p.method) return false;
    if (!x.createdAt) return true;
    return now.getTime() - new Date(x.createdAt).getTime() < 10 * 60 * 1000;
  });
}

/** Adds (or removes) loyalty points and records why, newest first. */
export function withPoints(c: Client, delta: number, reason: string, apptId?: string): Client {
  if (!delta) return c;
  const entry: PointsEntry = { id: makeId('pt'), date: todayISO(), delta, reason, ...(apptId ? { apptId } : {}) };
  return { ...c, loyaltyPoints: Math.max(0, c.loyaltyPoints + delta), pointsLog: [entry, ...(c.pointsLog || [])].slice(0, 300) };
}

export const OPEN_STATUSES: Appointment['status'][] = ['unconfirmed', 'confirmed', 'checked-in', 'in-service'];

export function paymentLabel(p: Pick<Payment, 'type' | 'method'>): string {
  if (p.type === 'gift-card') return 'gift card sale';
  if (p.method === 'Gift card') return 'paid from gift card / credit';
  return p.type === 'full' ? 'payment' : p.type.replace('-', ' ');
}
