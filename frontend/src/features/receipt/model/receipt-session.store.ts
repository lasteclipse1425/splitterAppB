import { create } from 'zustand';
import type {
  FinalizeReceiptResponse,
  FinalizeReceiptItemPayload,
  FinalizeTotalsByItem,
  FinalizeTotalsByParticipant,
  ParseReceiptRequest,
  ParseReceiptResponse,
  ReceiptParticipant,
  ReceiptSummary,
  ReceiptSplitMode,
  ReceiptAllocation,
} from '@/features/receipt/api/receipt.api';
import { ReceiptApi } from '@/features/receipt/api/receipt.api';
import { useAppStore } from '@/shared/lib/stores/app-store';

export type CapturedReceiptImage = {
  uri?: string;
  mimeType: string;
  base64: string;
  width?: number;
  height?: number;
};

export interface ReceiptSplitItem {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  kind?: string;
  confidence?: number;
  splitMode: ReceiptSplitMode;
  assignedTo: string[];
  perPersonCount: Record<string, number>;
}

export interface ReceiptSessionMeta {
  sessionId: number;
  sessionName: string;
  language: string;
  summary?: ReceiptSummary;
  warnings?: string[];
}

export type FinishPayload = {
  sessionId?: number;
  sessionName?: string;
  receiptId?: string;
  participants?: ReceiptParticipant[];
  totals?: Record<string, number>;
  totalsByParticipant?: FinalizeTotalsByParticipant[];
  totalsByItem?: FinalizeTotalsByItem[];
  allocations?: ReceiptAllocation[];
  status?: string;
  createdAt?: string;
  grandTotal?: number;
  currency?: string;
};

interface ReceiptSessionStore {
  capture?: CapturedReceiptImage;
  parsing: boolean;
  parseError?: string;
  session?: ReceiptSessionMeta;
  items: ReceiptSplitItem[];
  participants: ReceiptParticipant[];
  currency: string; // ✅ Добавлено поле для валюты
  sourceCurrency: string;
  finalizing: boolean;
  finalizeError?: string;
  finalized?: FinalizeReceiptResponse;
  lastFinishPayload?: FinishPayload;

  setCapture: (capture?: CapturedReceiptImage) => void;
  clearCapture: () => void;
  setSessionName: (sessionName: string) => void;
  setParticipants: (participants: ReceiptParticipant[]) => void;
  setCurrency: (currency: string) => void; // ✅ Добавлен метод
  setReceiptCurrency: (currency: string) => void;
  updateItem: (itemId: string, updater: (prev: ReceiptSplitItem) => ReceiptSplitItem) => void;
  setItems: (items: ReceiptSplitItem[]) => void;
  startManualSession: (sessionId: number, sessionName: string, items: ReceiptSplitItem[]) => void;
  setLastFinishPayload: (payload?: FinishPayload) => void;

  parseReceipt: (payload: ParseReceiptRequest) => Promise<ParseReceiptResponse>;
  finalizeSession: () => Promise<FinalizeReceiptResponse>;
  reset: () => void;
}

const INITIAL_STATE: Pick<ReceiptSessionStore,
  'capture' | 'parsing' | 'parseError' | 'session' | 'items' | 'participants' | 'currency' | 'sourceCurrency' | 'finalizing' | 'finalizeError' | 'finalized' | 'lastFinishPayload'
> = {
  capture: undefined,
  parsing: false,
  parseError: undefined,
  session: undefined,
  items: [],
  participants: [],
  currency: 'UZS', // ✅ Значение по умолчанию
  sourceCurrency: 'UZS',
  finalizing: false,
  finalizeError: undefined,
  finalized: undefined,
  lastFinishPayload: undefined,
};

