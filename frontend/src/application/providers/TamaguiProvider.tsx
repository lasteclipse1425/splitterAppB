// src/application/providers/TamaguiProvider.tsx
import React from 'react'
import { useColorScheme } from 'react-native'
import { TamaguiProvider as Provider } from '@tamagui/core'
import { PortalProvider } from '@tamagui/portal'
import { useFonts } from 'expo-font'
import config from '../../../tamagui.config'
import { useAppStore } from '@/shared/lib/stores/app-store'
import { resolveTheme } from '@/shared/ui/theme-context'

interface TamaguiProviderProps {
  children: React.ReactNode
}

export const TamaguiProvider: React.FC<TamaguiProviderProps> = ({ children }) => {
  const [fontsLoaded] = useFonts({
    Inter: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
    InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
  })

  const themeMode = useAppStore((s) => s.themeMode)
  const systemScheme = useColorScheme()
  const resolvedTheme = resolveTheme(themeMode, systemScheme)

  if (!fontsLoaded) {
    return null
  }

  return (
    <Provider key={resolvedTheme} config={config} defaultTheme={resolvedTheme}>
      <PortalProvider>
        {children}
      </PortalProvider>
    </Provider>
  )
}