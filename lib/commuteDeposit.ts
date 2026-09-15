// Final KRW invoice total after additions/discounts; PHP local charges are separate.
export function commuteDeposit(total: number): number {
  return Number.isFinite(total) ? Math.round(Math.max(0, total) * 0.3) : 0;
}
