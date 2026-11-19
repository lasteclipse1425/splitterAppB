import type { Readable } from "node:stream";
import { GoogleGenerativeAI } from "@google/generative-ai";

/** Shape returned to the route */
export interface ParsedReceiptItem {
  id: string; // stable within this response (not DB id)
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number; // unitPrice * quantity (model can supply; we'll verify)
  kind?: string | null; // e.g. fee/tip/discount
  confidence?: number; // 0.0 to 1.0 (1.0 = high confidence)
}

export interface ParseResult {
  items: ParsedReceiptItem[];
  summary: { grandTotal: number; currency: string; tax?: number; tip?: number; subtotal?: number };
  warnings?: string[];
  rawModelText?: string | undefined; // for debugging (only when DEBUG_PARSE=1)
  model?: string | undefined; // which model was used
  durationMs?: number | undefined;
  source: "gemini";
  usedModelVersion?: string | undefined;
  modelsTried?:
    | Array<{
        model: string;
        version: string;
        status: string;
        httpStatus?: number;
        durationMs?: number;
        chars?: number;
        errorMessage?: string;
        errorCode?: string;
      }>
    | undefined;
}

export interface ParseOptions {
  language: string; // BCP-47 like ru-RU, en-US
  sessionName: string;
  mimeType: string;
  imageBase64: string; // no data: prefix, raw base64
}

// Environment-driven configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || "v1";
const GEMINI_MODEL_PARSE = process.env.GEMINI_MODEL_PARSE || "gemini-2.5-flash";
const GEMINI_MODEL_FALLBACKS = (process.env.GEMINI_MODEL_FALLBACKS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ✅ обновлённые кандидаты на основе актуальных моделей (октябрь 2025)
const MODEL_CANDIDATES = Array.from(
  new Set([
    GEMINI_MODEL_PARSE,
    ...GEMINI_MODEL_FALLBACKS,
    // current primary & secondary models
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash-lite-001",
    // fallback older generation still supported in some regions
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ])
);

const DEBUG_PARSE = process.env.DEBUG_PARSE === "1";
let cachedModel: { model: string; version: string } | null = null;
let lastUsedVersion: string | undefined;

const DEFAULT_CURRENCY_CODE = "UNKNOWN";
const SYMBOL_TO_ISO: Record<string, string> = {
  $: "USD",
  USD: "USD",
  US$: "USD",
  "€": "EUR",
  EUR: "EUR",
  "£": "GBP",
  GBP: "GBP",
  "¥": "JPY",
  JPY: "JPY",
  円: "JPY",
  "₽": "RUB",
  RUB: "RUB",
  RUR: "RUB",
  РУБ: "RUB",
  "РУБ.": "RUB",
  "₴": "UAH",
  UAH: "UAH",
  "₩": "KRW",
  KRW: "KRW",
  "₦": "NGN",
  NGN: "NGN",
  "₹": "INR",
  INR: "INR",
  "₺": "TRY",
  TRY: "TRY",
  C$: "CAD",
  CAD: "CAD",
  A$: "AUD",
  AUD: "AUD",
  CHF: "CHF",
  HK$: "HKD",
  HKD: "HKD",
  SG$: "SGD",
  SGD: "SGD",
  ZAR: "ZAR",
};

function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const directUpper = trimmed.toUpperCase();
  if (SYMBOL_TO_ISO[trimmed]) return SYMBOL_TO_ISO[trimmed];
  if (SYMBOL_TO_ISO[directUpper]) return SYMBOL_TO_ISO[directUpper];
  if (/^[A-Z]{3}$/.test(directUpper)) return directUpper;
  const asciiUpper = trimmed.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (SYMBOL_TO_ISO[asciiUpper]) return SYMBOL_TO_ISO[asciiUpper];
  if (/^[A-Z]{3}$/.test(asciiUpper)) return asciiUpper;
  const firstChar = trimmed[0];
  if (firstChar && SYMBOL_TO_ISO[firstChar]) return SYMBOL_TO_ISO[firstChar];
  const lastChar = trimmed[trimmed.length - 1];
  if (lastChar && SYMBOL_TO_ISO[lastChar]) return SYMBOL_TO_ISO[lastChar];
  return null;
}

