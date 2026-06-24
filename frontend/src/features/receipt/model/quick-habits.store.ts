import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface QuickSplitHabit {
  id: string;
  itemName: string;
  splitMode: 'equal' | 'count';
  assignedTo: string[];
  perPersonCount: Record<string, number>;
  createdAt: string;
}

interface QuickHabitsStore {
  habits: QuickSplitHabit[];
  initialized: boolean;
  loadHabits: () => Promise<void>;
  addHabit: (habit: Omit<QuickSplitHabit, 'id' | 'createdAt'>) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  saveSessionAsHabits: (items: any[]) => Promise<void>;
  clearAll: () => Promise<void>;
}

const STORAGE_KEY = '@quick_split_habits';

export const useQuickHabitsStore = create<QuickHabitsStore>((set, get) => ({
  habits: [],
  initialized: false,

  loadHabits: async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        set({ habits: JSON.parse(data), initialized: true });
      } else {
        set({ habits: [], initialized: true });
      }
    } catch (e) {
      console.error('Failed to load quick habits', e);
      set({ habits: [], initialized: true });
    }
  },

  addHabit: async (newHabit) => {
    const { habits } = get();
    const habit: QuickSplitHabit = {
      ...newHabit,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };

    const updated = [
      habit,
      ...habits.filter((h) => h.itemName.toLowerCase().trim() !== newHabit.itemName.toLowerCase().trim()),
    ];

    set({ habits: updated });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save quick habits', e);
    }
  },

  removeHabit: async (id) => {
    const { habits } = get();
    const updated = habits.filter((h) => h.id !== id);
    set({ habits: updated });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to remove quick habit', e);
    }
  },

  saveSessionAsHabits: async (sessionItems) => {
    const { habits } = get();
    const newHabitsList = [...habits];
    for (const item of sessionItems) {
      const perPersonValues = Object.values(item.perPersonCount || {}) as any[];
      const isAssigned = item.splitMode === 'count' 
        ? perPersonValues.reduce((a, b) => a + (b || 0), 0) > 0
        : (item.assignedTo || []).length > 0;

      if (isAssigned) {
        const idx = newHabitsList.findIndex(
          (h) => h.itemName.toLowerCase().trim() === item.name.toLowerCase().trim()
        );
        if (idx !== -1) {
          newHabitsList.splice(idx, 1);
        }

        newHabitsList.unshift({
          id: Math.random().toString(36).substring(2, 9),
          itemName: item.name,
          splitMode: item.splitMode === 'count' ? 'count' : 'equal',
          assignedTo: item.splitMode === 'equal' ? [...(item.assignedTo || [])] : [],
          perPersonCount: item.splitMode === 'count' ? { ...(item.perPersonCount || {}) } : {},
          createdAt: new Date().toISOString(),
        });
      }
    }

    set({ habits: newHabitsList });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newHabitsList));
    } catch (e) {
      console.error('Failed to batch save habits', e);
    }
  },

  clearAll: async () => {
    set({ habits: [] });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear habits', e);
    }
  },
}));
