import type { Service } from '../types';

export function serviceCost(sv: Pick<Service, 'materials' | 'laborHours' | 'hourlyRate' | 'overhead'>): number {
  return sv.materials + sv.laborHours * sv.hourlyRate + sv.overhead;
}

export function serviceProfit(price: number, cost: number): number {
  return price - cost;
}

export function serviceMargin(price: number, cost: number): number {
  if (price <= 0) return 0;
  return (price - cost) / price;
}

export function suggestedPrice(cost: number, targetMargin: number): number {
  if (targetMargin >= 1) return Infinity;
  return cost / (1 - targetMargin);
}
