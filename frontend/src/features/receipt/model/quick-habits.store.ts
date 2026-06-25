import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QuickHabitTemplate, QuickHabitTemplateInput } from '@/features/receipt/model/quick-habit-template.types';
import type { ReceiptSplitItem } from '@/features/receipt/model/receipt-session.store';
import { useReceiptSessionStore } from '@/features/receipt/model/receipt-session.store';

export interface QuickSplitHabit {
  id: string;
  itemName: string;
  splitMode: 'equal' | 'count';
  assignedTo: string[];
  perPersonCount: Record<string, number>;
  unitPrice?: number;
  quantity?: number;
  totalPrice?: number;
  createdAt: string;
}

export type QuickSplitHabitInput = Omit<QuickSplitHabit, 'id' | 'createdAt'>;
export type QuickSplitHabitPatch = Partial<Omit<QuickSplitHabit, 'id' | 'createdAt'>>;

interface QuickHabitsStore {
  habits: QuickSplitHabit[];
  templates: QuickHabitTemplate[];
  initialized: boolean;
  loadHabits: () => Promise<void>;
  addTemplate: (input: QuickHabitTemplateInput) => Promise<QuickHabitTemplate>;
  updateTemplate: (id: string, patch: Partial<QuickHabitTemplateInput>) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
  saveCurrentSessionAsTemplate: (name: string) => Promise<QuickHabitTemplate>;
  clearAll: () => Promise<void>;
}

const HABITS_STORAGE_KEY = '@quick_split_habits';
const TEMPLATES_STORAGE_KEY = '@quick_habit_templates';

const cloneItem = (item: ReceiptSplitItem): ReceiptSplitItem => ({
  ...item,
  assignedTo: [...item.assignedTo],
  perPersonCount: { ...item.perPersonCount },
});

const persistTemplates = async (templates: QuickHabitTemplate[]) => {
  await AsyncStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
};

export const templatesToMatchHabits = (templates: QuickHabitTemplate[]): QuickSplitHabit[] => {
  const habits: QuickSplitHabit[] = [];
  for (const template of templates) {
    for (const item of template.items) {
      const perPersonValues = Object.values(item.perPersonCount || {});
      const isAssigned =
        item.splitMode === 'count'
          ? perPersonValues.reduce((a, b) => a + (b || 0), 0) > 0
          : (item.assignedTo || []).length > 0;
      if (!isAssigned) continue;

      habits.push({
        id: `${template.id}:${item.id}`,
        itemName: item.name,
        splitMode: item.splitMode === 'count' ? 'count' : 'equal',
        assignedTo: item.splitMode === 'equal' ? [...item.assignedTo] : [],
        perPersonCount: item.splitMode === 'count' ? { ...item.perPersonCount } : {},
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        createdAt: template.updatedAt,
      });
    }
  }
  return habits;
};

export const useQuickHabitsStore = create<QuickHabitsStore>((set, get) => ({
  habits: [],
  templates: [],
  initialized: false,

  loadHabits: async () => {
    try {
      const [habitsRaw, templatesRaw] = await Promise.all([
        AsyncStorage.getItem(HABITS_STORAGE_KEY),
        AsyncStorage.getItem(TEMPLATES_STORAGE_KEY),
      ]);

      set({
        habits: habitsRaw ? JSON.parse(habitsRaw) : [],
        templates: templatesRaw ? JSON.parse(templatesRaw) : [],
        initialized: true,
      });
    } catch (e) {
      console.error('Failed to load quick habits', e);
      set({ habits: [], templates: [], initialized: true });
    }
  },

  addTemplate: async (input) => {
    const now = new Date().toISOString();
    const template: QuickHabitTemplate = {
      ...input,
      id: Math.random().toString(36).substring(2, 9),
      participants: input.participants.map((p) => ({ ...p })),
      items: input.items.map(cloneItem),
      createdAt: now,
      updatedAt: now,
    };

    const { templates } = get();
    const updated = [
      template,
      ...templates.filter((t) => t.name.toLowerCase().trim() !== template.name.toLowerCase().trim()),
    ];

    set({ templates: updated });
    await persistTemplates(updated);
    return template;
  },

  updateTemplate: async (id, patch) => {
    const { templates } = get();
    const updated = templates.map((template) => {
      if (template.id !== id) return template;
      return {
        ...template,
        ...patch,
        name: patch.name ?? template.name,
        currency: patch.currency ?? template.currency,
        participants: patch.participants
          ? patch.participants.map((p) => ({ ...p }))
          : template.participants,
        items: patch.items ? patch.items.map(cloneItem) : template.items,
        updatedAt: new Date().toISOString(),
      };
    });

    set({ templates: updated });
    await persistTemplates(updated);
  },

  removeTemplate: async (id) => {
    const { templates } = get();
    const updated = templates.filter((t) => t.id !== id);
    set({ templates: updated });
    await persistTemplates(updated);
  },

  saveCurrentSessionAsTemplate: async (name) => {
    const { participants, items, currency } = useReceiptSessionStore.getState();
    if (participants.length === 0) throw new Error('No participants');
    if (items.length === 0) throw new Error('No items');

    return get().addTemplate({
      name: name.trim(),
      participants: participants.map((p) => ({ ...p })),
      items: items.map(cloneItem),
      currency: currency || 'UZS',
    });
  },

  clearAll: async () => {
    set({ habits: [], templates: [] });
    try {
      await Promise.all([
        AsyncStorage.removeItem(HABITS_STORAGE_KEY),
        AsyncStorage.removeItem(TEMPLATES_STORAGE_KEY),
      ]);
    } catch (e) {
      console.error('Failed to clear habits', e);
    }
  },
}));
