import type { HabitMatch, HabitParticipant } from './quick-habits.types';

export type SplittableItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  assignedTo: string[];
  perPersonCount?: Record<string, number>;
  splitMode?: 'equal' | 'count';
  totalPrice?: number;
};

export function applyHabitMatchesToItems<T extends SplittableItem>(
  items: T[],
  matches: Record<string, HabitMatch>,
  participants: HabitParticipant[],
  selectedIds?: string[]
): T[] {
  const selected = selectedIds ? new Set(selectedIds) : null;

  return items.map((item) => {
    if (selected && !selected.has(item.id)) return item;

    const match = matches[item.id];
    if (!match) return item;

    if (match.splitMode === 'count') {
      const perPersonCount: Record<string, number> = {};
      let allocated = 0;
      for (const [uid, qty] of Object.entries(match.perPersonCount)) {
        const toAssign = Math.min(qty, item.quantity - allocated);
        if (toAssign > 0) {
          perPersonCount[uid] = toAssign;
          allocated += toAssign;
        }
      }
      if (allocated === 0) {
        return {
          ...item,
          splitMode: 'equal' as const,
          assignedTo: participants.map((p) => p.uniqueId),
          perPersonCount: {},
        };
      }
      return {
        ...item,
        splitMode: 'count' as const,
        assignedTo: [],
        perPersonCount,
      };
    }

    return {
      ...item,
      splitMode: 'equal' as const,
      assignedTo: [...match.assignedTo],
      perPersonCount: {},
    };
  });
}
