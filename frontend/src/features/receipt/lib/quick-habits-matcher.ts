import type { QuickSplitHabit } from '@/features/receipt/model/quick-habits.store';
import type { SessionHistoryEntry } from '@/features/sessions/api/history.api';
import type { HabitMatch, HabitMatchableItem, HabitParticipant } from './quick-habits.types';

const formatDateSimple = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
};

export function matchItemsToHabits(
  items: HabitMatchableItem[],
  participants: HabitParticipant[],
  customHabits: QuickSplitHabit[],
  historySessions: SessionHistoryEntry[]
): Record<string, HabitMatch> {
  const matches: Record<string, HabitMatch> = {};
  const currentUids = new Set(participants.map((p) => p.uniqueId));

  for (const item of items) {
    const customMatch = customHabits.find(
      (h) => h.itemName.toLowerCase().trim() === item.name.toLowerCase().trim()
    );

    if (customMatch) {
      if (customMatch.splitMode === 'count') {
        const perPersonCount: Record<string, number> = {};
        for (const [uid, qty] of Object.entries(customMatch.perPersonCount)) {
          if (currentUids.has(uid) && qty > 0) {
            perPersonCount[uid] = qty;
          }
        }
        if (Object.keys(perPersonCount).length > 0) {
          matches[item.id] = {
            splitMode: 'count',
            assignedTo: [],
            perPersonCount,
            source: 'custom',
          };
          continue;
        }
      } else {
        const assigned = (customMatch.assignedTo || []).filter((uid) => currentUids.has(uid));
        if (assigned.length > 0) {
          matches[item.id] = {
            splitMode: 'equal',
            assignedTo: assigned,
            perPersonCount: {},
            source: 'custom',
          };
          continue;
        }
      }
    }

    if (historySessions.length === 0) continue;

    for (const session of historySessions) {
      const payload = session.payload;
      if (!payload?.totals?.byItem) continue;

      const pastItem = payload.totals.byItem.find(
        (pi) => pi.name.toLowerCase().trim() === item.name.toLowerCase().trim()
      );
      if (!pastItem) continue;

      const itemAllocs = (payload.allocations || []).filter((a) => a.itemId === pastItem.itemId);
      if (itemAllocs.length === 0) continue;

      const pastUids = itemAllocs.map((a) => a.participantId);
      const presentPastUids = pastUids.filter((uid) => currentUids.has(uid));
      if (presentPastUids.length === 0) continue;

      const isCount = itemAllocs.some(
        (a) => typeof (a as { shareUnits?: number }).shareUnits === 'number' && (a as { shareUnits?: number }).shareUnits! > 0
      );

      if (isCount) {
        const perPersonCount: Record<string, number> = {};
        for (const a of itemAllocs) {
          if (currentUids.has(a.participantId)) {
            const u = (a as { shareUnits?: number }).shareUnits || 0;
            if (u > 0) perPersonCount[a.participantId] = u;
          }
        }
        if (Object.keys(perPersonCount).length > 0) {
          matches[item.id] = {
            splitMode: 'count',
            assignedTo: [],
            perPersonCount,
            source: 'history',
            sessionName: session.sessionName || 'Bill',
            date: formatDateSimple(session.finalizedAt || session.createdAt),
          };
          break;
        }
      } else {
        matches[item.id] = {
          splitMode: 'equal',
          assignedTo: presentPastUids,
          perPersonCount: {},
          source: 'history',
          sessionName: session.sessionName || 'Bill',
          date: formatDateSimple(session.finalizedAt || session.createdAt),
        };
        break;
      }
    }
  }

  return matches;
}
