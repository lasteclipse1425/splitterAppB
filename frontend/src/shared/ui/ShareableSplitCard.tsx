import React from 'react';
import { YStack, XStack, Text } from 'tamagui';
import { useAppColors } from '@/shared/ui/theme-context';
import { appRadii } from '@/shared/ui/app-tokens';
import { formatMoney } from '@/shared/lib/money';

export type ShareableSplitCardProps = {
  sessionName?: string;
  currency: string;
  grandTotal: number;
  participants: { username: string; amount: number }[];
};

const formatAmount = (n: number, currency: string) => formatMoney(n, currency);

export function ShareableSplitCard({
  sessionName,
  currency,
  grandTotal,
  participants,
}: ShareableSplitCardProps) {
  const colors = useAppColors();
  const title = sessionName?.trim() || 'Bill split';

  return (
    <YStack
      width={340}
      p="$4"
      gap="$3"
      bg={colors.card}
      borderRadius={appRadii.lg}
      borderWidth={2}
      borderColor={colors.primaryBorder}
    >
      <YStack gap="$1">
        <Text fontSize={11} fontWeight="700" color={colors.textMuted} letterSpacing={1}>
          SPLITTER
        </Text>
        <Text fontSize={22} fontWeight="800" color={colors.text} numberOfLines={2}>
          {title}
        </Text>
      </YStack>

      <YStack
        py="$2.5"
        px="$3"
        borderRadius={appRadii.md}
        bg={colors.primarySoft}
        borderWidth={1}
        borderColor={colors.primaryBorder}
      >
        <Text fontSize={12} color={colors.textMuted}>
          Total
        </Text>
        <Text fontSize={28} fontWeight="800" color={colors.primary}>
          {formatAmount(grandTotal, currency)}
        </Text>
      </YStack>

      {participants.length > 0 && (
        <YStack gap="$2">
          <Text fontSize={13} fontWeight="700" color={colors.text}>
            Per person
          </Text>
          {participants.map((p) => (
            <XStack key={p.username} jc="space-between" ai="center">
              <Text fontSize={14} fontWeight="600" color={colors.text} numberOfLines={1} f={1} pr="$2">
                {p.username}
              </Text>
              <Text fontSize={14} fontWeight="700" color={colors.text}>
                {formatAmount(p.amount, currency)}
              </Text>
            </XStack>
          ))}
        </YStack>
      )}

      <Text fontSize={11} color={colors.textMuted} textAlign="center" pt="$1">
        Split with Splitter
      </Text>
    </YStack>
  );
}