function extractCurrencyCode(raw: any): string {
  const candidates: unknown[] = [
    raw?.summary?.currency,
    raw?.summary?.currencyCode,
    raw?.summary?.currency_code,
    raw?.summary?.isoCurrency,
    raw?.currency,
    raw?.currencyCode,
    raw?.currency_code,
  ];
  if (Array.isArray(raw?.items)) {
    for (const item of raw.items) {
      candidates.push(item?.currency, item?.currencyCode, item?.currency_code);
    }
  }
  for (const candidate of candidates) {
    const normalized = normalizeCurrencyCode(candidate);
    if (normalized) return normalized;
  }
  return DEFAULT_CURRENCY_CODE;
}

// Extraction JSON schema instruction (lightweight, we rely on LLM following examples)
const EXTRACTION_INSTRUCTIONS = `You are a receipt parser. Return ONLY valid JSON with this shape:
{
  "items": [
    { "id": "string", "name": "string", "unitPrice": number|string, "quantity": number|string, "totalPrice": number|string, "kind": "fee|item|other|null", "confidence": number }
  ],
  "summary": { "grandTotal": number|string, "currency": "ISO_4217", "tax": number|string, "tip": number|string, "subtotal": number|string }
}
Rules:
- Read the whole receipt, including rows split across lines or aligned in separate columns. Keep each purchased line separate, even when names repeat.
- Normalize prices such as "120 020", "120.020", and "120,020" as 120020 for currencies using grouped thousands. Accept decimal amounts such as "1 200,50" as 1200.5. Return numeric values when unambiguous; otherwise return the original numeric text so it can be normalized.
- Recognize quantity forms "2 x ITEM", "ITEM x 2", "2 × 15 000", and weight/volume quantities. For "2 x 15 000", 15 000 is the unit price; when both unit and line total are printed, report both.
- Put only purchased goods and explicitly charged service/fees in items. Mark service charges as kind "fee". Do not turn receipt headers, item-count lines, subtotal/grand total, taxes/VAT/НДС, discounts, change/СДАЧА, payment methods, or store details into items; report available totals/tax/tip in summary instead.
- Join wrapped item names with their adjacent price row when the layout makes the match clear. Do not invent missing names or prices.
- id: generate short stable IDs like "1", "2"... or semantic (e.g. FEE1) unique within list.
- quantity must be positive; preserve fractional weight/volume quantities.
- totalPrice is the printed line total when available, otherwise unitPrice * quantity (round to the currency precision).
- If currency symbol present ignore it when recording numbers.
- Detect the receipt currency (e.g. symbols like $, €, ₽ or textual names) and report the ISO 4217 code in uppercase.
- When unsure about currency, return "UNKNOWN".
- confidence: a number from 0.0 to 1.0; lower it for uncertain row alignment, wrapped names, quantity, or digits.
- summary grandTotal must be the printed amount due, not the sum of item rows. Extract tax, tip, and subtotal when printed; omit unavailable values.`;

function safeParseJson(text: string): { ok: boolean; data?: ParseResult } {
  try {
    const cleaned = unwrapMarkdown(text);
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return { ok: false };
    const jsonSlice = cleaned.slice(firstBrace, lastBrace + 1);
    const raw = JSON.parse(jsonSlice);
    const data = normalizeReceiptPayload(raw);
    return data ? { ok: true, data } : { ok: false };
  } catch {
    return { ok: false };
  }
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Parse receipt numbers without confusing grouped thousands with decimals. */
export function parseReceiptNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  let normalized = value
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/[^\d.,+\-\s]/g, "")
    .trim();
  if (!normalized || !/\d/.test(normalized)) return null;

  const sign = normalized.startsWith("-") ? "-" : "";
  normalized = normalized.replace(/[+\-\s]/g, "");
  const lastSeparator = Math.max(normalized.lastIndexOf("."), normalized.lastIndexOf(","));
  if (lastSeparator < 0) {
    const result = Number(`${sign}${normalized}`);
    return Number.isFinite(result) ? result : null;
  }

  const fractionalDigits = normalized.length - lastSeparator - 1;
  const hasBothSeparators = normalized.includes(".") && normalized.includes(",");
  const hasRepeatedSeparator = /[.,].*[.,]/.test(normalized);
  const isDecimal = fractionalDigits > 0 && fractionalDigits <= 2;
  if (isDecimal && (hasBothSeparators || hasRepeatedSeparator || fractionalDigits <= 2)) {
    const integerPart = normalized.slice(0, lastSeparator).replace(/[.,]/g, "");
    const fractionPart = normalized.slice(lastSeparator + 1);
    const result = Number(`${sign}${integerPart}.${fractionPart}`);
    return Number.isFinite(result) ? result : null;
  }

  const result = Number(`${sign}${normalized.replace(/[.,]/g, "")}`);
  return Number.isFinite(result) ? result : null;
}

