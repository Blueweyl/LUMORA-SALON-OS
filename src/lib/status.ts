import type { AppointmentStatus } from '../types';

export const STATUS_META: Record<AppointmentStatus, { label: string; bg: string; color: string }> = {
  unconfirmed: { label: 'Unconfirmed', bg: 'var(--color-warn-100)', color: 'var(--color-warn-600)' },
  confirmed: { label: 'Confirmed', bg: 'var(--color-plum-100)', color: 'var(--color-plum-600)' },
  'checked-in': { label: 'Checked In', bg: 'oklch(93% 0.03 230)', color: 'oklch(45% 0.10 230)' },
  'in-service': { label: 'In Service', bg: 'var(--color-good-100)', color: 'var(--color-good-600)' },
  completed: { label: 'Completed', bg: 'var(--color-ivory-300)', color: 'var(--color-ink-500)' },
  cancelled: { label: 'Cancelled', bg: 'var(--color-bad-100)', color: 'var(--color-bad-600)' },
  'no-show': { label: 'No-Show', bg: 'var(--color-bad-100)', color: 'var(--color-bad-600)' },
};

export function statusMeta(s: AppointmentStatus) {
  return STATUS_META[s];
}
