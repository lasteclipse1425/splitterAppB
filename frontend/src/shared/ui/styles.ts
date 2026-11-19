/**
 * Common styles that adapt to the active theme.
 *
 * Usage:
 *   import { useCommonStyles } from '@/shared/ui/styles';
 *   const styles = useCommonStyles();
 */

import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useAppStore } from '@/shared/lib/stores/app-store';
import { lightTheme, darkTheme } from './theme';

export function useCommonStyles() {
  const themeMode = useAppStore((s) => s.theme);
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  return useMemo(
    () =>
      StyleSheet.create({
        // Containers
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        centerContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.background,
          padding: theme.spacing.lg,
        },
        // Text
        title: {
          fontSize: theme.fontSize.xxxl,
          fontWeight: 'bold',
          color: theme.colors.text,
          textAlign: 'center',
        },
        subtitle: {
          fontSize: theme.fontSize.base,
          color: theme.colors.textSecondary,
          textAlign: 'center',
          marginTop: theme.spacing.sm,
        },
        // Buttons
        button: {
          backgroundColor: theme.colors.accent,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderRadius: 8,
          alignItems: 'center',
          minWidth: 150,
          marginBottom: theme.spacing.sm,
        },
        buttonText: {
          color: theme.colors.accentText,
          fontSize: theme.fontSize.base,
          fontWeight: '600',
        },
        // Container for buttons
        buttonContainer: {
          marginTop: theme.spacing.lg,
          alignItems: 'center',
        },
      }),
    [theme]
  );
}

// Legacy static export for files that haven't migrated yet
export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightTheme.colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: lightTheme.colors.background,
    padding: lightTheme.spacing.lg,
  },
  title: {
    fontSize: lightTheme.fontSize.xxxl,
    fontWeight: 'bold',
    color: lightTheme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: lightTheme.fontSize.base,
    color: lightTheme.colors.textSecondary,
    textAlign: 'center',
    marginTop: lightTheme.spacing.sm,
  },
  button: {
    backgroundColor: lightTheme.colors.accent,
    paddingHorizontal: lightTheme.spacing.lg,
    paddingVertical: lightTheme.spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 150,
    marginBottom: lightTheme.spacing.sm,
  },
  buttonText: {
    color: lightTheme.colors.white,
    fontSize: lightTheme.fontSize.base,
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: lightTheme.spacing.lg,
    alignItems: 'center',
  },
});
