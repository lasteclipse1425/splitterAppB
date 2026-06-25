import React, { createContext, useContext, useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { useAppStore, type ThemeMode } from '@/shared/lib/stores/app-store';
import { palettes, type AppColorPalette } from '@/shared/ui/palettes';
import { appRadii } from '@/shared/ui/app-tokens';

const isAndroid = Platform.OS === 'android';

export type ResolvedTheme = 'light' | 'dark';

export function resolveTheme(
  mode: ThemeMode,
  systemScheme: 'light' | 'dark' | null | undefined
): ResolvedTheme {
  if (mode === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }
  return mode;
}

export function pickPalette(resolved: ResolvedTheme, colorblind: boolean): AppColorPalette {
  if (colorblind) {
    return resolved === 'dark' ? palettes.darkCb : palettes.lightCb;
  }
  return resolved === 'dark' ? palettes.dark : palettes.light;
}

export type AppThemeStyles = {
  colors: AppColorPalette;
  greenSurface: {
    borderWidth: number;
    borderColor: string;
    backgroundColor: string;
  };
  greenOutline: {
    borderWidth: number;
    borderColor: string;
  };
  surfaceCardProps: {
    backgroundColor: string;
    borderWidth: number;
    borderColor: string;
    borderRadius: number;
    elevation?: number;
    shadowColor?: string;
    shadowOffset?: { width: number; height: number };
    shadowOpacity?: number;
    shadowRadius?: number;
  };
  appShadow: {
    card: Record<string, unknown>;
    soft: Record<string, unknown>;
  };
};

function buildThemeStyles(colors: AppColorPalette): AppThemeStyles {
  const iosCardShadow = {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  };

  const iosSoftShadow = {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  };

  return {
    colors,
    greenSurface: {
      borderWidth: isAndroid ? 2 : 1,
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primarySoft,
    },
    greenOutline: {
      borderWidth: isAndroid ? 2 : 1,
      borderColor: colors.primaryBorder,
    },
    appShadow: {
      card: isAndroid ? { elevation: 4 } : iosCardShadow,
      soft: isAndroid ? { elevation: 2 } : iosSoftShadow,
    },
    surfaceCardProps: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: appRadii.lg,
      ...(isAndroid ? { elevation: 4 } : iosCardShadow),
    },
  };
}

type ThemeContextValue = AppThemeStyles & {
  resolvedTheme: ResolvedTheme;
  themeMode: ThemeMode;
  colorblind: boolean;
  tamaguiTheme: ResolvedTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeMode = useAppStore((s) => s.themeMode);
  const colorblind = useAppStore((s) => s.colorblind);
  const systemScheme = useColorScheme();

  const value = useMemo(() => {
    const resolvedTheme = resolveTheme(themeMode, systemScheme);
    const colors = pickPalette(resolvedTheme, colorblind);
    const styles = buildThemeStyles(colors);

    return {
      ...styles,
      resolvedTheme,
      themeMode,
      colorblind,
      tamaguiTheme: resolvedTheme,
    };
  }, [themeMode, colorblind, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return ctx;
}

export function useAppColors(): AppColorPalette {
  return useAppTheme().colors;
}
