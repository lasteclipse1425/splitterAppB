// src/shared/ui/Card.tsx
import React from 'react'
import { YStack } from 'tamagui'
import { useAppTheme } from '@/shared/ui/theme-context'

interface CardProps {
  children: React.ReactNode
  padding?: string
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = '$4'
}) => {
  const { surfaceCardProps } = useAppTheme()

  return (
    <YStack padding={padding} {...surfaceCardProps}>
      {children}
    </YStack>
  )
}
