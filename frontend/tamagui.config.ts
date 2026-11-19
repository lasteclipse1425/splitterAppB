// tamagui.config.ts
import { createTamagui } from '@tamagui/core'
import { config } from '@tamagui/config/v3'

const appConfig = createTamagui({
  ...config,
  themes: {
    ...config.themes,
    light: {
      ...config.themes.light,
      primary: '#2ECC71',
      primaryHover: '#27AE60',
      success: '#2ECC71',
      error: '#F44336',
      warning: '#FF9800',
    },
    dark: {
      ...config.themes.dark,
      // ── Surfaces ──────────────────────────────────────────────────────
      background: '#0D1117',       // deep dark — base background
      backgroundHover: '#161B22',
      backgroundPress: '#1C2128',
      backgroundFocus: '#1C2128',
      // ── Text ──────────────────────────────────────────────────────────
      color: '#E6EDF3',            // primary text — 15:1 on #0D1117
      colorHover: '#F0F6FC',
      colorPress: '#C9D1D9',
      colorFocus: '#F0F6FC',
      // ── Borders ───────────────────────────────────────────────────────
      borderColor: '#6B7280',
      borderColorHover: '#9CA3AF',
      borderColorPress: '#D1D5DB',
      borderColorFocus: '#58A6FF',
      // ── Accent & Semantic ─────────────────────────────────────────────
      primary: '#34D399',          // bright green for dark mode
      primaryHover: '#6EE7B7',
      success: '#34D399',
      error: '#F87171',            // brighter red for dark backgrounds
      warning: '#FBBF24',
    },
  },
})

export default appConfig

export type Conf = typeof appConfig

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {}
}
