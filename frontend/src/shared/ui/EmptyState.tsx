import React, { type ComponentType } from 'react';
import { YStack, Text } from 'tamagui';
import { useAppColors } from '@/shared/ui/theme-context';
import { Button } from '@/shared/ui/Button';

type Props = {
  icon: ComponentType<{ size?: number; color?: string }>;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon: Icon, title, subtitle, actionLabel, onAction }: Props) {
  const colors = useAppColors();

  return (
    <YStack ai="center" jc="center" py="$5" px="$3" gap="$2.5" w="100%">
      <YStack
        w={56}
        h={56}
        br={28}
        ai="center"
        jc="center"
        bg={colors.primarySoft}
        borderWidth={1}
        borderColor={colors.border}
      >
        <Icon size={26} color={colors.primaryBorder} />
      </YStack>
      <Text fontSize={15} fontWeight="700" color={colors.text} textAlign="center">
        {title}
      </Text>
      {!!subtitle && (
        <Text fontSize={13} color={colors.textMuted} textAlign="center" lineHeight={18}>
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button title={actionLabel} variant="outline" size="small" onPress={onAction} />
      )}
    </YStack>
  );
}
