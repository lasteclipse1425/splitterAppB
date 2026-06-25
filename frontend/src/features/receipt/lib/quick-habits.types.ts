export type HabitParticipant = { uniqueId: string; username: string };

export type HabitMatchSource = 'custom' | 'history';

export type HabitMatch = {
  splitMode: 'equal' | 'count';
  assignedTo: string[];
  perPersonCount: Record<string, number>;
  source: HabitMatchSource;
  sessionName?: string;
  date?: string;
};

export type HabitMatchableItem = {
  id: string;
  name: string;
  quantity: number;
};

export type HabitApplyHandler = (
  matches: Record<string, HabitMatch>,
  selectedIds: string[]
) => void;
