/**
 * Currency conversion engine with live rates, cached real rates, and explicit overrides.
 *
 * Usage:
 *   const converter = CurrencyConverter.getInstance();
 *   await converter.refreshRates();              // fetch once on app start
 *   converter.convert(120_020, 'UZS', 'USD');    // uses the current cached/live rate
 *   converter.formatConverted(120_020, 'UZS', 'USD');
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Rates are stored relative to USD (1 USD = X units of currency). */
export type ExchangeRates = Record<string, number>;

const configuredOverrides = parseRateOverrides(process.env.EXPO_PUBLIC_EXCHANGE_RATE_OVERRIDES);
const EMPTY_RATES: ExchangeRates = { USD: 1 };

const CACHE_KEY = 'exchange_rates_cache';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CachedRates {
  version: 2;
  rates: ExchangeRates;
  fetchedAt: number; // epoch ms
  source: string;
}

export class CurrencyConverter {
  private static instance: CurrencyConverter;

  private rates: ExchangeRates = { ...EMPTY_RATES, ...configuredOverrides };
  private fetchedAt = 0;
  private source = Object.keys(configuredOverrides).length ? 'manual override' : 'unavailable';
  private refreshPromise: Promise<void> | null = null;
  private listeners: Set<() => void> = new Set();
  private snapshot = {
    rates: { ...this.rates },
    source: this.source,
    fetchedAt: this.fetchedAt,
  };

  private constructor() {}

