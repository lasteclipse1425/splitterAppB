export const CURRENCY_OPTIONS = [
  { code: 'UZS', symbol: 'soʻm', name: 'Uzbekistani som' },
  { code: 'USD', symbol: '$', name: 'US dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'RUB', symbol: '₽', name: 'Russian ruble' },
  { code: 'GBP', symbol: '£', name: 'British pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese yen' },
  { code: 'KZT', symbol: '₸', name: 'Kazakhstani tenge' },
  { code: 'CNY', symbol: '¥', name: 'Chinese yuan' },
  { code: 'TRY', symbol: '₺', name: 'Turkish lira' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE dirham' },
  { code: 'KRW', symbol: '₩', name: 'South Korean won' },
  { code: 'INR', symbol: '₹', name: 'Indian rupee' },
] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]['code'];

export function formatCurrencyAmount(value: number, currency: string): string {
  const safeCurrency = /^[A-Z]{3}$/.test(currency) ? currency : 'UZS';
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCurrency,
      currencyDisplay: 'code',
    }).formatToParts(Number.isFinite(value) ? value : 0);
    return parts
      .filter((part) => ['integer', 'group', 'decimal', 'fraction'].includes(part.type))
      .map((part) => part.value)
      .join('');
  } catch {
    return Math.round(value).toLocaleString('en-US');
  }
}
