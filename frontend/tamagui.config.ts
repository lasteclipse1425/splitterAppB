// tamagui.config.ts
import { createTamagui } from '@tamagui/core'
import { config } from '@tamagui/config/v3'

const appConfig = createTamagui({
  ...config,
  themes: {
    ...config.themes,
    light: {
      ...config.themes.light,
      background: '#F7F9FA',
      backgroundHover: '#EEF2F5',
      backgroundPress: '#E4EAEE',
      backgroundFocus: '#DDE4EA',
      color: '#24313F',
      colorHover: '#1B2836',
      colorPress: '#15202B',
      borderColor: '#E7ECEF',
      borderColorHover: '#D8E0E6',
      primary: '#2ECC71',
      primaryHover: '#27AE60',
      success: '#2ECC71',
      error: '#E74C3C',
      warning: '#F39C12',
    },
    dark: {
      ...config.themes.dark,
      primary: '#2ECC71',
      primaryHover: '#58D68D',
      success: '#2ECC71',
      error: '#F44336',
      warning: '#FF9800',
    }
  }
})

export default appConfig

export type Conf = typeof appConfig

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {}
}