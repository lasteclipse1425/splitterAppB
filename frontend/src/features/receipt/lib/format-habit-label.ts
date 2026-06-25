import type { HabitMatch, HabitParticipant } from './quick-habits.types';

export function formatHabitMatchLabel(
  match: HabitMatch,
  participants: HabitParticipant[]
): string {
  const nameById = new Map(participants.map((p) => [p.uniqueId, p.username]));

  if (match.splitMode === 'count') {
    return Object.entries(match.perPersonCount)
      .map(([uid, val]) => `${nameById.get(uid) || uid} (${val}x)`)
      .join(', ');
  }

  return (match.assignedTo || [])
    .map((uid) => nameById.get(uid) || uid)
    .join(', ');
}

export function formatHabitRuleLabel(
  habit: {
    splitMode: 'equal' | 'count';
    assignedTo: string[];
    perPersonCount: Record<string, number>;
  },
  participants: HabitParticipant[]
): string {
  const nameById = new Map(participants.map((p) => [p.uniqueId, p.username]));

  if (habit.splitMode === 'equal') {
    return (habit.assignedTo || [])
      .map((uid) => nameById.get(uid) || uid)
      .join(', ');
  }

  return Object.entries(habit.perPersonCount)
    .map(([uid, val]) => `${nameById.get(uid) || uid} (${val}x)`)
    .join(', ');
}
