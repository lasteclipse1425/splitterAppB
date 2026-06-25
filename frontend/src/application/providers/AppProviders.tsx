// src/application/providers/AppProviders.tsx
import { ReactNode } from 'react';
import QueryProvider from './QueryProvider';
import I18nProvider from './I18nProvider';
import { TamaguiProvider } from './TamaguiProvider';
import { ThemeProvider } from '@/shared/ui/theme-context';
import { AppStoreProvider } from '@/shared/lib/stores/app-store';
import { QuickHabitsProvider } from '@/features/receipt/providers/QuickHabitsProvider';

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TamaguiProvider>
      <ThemeProvider>
        <AppStoreProvider>
          <QueryProvider>
            <I18nProvider>
              <QuickHabitsProvider>{children}</QuickHabitsProvider>
            </I18nProvider>
          </QueryProvider>
        </AppStoreProvider>
      </ThemeProvider>
    </TamaguiProvider>
  );
}