export const useReceiptSessionStore = create<ReceiptSessionStore>((set, get) => ({
  ...INITIAL_STATE,

  setCapture: (capture) => set({ capture }),
  clearCapture: () => set({ capture: undefined }),

  setSessionName: (sessionName) => {
    set((state) => {
      if (!state.session) return {};
      return { session: { ...state.session, sessionName } };
    });
  },

  setParticipants: (participants) => set({ participants }),

  setCurrency: (currency) => set({ currency }), // ✅ Новый метод
  setReceiptCurrency: (currency) => set({ currency, sourceCurrency: currency }),

  updateItem: (itemId, updater) => {
    set((state) => ({
      items: state.items.map((item) => item.id === itemId ? updater(item) : item),
    }));
  },

  setItems: (items) => set({ items }),
  startManualSession: (sessionId, sessionName, items) => set({
    session: {
      sessionId,
      sessionName,
      language: useAppStore.getState().language || 'en',
    },
    items,
    participants: [],
    currency: useAppStore.getState().preferredCurrency || 'UZS',
    sourceCurrency: useAppStore.getState().preferredCurrency || 'UZS',
    finalized: undefined,
    lastFinishPayload: undefined,
    finalizeError: undefined,
  }),
  setLastFinishPayload: (payload) => set({ lastFinishPayload: payload }),

  parseReceipt: async (payload) => {
    set({ parsing: true, parseError: undefined });
    try {
      const response = await ReceiptApi.parse(payload);
      if (!Array.isArray(response.items) || response.items.length === 0) {
        throw new Error('No items were found. Please retake the receipt photo.');
      }
      const splitItems: ReceiptSplitItem[] = response.items.map((item) => ({
        id: item.id,
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        kind: item.kind,
        confidence: item.confidence,
        splitMode: item.quantity > 1 && Number.isInteger(item.quantity) ? 'count' : 'equal',
        assignedTo: [],
        perPersonCount: {},
      }));

      // ✅ Извлекаем валюту из ответа API
      const detectedCurrency =
        response.summary?.currency && response.summary.currency !== 'UNKNOWN'
          ? response.summary.currency
          : useAppStore.getState().preferredCurrency;

      set({
        parsing: false,
        parseError: undefined,
        session: {
          sessionId: response.sessionId,
          sessionName: response.sessionName,
          language: response.language,
          summary: response.summary,
          warnings: response.warnings,
        },
        items: splitItems,
        participants: [],
        currency: detectedCurrency, // ✅ Сохраняем валюту
        sourceCurrency: detectedCurrency,
        finalized: undefined,
        finalizeError: undefined,
      });

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse receipt';
      set({ parsing: false, parseError: message });
      throw error;
    }
  },

  finalizeSession: async () => {
    const { session, participants, items, currency } = get();
    if (!session) throw new Error('No session to finalize');
    if (participants.length === 0) throw new Error('Add at least one participant');

    const payloadItems: FinalizeReceiptItemPayload[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.unitPrice,
      quantity: item.quantity,
      kind: item.kind,
      splitMode: item.splitMode,
      assignedTo: item.splitMode === 'equal' ? item.assignedTo : undefined,
      perPersonCount: item.splitMode === 'count' ? item.perPersonCount : undefined,
    }));

    set({ finalizing: true, finalizeError: undefined });
    try {
      const response = await ReceiptApi.finalize({
        sessionId: session.sessionId,
        sessionName: session.sessionName,
        participants,
        items: payloadItems,
        currency,
      });

      const nextState: Partial<ReceiptSessionStore> = {
        finalizing: false,
        finalized: response,
        finalizeError: undefined,
        lastFinishPayload: {
          sessionId: response.sessionId,
          sessionName: response.sessionName,
          participants,
          totalsByParticipant: response.totals?.byParticipant,
          totalsByItem: response.totals?.byItem,
          allocations: response.allocations,
          grandTotal: response.totals?.grandTotal,
          currency: response.totals?.currency ?? currency,
          status: response.status,
          createdAt: response.createdAt,
        },
      };

      if (response.totals?.currency) {
        nextState.currency = response.totals.currency;
      }

      set(nextState);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to finalize session';
      set({ finalizing: false, finalizeError: message });
      throw error;
    }
  },

  reset: () => set({ ...INITIAL_STATE }),
}));