function parseReceiptQuantity(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const match = value.match(/^\s*(\d+(?:[.,]\d+)?)\s*(?:[x×]|(?:шт|kg|кг|g|гр?|л|l|ml|мл))?\s*$/i)
    ?? value.match(/^\s*(\d+(?:[.,]\d+)?)\s*[x×]/i);
  if (!match) return null;
  const quantity = parseReceiptNumber(match[1]);
  return quantity !== null && quantity > 0 ? quantity : null;
}

function isNonItemLine(name: string): boolean {
  const normalized = name.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return /^(?:итого|итог|всего|к оплате|сдача|ндс|налог|скидка|стоимость|subtotal|sub total|grand total|total|amount due|change|vat|tax|discount|payment|cash|card|cashier|thank you|receipt|invoice|order|table|стоимость товаров|сумма налога)$/.test(normalized)
    || isServiceFeeLine(name);
}

function isServiceFeeLine(name: string): boolean {
  const normalized = name.toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+\d+(?:[.,]\d+)?$/, "");
  return /^(?:сервис|обслуживание|сервисный сбор|доставка|упаковка|service|service charge|service fee|delivery fee|packaging)$/.test(normalized);
}

export function normalizeReceiptPayload(raw: unknown): ParseResult | null {
  if (!isRecord(raw) || !Array.isArray(raw.items) || !isRecord(raw.summary)) return null;

  const warnings: string[] = [];
  const items: ParsedReceiptItem[] = [];
  for (const [index, rawItem] of raw.items.entries()) {
    if (!isRecord(rawItem)) {
      warnings.push(`Receipt line ${index + 1} could not be read.`);
      continue;
    }

    const name = typeof rawItem.name === "string" ? rawItem.name.trim() : "";
    const kind = typeof rawItem.kind === "string" ? rawItem.kind.toLowerCase() : undefined;
    const excludedKind = ["tax", "tip", "discount", "subtotal", "total", "payment"].includes(kind ?? "");
    const nonItemName = isNonItemLine(name);
    if (!name || excludedKind || (nonItemName && !(kind === "fee" && isServiceFeeLine(name)))) {
      if (name && isServiceFeeLine(name) && kind !== "fee") {
        warnings.push(`Receipt line "${name}" looks like a service fee but was not classified as one; review it.`);
      } else if (name && kind && !excludedKind && !nonItemName) {
        warnings.push(`Receipt line "${name}" was classified as ${kind} and left out of purchased items.`);
      }
      continue;
    }

    const quantity = parseReceiptQuantity(rawItem.quantity ?? 1);
    let unitPrice = parseReceiptNumber(rawItem.unitPrice ?? rawItem.price);
    const printedTotal = parseReceiptNumber(rawItem.totalPrice);
    if (quantity === null) {
      warnings.push(`Quantity for "${name}" could not be read; review this item.`);
      continue;
    }
    if (unitPrice === null && printedTotal !== null) unitPrice = printedTotal / quantity;
    if (unitPrice === null || unitPrice < 0 || !Number.isFinite(unitPrice)) {
      warnings.push(`Price for "${name}" could not be read; review this item.`);
      continue;
    }

    let totalPrice = printedTotal ?? unitPrice * quantity;
    let confidence = typeof rawItem.confidence === "number" && Number.isFinite(rawItem.confidence)
      ? Math.min(1, Math.max(0, rawItem.confidence))
      : 0.75;
    if (printedTotal !== null && Math.abs(printedTotal - unitPrice * quantity) > 0.02) {
      warnings.push(`Unit price and line total did not match for "${name}"; the printed line total was used.`);
      unitPrice = printedTotal / quantity;
      confidence = Math.min(confidence, 0.65);
      totalPrice = printedTotal;
    }
    if (totalPrice < 0 || !Number.isFinite(totalPrice)) {
      warnings.push(`Total for "${name}" could not be read; review this item.`);
      continue;
    }

    items.push({
      id: String(rawItem.id ?? index + 1),
      name,
      unitPrice: round2(unitPrice),
      quantity,
      totalPrice: round2(totalPrice),
      ...(kind ? { kind } : {}),
      confidence,
    });
  }

  if (items.length === 0) return null;
  const rawSummary = raw.summary;
  const grandTotal = parseReceiptNumber(rawSummary.grandTotal)
    ?? round2(items.reduce((sum, item) => sum + item.totalPrice, 0));
  const summary: ParseResult["summary"] = {
    grandTotal: round2(grandTotal),
    currency: extractCurrencyCode(raw),
  };
  const tax = parseReceiptNumber(rawSummary.tax);
  const tip = parseReceiptNumber(rawSummary.tip);
  const subtotal = parseReceiptNumber(rawSummary.subtotal);
  if (tax !== null && tax >= 0) summary.tax = round2(tax);
  if (tip !== null && tip >= 0) summary.tip = round2(tip);
  if (subtotal !== null && subtotal >= 0) summary.subtotal = round2(subtotal);

  return {
    items,
    summary,
    warnings: [...new Set(warnings)],
    source: "gemini",
  };
}

