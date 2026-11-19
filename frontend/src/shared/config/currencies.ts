export const CURRENCY_OPTIONS = [
  { code: 'UZS', symbol: 'soʻm', name: 'Uzbekistani som', decimals: 0 },
  { code: 'USD', symbol: '$', name: 'US dollar', decimals: 2 },
  { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2 },
  { code: 'RUB', symbol: '₽', name: 'Russian ruble', decimals: 2 },
  { code: 'GBP', symbol: '£', name: 'British pound', decimals: 2 },
  { code: 'JPY', symbol: '¥', name: 'Japanese yen', decimals: 0 },
  { code: 'KZT', symbol: '₸', name: 'Kazakhstani tenge', decimals: 0 },
  { code: 'CNY', symbol: '¥', name: 'Chinese yuan', decimals: 2 },
  { code: 'TRY', symbol: '₺', name: 'Turkish lira', decimals: 2 },
  { code: 'AED', symbol: 'د.إ', name: 'UAE dirham', decimals: 2 },
  { code: 'KRW', symbol: '₩', name: 'South Korean won', decimals: 0 },
  { code: 'INR', symbol: '₹', name: 'Indian rupee', decimals: 2 },
] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]['code'];

export function roundCurrencyAmount(value: number, currency: string): number {
  const decimals = CURRENCY_OPTIONS.find((option) => option.code === currency)?.decimals ?? 2;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Zero-decimal currencies that shouldn't show fractional digits. */
const ZERO_DECIMAL = new Set(['UZS', 'JPY', 'KRW', 'KZT', 'VND', 'CLP', 'ISK', 'HUF']);

/**
 * Format a numeric amount for display in the given currency.
 * Returns only the number portion (no currency code / symbol).
 *
 * Examples:
 *   formatCurrencyAmount(120020, 'UZS') → '120,020'
 *   formatCurrencyAmount(9.46, 'USD')   → '9.46'
 */
export function formatCurrencyAmount(value: number, currency: string): string {
  const safeCurrency = /^[A-Z]{3}$/.test(currency) ? currency : 'UZS';
  const isZeroDecimal = ZERO_DECIMAL.has(safeCurrency);
  const safeValue = Number.isFinite(value) ? value : 0;

  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCurrency,
      currencyDisplay: 'code',
      minimumFractionDigits: isZeroDecimal ? 0 : 2,
      maximumFractionDigits: isZeroDecimal ? 0 : 2,
    }).formatToParts(safeValue);

    return parts
      .filter((part) => ['integer', 'group', 'decimal', 'fraction'].includes(part.type))
      .map((part) => part.value)
      .join('');
  } catch {
    return isZeroDecimal
      ? Math.round(safeValue).toLocaleString('en-US')
      : safeValue.toFixed(2);
  }
}

/**
 * Format with currency symbol (e.g. "$9.46" or "120,020 soʻm").
 */
export function formatWithSymbol(value: number, currencyCode: string): string {
  const option = CURRENCY_OPTIONS.find((o) => o.code === currencyCode);
  const formatted = formatCurrencyAmount(value, currencyCode);
  if (!option) return `${currencyCode} ${formatted}`;

  // For symbol-prefix currencies
  if (['$', '€', '£', '¥', '₩', '₹', '₺', '₸', '₽'].includes(option.symbol)) {
    return `${option.symbol}${formatted}`;
  }
  return `${formatted} ${option.symbol}`;
}
