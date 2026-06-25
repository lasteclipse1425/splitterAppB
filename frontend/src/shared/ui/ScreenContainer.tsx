// src/shared/ui/ScreenContainer.tsx
import React from 'react'
import { YStack } from 'tamagui'
import { useAppColors } from '@/shared/ui/theme-context'

interface ScreenContainerProps {
  children: React.ReactNode
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children
}) => {
  const colors = useAppColors()

  return (
    <YStack
      flex={1}
      backgroundColor={colors.background}
      paddingHorizontal="$4"
      paddingTop="$5"
      paddingBottom="$4"
    >
      {children}
    </YStack>
  )
}
