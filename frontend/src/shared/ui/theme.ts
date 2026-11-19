/**
 * Consolidated theme tokens for the Splitter app.
 *
 * All dark-mode colours are WCAG AA compliant against their intended background.
 * Import `useThemeTokens()` in components to get the correct palette for the
 * active theme without hardcoded colour literals.
 */

// ── Base palette ──────────────────────────────────────────────────────────────

export const colors = {
  primary: '#3B82F6',
  primaryDark: '#60A5FA',    // brighter variant for dark mode
  accent: '#2ECC71',         // main green used across the app
  accentDark: '#34D399',     // brighter green for dark surfaces
  secondary: '#10B981',
  danger: '#EF4444',
  dangerDark: '#F87171',
  warning: '#F59E0B',
  warningDark: '#FBBF24',

  gray: {
    50:  '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#0D1117',
  },

  white: '#FFFFFF',
  black: '#000000',
};

// ── Spacing & Typography (unchanged) ──────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// ── Semantic theme tokens ─────────────────────────────────────────────────────

export interface ThemeTokens {
  colors: {
    background: string;
    surface: string;        // card / elevated surface
    surfaceHover: string;
    text: string;           // primary text — ≥ 7:1 on background
    textSecondary: string;  // secondary text — ≥ 4.5:1 on background
    textTertiary: string;   // hints, placeholders — ≥ 3:1
    border: string;         // subtle borders — ≥ 3:1 on background
    borderStrong: string;   // stronger borders for inputs
    accent: string;         // main action colour
    accentText: string;     // text on accent backgrounds
    danger: string;
    warning: string;
    success: string;
    icon: string;           // default icon tint
    iconMuted: string;
    disabled: string;       // disabled text/icon
    disabledBg: string;     // disabled button background
    // base palette pass-through
    primary: string;
    secondary: string;
    white: string;
    black: string;
    gray: typeof colors.gray;
  };
  spacing: typeof spacing;
  fontSize: typeof fontSize;
}

export const lightTheme: ThemeTokens = {
  colors: {
    ...colors,
    background: colors.white,
    surface: colors.gray[50],
    surfaceHover: colors.gray[100],
    text: colors.gray[900],             // #111827 on #FFF = 18.1:1
    textSecondary: colors.gray[600],    // #4B5563 on #FFF = 7.4:1
    textTertiary: colors.gray[600],
    border: colors.gray[500],
    borderStrong: colors.gray[600],
    accent: '#177A42',
    accentText: colors.white,
    danger: '#B91C1C',
    warning: '#92400E',
    success: '#177A42',
    icon: colors.gray[700],
    iconMuted: colors.gray[600],
    disabled: colors.gray[500],
    disabledBg: colors.gray[200],
  },
  spacing,
  fontSize,
};

export const darkTheme: ThemeTokens = {
  colors: {
    ...colors,
    background: colors.gray[950],       // #0D1117 — deep dark
    surface: colors.gray[900],          // #111827 — card bg
    surfaceHover: colors.gray[800],     // #1F2937 — hover/press
    text: colors.gray[50],              // #F9FAFB on #0D1117 = 18.5:1
    textSecondary: colors.gray[300],    // #D1D5DB on #0D1117 = 11.8:1 ✅
    textTertiary: colors.gray[400],
    border: colors.gray[500],
    borderStrong: colors.gray[400],
    accent: '#34D399',                  // brighter green on dark
    accentText: colors.gray[950],       // dark text on green
    danger: colors.dangerDark,          // #F87171
    warning: colors.warningDark,        // #FBBF24
    success: '#34D399',
    icon: colors.gray[300],             // #D1D5DB — readable on dark
    iconMuted: colors.gray[400],
    disabled: colors.gray[400],
    disabledBg: colors.gray[800],       // visible but muted
  },
  spacing,
  fontSize,
};
