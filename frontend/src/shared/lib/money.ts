export type CurrencyCode = 'UZS' | 'USD' | 'JPY';

export type CurrencyMeta = {
  code: CurrencyCode;
  /** Symbol shown to the user */
  symbol: string;
  /** Short label for selectors */
  label: string;
  /** Number of fraction digits (USD=2, UZS/JPY=0) */
  decimals: number;
  /** Where the symbol sits relative to the number */
  symbolPosition: 'prefix' | 'suffix';
  /** Locale used for digit grouping */
  locale: string;
};

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  UZS: {
    code: 'UZS',
    symbol: "so'm",
    label: "so'm",
    decimals: 0,
    symbolPosition: 'suffix',
    locale: 'ru-RU',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    label: '$',
    decimals: 2,
    symbolPosition: 'prefix',
    locale: 'en-US',
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    label: '¥',
    decimals: 0,
    symbolPosition: 'prefix',
    locale: 'ja-JP',
  },
};

export const SUPPORTED_CURRENCIES: CurrencyCode[] = ['UZS', 'USD', 'JPY'];

export const DEFAULT_CURRENCY: CurrencyCode = 'UZS';

/** Type guard for a supported currency code. */
export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && (SUPPORTED_CURRENCIES as string[]).includes(value);
}

// Map common ISO codes / symbols to one of the supported currencies.
const ALIAS_TO_SUPPORTED: Record<string, CurrencyCode> = {
  UZS: 'UZS',
  "SO'M": 'UZS',
  SOM: 'UZS',
  СУМ: 'UZS',
  USD: 'USD',
  US$: 'USD',
  $: 'USD',
  JPY: 'JPY',
  YEN: 'JPY',
  '¥': 'JPY',
  円: 'JPY',
};

/**
 * Normalize any detected currency (ISO code, symbol, name) to one of the
 * supported currencies. Falls back to the provided default when unknown.
 */
export function normalizeToSupported(
  value: unknown,
  fallback: CurrencyCode = DEFAULT_CURRENCY
): CurrencyCode {
  if (isSupportedCurrency(value)) return value;
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const upper = trimmed.toUpperCase();
  if (ALIAS_TO_SUPPORTED[trimmed]) return ALIAS_TO_SUPPORTED[trimmed];
  if (ALIAS_TO_SUPPORTED[upper]) return ALIAS_TO_SUPPORTED[upper];

  const firstChar = trimmed[0];
  if (firstChar && ALIAS_TO_SUPPORTED[firstChar]) return ALIAS_TO_SUPPORTED[firstChar];

  return fallback;
}

/** Resolve metadata for any value, normalizing unknown input. */
export function getCurrencyMeta(value: unknown, fallback: CurrencyCode = DEFAULT_CURRENCY): CurrencyMeta {
  return CURRENCIES[normalizeToSupported(value, fallback)];
}

/** Round an amount to the precision appropriate for the given currency. */
export function roundForCurrency(amount: number, currency: unknown): number {
  if (!Number.isFinite(amount)) return 0;
  const { decimals } = getCurrencyMeta(currency);
  if (decimals === 0) return Math.round(amount);
  const factor = 10 ** decimals;
  return Math.round(amount * factor) / factor;
}

type FormatOptions = {
  /** Include the currency symbol (default true). */
  withSymbol?: boolean;
};

/**
 * Format a numeric amount according to the currency rules:
 * - USD: "$1,234.50"
 * - JPY: "¥1,200"
 * - UZS: "15 000 so'm"
 */
export function formatMoney(
  amount: number,
  currency: unknown,
  options: FormatOptions = {}
): string {
  const { withSymbol = true } = options;
  const meta = getCurrencyMeta(currency);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  let formatted: string;
  try {
    formatted = new Intl.NumberFormat(meta.locale, {
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    }).format(safeAmount);
  } catch {
    formatted = roundForCurrency(safeAmount, meta.code).toFixed(meta.decimals);
  }

  if (!withSymbol) return formatted;

  return meta.symbolPosition === 'prefix'
    ? `${meta.symbol}${formatted}`
    : `${formatted} ${meta.symbol}`;
}

/** Split a formatted amount into symbol + number parts (for emphasized UI). */
export function getMoneyParts(
  amount: number,
  currency: unknown
): { symbol: string; amount: string; symbolPosition: 'prefix' | 'suffix' } {
  const meta = getCurrencyMeta(currency);
  return {
    symbol: meta.symbol,
    amount: formatMoney(amount, currency, { withSymbol: false }),
    symbolPosition: meta.symbolPosition,
  };
}