  static getInstance(): CurrencyConverter {
    if (!CurrencyConverter.instance) {
      CurrencyConverter.instance = new CurrencyConverter();
    }
    return CurrencyConverter.instance;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Subscribe to rate changes (for React hooks). Returns unsubscribe fn. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Current rates snapshot for external use. */
  getSnapshot(): { rates: ExchangeRates; source: string; fetchedAt: number } {
    return this.snapshot;
  }

  /** Convert an amount between two currencies. */
  convert(amount: number, from: string, to: string): number {
    if (!Number.isFinite(amount)) throw new Error('Cannot convert a non-finite amount.');
    if (from === to) return amount;
    const fromRate = this.rates[from];
    const toRate = this.rates[to];
    if (!fromRate || !toRate) {
      throw new Error(`Exchange rate unavailable for ${from} to ${to}.`);
    }
    // amount is in `from` → convert to USD → convert to `to`
    const usdAmount = amount / fromRate;
    return usdAmount * toRate;
  }

  /** Convert and format with the target currency's locale rules. */
  formatConverted(amount: number, from: string, to: string): string {
    const converted = this.convert(amount, from, to);
    return this.format(converted, to);
  }

  /** Format a number in the given currency. */
  format(amount: number, currency: string): string {
    const safeCurrency = /^[A-Z]{3}$/.test(currency) ? currency : 'USD';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: safeCurrency,
        minimumFractionDigits: isZeroDecimalCurrency(safeCurrency) ? 0 : 2,
        maximumFractionDigits: isZeroDecimalCurrency(safeCurrency) ? 0 : 2,
      }).format(Number.isFinite(amount) ? amount : 0);
    } catch {
      return `${safeCurrency} ${Math.round(amount).toLocaleString('en-US')}`;
    }
  }

  /** Get the exchange rate between two currencies (from → to). */
  getRate(from: string, to: string): number | null {
    if (from === to) return 1;
    const fromRate = this.rates[from];
    const toRate = this.rates[to];
    if (!fromRate || !toRate || !Number.isFinite(fromRate) || !Number.isFinite(toRate)) return null;
    return toRate / fromRate;
  }

  /** Format a rate without hiding small values behind currency minor-unit rounding. */
  formatRate(rate: number): string {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 8,
      minimumFractionDigits: 4,
    }).format(rate);
  }

  /** Is data stale? */
  isStale(): boolean {
    return Date.now() - this.fetchedAt > CACHE_TTL_MS;
  }

  // ── Refresh logic ─────────────────────────────────────────────────────────

  /** Initialize: load from cache, then try live fetch in background. */
  async initialize(): Promise<void> {
    await this.loadFromCache();
    await this.refreshRates();
  }

  /** Fetch live rates. Deduplicates concurrent calls. */
  async refreshRates(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this._fetchLive().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async loadFromCache(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const cached: CachedRates = JSON.parse(raw);
      if (cached.version === 2 && isValidRates(cached.rates) && typeof cached.fetchedAt === 'number') {
        this.rates = { ...cached.rates, ...configuredOverrides, USD: 1 };
        this.fetchedAt = cached.fetchedAt;
        this.source = Object.keys(configuredOverrides).length
          ? `cached ${cached.source} + manual override`
          : `cached ${cached.source}`;
        this.notify();
      }
    } catch {
      // cache corrupt → ignore
    }
  }

  private async saveToCache(rates: ExchangeRates, source: string): Promise<void> {
    try {
      const payload: CachedRates = {
        version: 2,
        rates,
        fetchedAt: this.fetchedAt,
        source,
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {
      // non-critical
    }
  }

  private async _fetchLive(): Promise<void> {
    const apis: Array<() => Promise<{ rates: ExchangeRates; provider: string } | null>> = [
      () => this.fetchFromOpenExchangeRates(),
      () => this.fetchFromExchangeRateAPI(),
    ];

    for (const fetchFn of apis) {
      try {
        const fetched = await fetchFn();
        if (fetched && isValidRates(fetched.rates)) {
          this.rates = { ...fetched.rates, ...configuredOverrides, USD: 1 };
          this.fetchedAt = Date.now();
          this.source = Object.keys(configuredOverrides).length
            ? `${fetched.provider} + manual override`
            : fetched.provider;
          await this.saveToCache(fetched.rates, fetched.provider);
          this.notify();
          return;
        }
      } catch {
        continue;
      }
    }
    // Keep only a real cached rate or an explicitly configured manual override.
  }

  private async fetchFromExchangeRateAPI(): Promise<{ rates: ExchangeRates; provider: string } | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(
        'https://api.exchangerate-api.com/v4/latest/USD',
        { signal: controller.signal }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.base === 'USD' && isValidRates(data?.rates)
        ? { rates: data.rates, provider: 'ExchangeRate-API' }
        : null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchFromOpenExchangeRates(): Promise<{ rates: ExchangeRates; provider: string } | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(
        'https://open.er-api.com/v6/latest/USD',
        { signal: controller.signal }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.result === 'success' && data?.base_code === 'USD' && isValidRates(data?.rates)
        ? { rates: data.rates, provider: 'open.er-api.com' }
        : null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private notify(): void {
    this.snapshot = {
      rates: { ...this.rates },
      source: this.source,
      fetchedAt: this.fetchedAt,
    };
    this.listeners.forEach((fn) => {
      try { fn(); } catch {}
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidRates(value: unknown): value is ExchangeRates {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rates = value as Record<string, unknown>;
  return typeof rates.USD === 'number'
    && Object.entries(rates).every(([code, rate]) => /^[A-Z]{3}$/.test(code) && typeof rate === 'number' && Number.isFinite(rate) && rate > 0);
}

function parseRateOverrides(raw: string | undefined): ExchangeRates {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Expected a JSON object of currency codes and USD-relative rates.');
    }
    const overrides: ExchangeRates = {};
    for (const [rawCode, value] of Object.entries(parsed)) {
      const code = rawCode.toUpperCase();
      if (code === 'USD') continue;
      if (!/^[A-Z]{3}$/.test(code) || typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid exchange-rate override for ${rawCode}.`);
      }
      overrides[code] = value;
    }
    return overrides;
  } catch (error) {
    console.warn('[CurrencyConverter] Ignoring invalid EXPO_PUBLIC_EXCHANGE_RATE_OVERRIDES.', error);
    return {};
  }
}

function isZeroDecimalCurrency(code: string): boolean {
  return ['UZS', 'JPY', 'KRW', 'KZT', 'VND', 'CLP', 'ISK', 'HUF'].includes(code);
}

// ── React Hook ────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

/** React hook that returns the converter and re-renders on rate changes. */
export function useCurrencyConverter() {
  const converter = useMemo(() => CurrencyConverter.getInstance(), []);
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      converter.initialize();
    }
  }, [converter]);

  // Re-render when rates change
  const subscribe = useCallback(
    (onStoreChange: () => void) => converter.subscribe(onStoreChange),
    [converter]
  );
  const getSnapshot = useCallback(() => converter.getSnapshot(), [converter]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const convert = useCallback(
    (amount: number, from: string, to: string) => converter.convert(amount, from, to),
    [converter]
  );

  const formatConverted = useCallback(
    (amount: number, from: string, to: string) => converter.formatConverted(amount, from, to),
    [converter]
  );

  const format = useCallback(
    (amount: number, currency: string) => converter.format(amount, currency),
    [converter]
  );

  const getRate = useCallback(
    (from: string, to: string) => converter.getRate(from, to),
    [converter]
  );

  const formatRate = useCallback((rate: number) => converter.formatRate(rate), [converter]);
  const refresh = useCallback(() => converter.refreshRates(), [converter]);

  return {
    convert,
    formatConverted,
    format,
    getRate,
    formatRate,
    refresh,
    source: snapshot.source,
    fetchedAt: snapshot.fetchedAt,
    isStale: converter.isStale(),
  };
}