function unwrapMarkdown(t: string): string {
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && typeof fence[1] === "string") return fence[1].trim();
  return t.trim();
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function parseReceipt(
  options: ParseOptions
): Promise<ParseResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("Receipt scanning is unavailable: OCR API key is not configured.");
  }

  if (DEBUG_PARSE && !/^AIza[0-9A-Za-z_-]{10,}$/.test(GEMINI_API_KEY)) {
    console.warn(
      "[parseReceipt] GEMINI_API_KEY format unexpected (should usually start with 'AIza')."
    );
  }
  const dynamicCandidates = cachedModel
    ? [
        cachedModel.model,
        ...MODEL_CANDIDATES.filter((m) => m !== cachedModel!.model),
      ]
    : MODEL_CANDIDATES.slice();
  if (DEBUG_PARSE) {
    console.log(
      `[parseReceipt] REST mode; preferred version=${GEMINI_API_VERSION}; cached=${
        cachedModel ? cachedModel.model + "@" + cachedModel.version : "none"
      }; candidates=${dynamicCandidates.join(",")}`
    );
  }
  const prompt = `${EXTRACTION_INSTRUCTIONS}\nLanguage context of receipt: ${options.language}\nSession Name: ${options.sessionName}`;
  const imagePart = {
    inlineData: {
      data: options.imageBase64,
      mimeType: options.mimeType,
    },
  } as const;

  let lastError: unknown = null;
  const modelsTried: NonNullable<ParseResult["modelsTried"]> = [];
  for (const modelName of dynamicCandidates) {
    const start = Date.now();
    try {
      if (DEBUG_PARSE) console.log(`[parseReceipt] Trying model: ${modelName}`);
      const text = await generateViaRest(
        modelName,
        prompt,
        imagePart.inlineData.data,
        imagePart.inlineData.mimeType
      );
      const parsed = safeParseJson(text);
      if (!parsed.ok || !parsed.data) {
        if (DEBUG_PARSE) {
          console.warn(
            `[parseReceipt] Model ${modelName} returned non-parseable JSON, length=${text.length}. Snippet=`,
            text.slice(0, 280)
          );
        }
        modelsTried.push({
          model: modelName,
          version: lastUsedVersion || "?",
          status: "parse_fail",
          durationMs: Date.now() - start,
          chars: text.length,
        });
        continue; // try next model
      }
      const durationMs = Date.now() - start;
      const truncated = DEBUG_PARSE
        ? text.length > 4000
          ? text.slice(0, 4000) + `\n/* trimmed ${text.length - 4000} chars */`
          : text
        : undefined;
      const result: ParseResult = {
        ...parsed.data,
        model: modelName,
        durationMs,
        rawModelText: truncated,
        usedModelVersion: lastUsedVersion,
        modelsTried: DEBUG_PARSE
          ? [
              ...modelsTried,
              {
                model: modelName,
                version: lastUsedVersion || "?",
                status: "ok",
                durationMs,
                chars: text.length,
              },
            ]
          : undefined,
      };
      if (!cachedModel) {
        cachedModel = { model: modelName, version: lastUsedVersion || "v1" };
        if (DEBUG_PARSE)
          console.log(
            `[parseReceipt] Caching model ${cachedModel.model}@${cachedModel.version}`
          );
      }
      return result;
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.statusCode;
      if (DEBUG_PARSE)
        console.warn(
          `[parseReceipt] Error with model ${modelName} (status=${status}) → ${
            err?.message || err
          }`
        );
      modelsTried.push({
        model: modelName,
        version: lastUsedVersion || "?",
        status: status ? "http_error" : "exception",
        httpStatus: status,
        durationMs: Date.now() - start,
        errorMessage: err?.apiError?.message || err?.message,
        errorCode: err?.apiError?.code,
      });
      continue;
    }
  }
  if (DEBUG_PARSE)
    console.error("[parseReceipt] All model attempts failed:", lastError);
  throw new Error("Could not read this receipt. Please take a clearer photo and try again.");
}

