const CURRENCIES = new Set(['brl', 'usd']);

export function formatMoney(cents: number, currency: string): string {
  const code = currency.toLowerCase();
  const amount = Number.isFinite(cents) ? cents / 100 : 0;
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: code.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code.toUpperCase()}`;
  }
}

export function parsePriceToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  return cents;
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function isSupportedCurrency(currency: string): boolean {
  return CURRENCIES.has(currency.toLowerCase());
}
