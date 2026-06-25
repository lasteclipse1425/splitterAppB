import React, { useEffect } from 'react';
import { QuickHabitsSheet } from '@/features/receipt/ui/QuickHabitsSheet';
import { QuickHabitsToast } from '@/features/receipt/ui/QuickHabitsToast';
import { SaveHabitTemplateSheet } from '@/features/receipt/ui/SaveHabitTemplateSheet';
import { useQuickHabitsStore } from '@/features/receipt/model/quick-habits.store';

export function QuickHabitsProvider({ children }: { children: React.ReactNode }) {
  const loadHabits = useQuickHabitsStore((s) => s.loadHabits);
  const initialized = useQuickHabitsStore((s) => s.initialized);

  useEffect(() => {
    if (!initialized) {
      loadHabits().catch(() => {});
    }
  }, [initialized, loadHabits]);

  return (
    <>
      {children}
      <QuickHabitsSheet />
      <SaveHabitTemplateSheet />
      <QuickHabitsToast />
    </>
  );
}
