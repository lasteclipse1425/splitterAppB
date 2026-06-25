import { apiClient } from '@/features/auth/api';

export type ReceiptImagePayload = {
  mimeType: string;
  data: string; // base64 without data URI prefix
};

export interface ParseReceiptRequest {
  sessionName: string;
  language: string;
  image: ReceiptImagePayload;
}

export type ParsedReceiptItemKind = 'item' | 'fee' | 'discount' | string;

export interface ParsedReceiptItem {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  kind?: ParsedReceiptItemKind;
  confidence?: number;
}

export interface ReceiptSummary {
  grandTotal: number;
  currency?: string; // ✅ Валюта в summary
  tax?: number;
  tip?: number;
  subtotal?: number;
  [key: string]: unknown;
}

export interface ParseReceiptResponse {
  sessionId: number;
  sessionName: string;
  language: string;
  items: ParsedReceiptItem[];
  summary?: ReceiptSummary;
  source?: 'gemini' | 'mock';
  _parseMeta?: {
    source?: string;
    model?: string;
    durationMs?: number;
    modelsTried?: unknown[];
  };
}

export type ReceiptParticipant = {
  uniqueId: string;
  username: string;
};

export type ReceiptSplitMode = 'equal' | 'count';

export interface FinalizeReceiptItemPayload {
  id: string;
  name: string;
  price: number;
  quantity: number;
  kind?: ParsedReceiptItemKind;
  splitMode: ReceiptSplitMode;
  assignedTo?: string[];
  perPersonCount?: Record<string, number>;
}

export interface FinalizeReceiptRequest {
  sessionId: number;
  sessionName: string;
  participants: ReceiptParticipant[];
  items: FinalizeReceiptItemPayload[];
  currency?: string; // ✅ Добавьте валюту в запрос
}

export interface FinalizeTotalsByParticipant {
  uniqueId: string;
  username: string;
  amountOwed: number;
}

export interface FinalizeTotalsByItem {
  itemId: string;
  name: string;
  total: number;
}

export interface ReceiptAllocation {
  itemId: string;
  participantId: string;
  shareAmount: number;
  shareUnits?: number;
  shareRatio?: number;
}

export interface FinalizeReceiptResponse {
  sessionId: number;
  sessionName: string;
  status: string;
  createdAt: string;
  totals: {
    grandTotal: number;
    currency?: string; // ✅ Добавьте валюту в ответ
    byParticipant?: FinalizeTotalsByParticipant[];
    byItem?: FinalizeTotalsByItem[];
  };
  allocations?: ReceiptAllocation[];
}

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  return new Error('Unexpected error');
};

export interface CreateSessionResponse {
  id: number;
}

export const ReceiptApi = {
  async createSession(): Promise<CreateSessionResponse> {
    try {
      const { data } = await apiClient.post<CreateSessionResponse>('/sessions', {});
      return data;
    } catch (error) {
      console.error('[API] Error (createSession):', error);
      throw normalizeError(error);
    }
  },

  async parse(payload: ParseReceiptRequest): Promise<ParseReceiptResponse> {
    try {
      // console.log('[API] POST /sessions/scan');
      // console.log('[API] Request data:', JSON.stringify(payload, null, 2));

      const { data } = await apiClient.post<ParseReceiptResponse>('/sessions/scan', payload);

      if (__DEV__) {
        console.log('[API] POST /sessions/scan →', {
          source: data.source ?? 'unknown',
          items: data.items?.length ?? 0,
          currency: data.summary?.currency,
          _parseMeta: data._parseMeta,
        });
      }
      return data;
    } catch (error) {
      console.error('[API] Error (parse):', error);
      throw normalizeError(error);
    }
  },

  async finalize(payload: FinalizeReceiptRequest): Promise<FinalizeReceiptResponse> {
    try {
      console.log('[API] POST /sessions/finalize');
      console.log('[API] Request data:', JSON.stringify(payload, null, 2));

      const { data } = await apiClient.post<FinalizeReceiptResponse>('/sessions/finalize', payload);

      console.log('[API] Response:', JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      console.error('[API] Error (finalize):', error);
      throw normalizeError(error);
    }
  },
};
