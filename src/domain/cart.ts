export type CartLine = {
  gameId: string;
  title: string;
  priceCents: number;
  currency: string;
  coverPath: string | null;
};

export type CartSummary = {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: string | null;
  mixedCurrency: boolean;
};

export function summarizeCart(lines: CartLine[], requestedDiscountCents: number): CartSummary {
  const currencies = new Set(lines.map((line) => line.currency.toLowerCase()));
  const subtotalCents = lines.reduce((sum, line) => sum + Math.max(0, line.priceCents), 0);
  const discountCents = Math.min(Math.max(0, Math.floor(requestedDiscountCents)), subtotalCents);
  return {
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
    currency: currencies.size === 1 ? [...currencies][0] : null,
    mixedCurrency: currencies.size > 1,
  };
}

export function aggregateRevenue(
  orders: { createdAt: string; totalCents: number; currency: string }[],
): { month: string; currency: string; totalCents: number; count: number }[] {
  const buckets = new Map<string, { month: string; currency: string; totalCents: number; count: number }>();
  for (const order of orders) {
    const month = order.createdAt.slice(0, 7);
    const currency = order.currency.toLowerCase();
    const key = `${month}:${currency}`;
    const current = buckets.get(key) ?? { month, currency, totalCents: 0, count: 0 };
    current.totalCents += order.totalCents;
    current.count += 1;
    buckets.set(key, current);
  }
  return [...buckets.values()].sort((a, b) => b.month.localeCompare(a.month) || a.currency.localeCompare(b.currency));
}