async function generateViaRest(
  model: string,
  prompt: string,
  base64: string,
  mime: string
): Promise<string> {
  const order = ["v1"]; // 🔧 always use v1, no v1beta anymore
  let lastErr: any = null;
  for (const ver of order) {
    const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${encodeURIComponent(
      GEMINI_API_KEY as string
    )}`;
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: `${prompt}\nOUTPUT ONLY RAW JSON. NO MARKDOWN.` },
            { inlineData: { data: base64, mimeType: mime } },
          ],
        },
      ],
      generationConfig: { temperature: 0.1 },
    };
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        let errorPayload: any = undefined;
        try {
          const txt = await resp.text();
          if (txt) {
            try {
              const parsed = JSON.parse(txt);
              errorPayload = parsed.error || parsed;
            } catch {
              errorPayload = { raw: txt.slice(0, 500) };
            }
          }
        } catch {}
        if (DEBUG_PARSE) {
          const code = errorPayload?.code || resp.status;
          const msg = errorPayload?.message || resp.statusText;
          console.warn(
            `[generateViaRest] ${ver} ${model} -> HTTP ${resp.status} (${code}) ${msg}`
          );
          if (errorPayload?.status && errorPayload?.status !== code) {
            console.warn(
              `[generateViaRest] API error status field: ${errorPayload.status}`
            );
          }
        }
        lastErr = Object.assign(
          new Error(
            `HTTP ${resp.status} ${errorPayload?.message || resp.statusText}`
          ),
          {
            status: resp.status,
            apiError: errorPayload,
          }
        );
        continue;
      }
      const json = await resp.json();
      const texts: string[] = [];
      if (Array.isArray(json.candidates)) {
        for (const cand of json.candidates) {
          const parts = cand?.content?.parts || cand?.parts || [];
          for (const p of parts) if (p.text) texts.push(p.text);
        }
      }
      const combined = texts.join("\n").trim();
      if (DEBUG_PARSE)
        console.log(
          `[generateViaRest] success via ${ver} model=${model} chars=${combined.length}`
        );
      return combined;
    } catch (e) {
      lastErr = e;
      if (DEBUG_PARSE)
        console.warn(`[generateViaRest] Error calling ${ver} ${model}:`, e);
      continue;
    }
  }
  throw lastErr || new Error("All versions failed");
}
