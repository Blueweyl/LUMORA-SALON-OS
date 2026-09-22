import type { VipTier } from '../types';

export function tierForPoints(points: number): VipTier {
  if (points >= 1800) return 'platinum';
  if (points >= 900) return 'gold';
  if (points >= 300) return 'silver';
  return 'none';
}

export const TIER_LABEL: Record<VipTier, string> = {
  none: '',
  silver: 'SILVER',
  gold: 'GOLD',
  platinum: 'PLATINUM',
};

export const TIER_COLORS: Record<VipTier, { bg: string; text: string }> = {
  none: { bg: 'transparent', text: 'transparent' },
  silver: { bg: 'oklch(93% 0.008 250)', text: 'oklch(45% 0.02 250)' },
  gold: { bg: 'var(--color-gold-100)', text: 'var(--color-gold-600)' },
  platinum: { bg: 'var(--color-plum-100)', text: 'var(--color-plum-600)' },
};

export function pointsForSpend(amount: number): number {
  return Math.floor(amount);
}
