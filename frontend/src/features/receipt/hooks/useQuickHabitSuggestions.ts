import { useEffect, useMemo } from 'react';
import { useQuickHabitsStore, templatesToMatchHabits } from '@/features/receipt/model/quick-habits.store';
import { useSessionsHistoryStore } from '@/features/sessions/model/history.store';
import { matchItemsToHabits } from '@/features/receipt/lib/quick-habits-matcher';
import type { HabitMatchableItem, HabitParticipant } from '@/features/receipt/lib/quick-habits.types';

export function useQuickHabitSuggestions(
  items: HabitMatchableItem[],
  participants: HabitParticipant[]
) {
  const loadHabits = useQuickHabitsStore((s) => s.loadHabits);
  const templates = useQuickHabitsStore((s) => s.templates);
  const habitsInitialized = useQuickHabitsStore((s) => s.initialized);

  const fetchHistory = useSessionsHistoryStore((s) => s.fetchHistory);
  const historyInitialized = useSessionsHistoryStore((s) => s.initialized);
  const historySessions = useSessionsHistoryStore((s) => s.sessions);

  useEffect(() => {
    if (!habitsInitialized) {
      loadHabits().catch(() => {});
    }
  }, [habitsInitialized, loadHabits]);

  useEffect(() => {
    if (!historyInitialized) {
      fetchHistory(50).catch(() => {});
    }
  }, [historyInitialized, fetchHistory]);

  const templateHabits = useMemo(() => templatesToMatchHabits(templates), [templates]);

  const matches = useMemo(
    () => matchItemsToHabits(items, participants, templateHabits, historySessions),
    [items, participants, templateHabits, historySessions]
  );

  const matchIds = useMemo(() => Object.keys(matches), [matches]);

  return {
    matches,
    matchIds,
    matchCount: matchIds.length,
    templates,
    habitsInitialized,
  };
}
