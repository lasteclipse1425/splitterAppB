import { create } from 'zustand';
import type { HabitApplyHandler } from '@/features/receipt/lib/quick-habits.types';
import type { ReceiptSplitItem } from '@/features/receipt/model/receipt-session.store';

export type QuickHabitsTab = 'suggestions' | 'templates';
export type QuickHabitsFlow = 'default' | 'homeStart';
export type QuickHabitsStep = 'main';

interface QuickHabitsUiStore {
  isOpen: boolean;
  saveTemplateOpen: boolean;
  flow: QuickHabitsFlow;
  step: QuickHabitsStep;
  activeTab: QuickHabitsTab;
  selectedMatchIds: string[];
  undoSnapshot: ReceiptSplitItem[] | null;
  toastVisible: boolean;
  applyHandler: HabitApplyHandler | null;

  open: (tab?: QuickHabitsTab, flow?: QuickHabitsFlow) => void;
  openHomeLibrary: () => void;
  openSaveTemplate: () => void;
  closeSaveTemplate: () => void;
  close: () => void;
  setActiveTab: (tab: QuickHabitsTab) => void;
  toggleMatchSelection: (itemId: string) => void;
  selectAllMatches: (itemIds: string[]) => void;
  clearMatchSelection: () => void;
  registerApplyHandler: (handler: HabitApplyHandler) => void;
  unregisterApplyHandler: () => void;
  setUndoSnapshot: (items: ReceiptSplitItem[] | null) => void;
  showToast: () => void;
  hideToast: () => void;
}

const initialUiState = {
  isOpen: false,
  saveTemplateOpen: false,
  flow: 'default' as QuickHabitsFlow,
  step: 'main' as QuickHabitsStep,
  activeTab: 'suggestions' as QuickHabitsTab,
  selectedMatchIds: [] as string[],
  undoSnapshot: null as ReceiptSplitItem[] | null,
  toastVisible: false,
  applyHandler: null as HabitApplyHandler | null,
};

export const useQuickHabitsUiStore = create<QuickHabitsUiStore>((set, get) => ({
  ...initialUiState,

  open: (tab = 'suggestions', flow = 'default') =>
    set({
      isOpen: true,
      flow,
      step: 'main',
      activeTab: tab,
    }),

  openHomeLibrary: () =>
    set({
      isOpen: true,
      flow: 'homeStart',
      step: 'main',
      activeTab: 'templates',
      selectedMatchIds: [],
    }),

  openSaveTemplate: () => set({ saveTemplateOpen: true }),

  closeSaveTemplate: () => set({ saveTemplateOpen: false }),

  close: () =>
    set({
      ...initialUiState,
      applyHandler: get().applyHandler,
    }),

  setActiveTab: (tab) => set({ activeTab: tab, step: 'main' }),

  toggleMatchSelection: (itemId) => {
    const { selectedMatchIds } = get();
    const next = selectedMatchIds.includes(itemId)
      ? selectedMatchIds.filter((id) => id !== itemId)
      : [...selectedMatchIds, itemId];
    set({ selectedMatchIds: next });
  },

  selectAllMatches: (itemIds) => set({ selectedMatchIds: [...itemIds] }),

  clearMatchSelection: () => set({ selectedMatchIds: [] }),

  registerApplyHandler: (handler) => set({ applyHandler: handler }),

  unregisterApplyHandler: () => set({ applyHandler: null }),

  setUndoSnapshot: (items) => set({ undoSnapshot: items }),

  showToast: () => set({ toastVisible: true }),

  hideToast: () => set({ toastVisible: false, undoSnapshot: null }),
}));

export const openQuickHabits = (tab?: QuickHabitsTab, flow?: QuickHabitsFlow) =>
  useQuickHabitsUiStore.getState().open(tab, flow);

export const openQuickHabitsHomeLibrary = () =>
  useQuickHabitsUiStore.getState().openHomeLibrary();

export const openSaveHabitTemplate = () =>
  useQuickHabitsUiStore.getState().openSaveTemplate();
